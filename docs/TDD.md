# TDD (Technical Design Document)

## 1. Data Schema
Prismaスキーマの定義（GDD-003, GDD-004, GDD-005, GDD-007に基づく）

```prisma
model Character {
  id              String   @id @default(uuid())
  name            String
  
  // 9種の基礎ステータス (GDD-003)
  hp              Int
  mp              Int
  atk             Int
  def             Int
  matk            Int
  mdef            Int
  agi             Int
  luck            Int
  tec             Int
  
  // 職業レベル到達時に獲得する永続パッシブの累積補正 (GDD-004)
  passiveAtkBonus  Int      @default(0)
  passiveDefBonus  Int      @default(0)
  passiveMatkBonus Int      @default(0)
  passiveMdefBonus Int      @default(0)
  // 必要に応じて他のステータスも追加
  
  // 職業システム (GDD-004): UserJobを介した多対多
  jobs            UserJob[]
  currentJobId    String?
  
  // 8枠装備スロット (GDD-007): Itemモデルへのリレーション
  equipWeaponId   String?
  equipSubId      String?
  equipHeadId     String?
  equipBodyId     String?
  equipArmsId     String?
  equipLegs     String?
  equipAcc1Id     String?
  equipAcc2Id     String?

  equipWeapon     Item?    @relation("Weapon", fields: [equipWeaponId], references: [id])
  equipSub        Item?    @relation("Sub", fields: [equipSubId], references: [id])
  equipHead       Item?    @relation("Head", fields: [equipHeadId], references: [id])
  equipBody       Item?    @relation("Body", fields: [equipBodyId], references: [id])
  equipArms       Item?    @relation("Arms", fields: [equipArmsId], references: [id])
  equipLegs       Item?    @relation("Legs", fields: [equipLegsId], references: [id])
  equipAcc1       Item?    @relation("Acc1", fields: [equipAcc1Id], references: [id])
  equipAcc2       Item?    @relation("Acc2", fields: [equipAcc2Id], references: [id])
}

model Job {
  id              String   @id
  name            String
  tier            Int
  category        String   // PHYSICAL | MAGICAL
  userJobs        UserJob[]
}

// 中間モデル: 職業ごとの独立レベルを管理 (GDD-004)
model UserJob {
  characterId     String
  jobId           String
  level           Int      @default(1)
  exp             Int      @default(0)
  character       Character @relation(fields: [characterId], references: [id])
  job             Job       @relation(fields: [jobId], references: [id])

  @@id([characterId, jobId])
}

model Item {
  id              String   @id @default(uuid())
  name            String
  type            String   // WEAPON | HEAD | BODY ...
  rarity          String   // COMMON | UNIQUE
  atk             Int      @default(0)
  def             Int      @default(0)
  matk            Int      @default(0)
  mdef            Int      @default(0)
  specialEffect   String?  // ユニーク装備の特殊効果
  
  // 装備リレーションの逆引き
  equippedWeapon  Character[] @relation("Weapon")
  equippedSub     Character[] @relation("Sub")
  equippedHead    Character[] @relation("Head")
  equippedBody    Character[] @relation("Body")
  equippedArms    Character[] @relation("Arms")
  equippedLegs    Character[] @relation("Legs")
  equippedAcc1    Character[] @relation("Acc1")
  equippedAcc2    Character[] @relation("Acc2")
}

model Monster {
  id              String   @id @default(uuid())
  name            String
  cost            Int
  
  // 魂の欠片（SoulShard）装備スロット (GDD-005)
  soulShardId     String?
  soulShard       SoulShard? @relation(fields: [soulShardId], references: [id])
}

model SoulShard {
  id              String   @id @default(uuid())
  originMonster   String   // 変換元のモンスター名
  atkBonus        Int      @default(0)
  matkBonus       Int      @default(0)
  specialAbility  String?  // シナジー等の特殊能力
  monsters        Monster[]
}
```

## 2. Type Definitions
リファクタリング後のTypeScript定義

```typescript
// 職業カテゴリ
export type ClassCategory = 'PHYSICAL' | 'MAGICAL';

// 成長曲線 (GDD-003)
export interface MPCurve {
  baseMaxMP: number;
  mpGrowthPerLevel: number;
  skillCostMultiplier: 'LOW' | 'HIGH'; 
}

// 永続パッシブ補正 (GDD-004)
export interface PermanentStats {
  atk: number;
  def: number;
  matk: number;
  mdef: number;
}

// 魂の欠片 (GDD-005)
export interface SoulShardEffect {
  stats: Partial<PermanentStats>;
  ability?: string;
}

export interface UserJobState {
  jobId: string;
  level: number;
  exp: number;
}

// キャラクター統合型
export interface CharacterData {
  id: string;
  currentJobId: string;
  jobs: UserJobState[];
  permanentPassives: PermanentStats;
  equipment: {
    weapon?: string;
    sub?: string;
    // ... 他のスロット
  };
}
```

## 3. Necro-System Logic
3枠コスト制と死霊術ランクアップのインターフェース

```typescript
export interface MonsterData {
  id: string;
  cost: number;
  equippedShardId?: string;
}

export interface NecroStatus {
  level: number;       // Max: 99
  rank: number;        // Max: 10
  maxCost: number;
}

export interface IPartyService {
  /**
   * 3枠の使役モンスター編成を検証・保存する。
   * SoulShardによるコスト変動やシナジー計算もここで行う。
   */
  updatePartyFormation(
    necroStatus: NecroStatus, 
    monsterSlots: [MonsterData | null, MonsterData | null, MonsterData | null]
  ): Promise<void>;
}

export interface IJobService {
  /**
   * 転職処理。現在の職業レベルを維持したまま変更。
   * 初めての職業の場合はUserJobを新規作成しLv1から開始。
   */
  changeJob(characterId: string, nextJobId: string): Promise<void>;
  
  /**
   * 職業レベルアップ時のパッシブ蓄積。
   * 一定Lv到達時にCharacterモデルのpassiveXxxBonusを更新。
   */
  onLevelUp(characterId: string, jobId: string, newLevel: number): Promise<void>;
}
```

---

### リファクタリング要約：職業レベルのリセットとパッシブ蓄積の実現方法

1.  **レベルの独立管理**: `Character` と `Job` の間に `UserJob` 中間モデルを導入しました。これにより、各職業のレベルと経験値を個別に保持できます。「転職するとLv1に戻る」というルールは、新しい職業に切り替えた際にその職業に対応する `UserJob` のレベル（初期値1）を参照することで実現されます。
2.  **パッシブの永続蓄積**: `Character` モデルに `passiveAtkBonus` などの補正値フィールドを直接持たせました。職業レベルが特定の閾値に達した際、`IJobService.onLevelUp` 内でこれらのフィールドにボーナスを加算します。この値は転職してもリセットされないため、全職業で共有される永続的なステータス底上げとして機能します。
3.  **装備・死霊の拡張**: 装備スロットを `Item` モデルへのリレーションに移行し、ユニーク装備の特殊効果などを管理可能にしました。また、`Monster` に対する `SoulShard` リレーションを追加し、GDD-005の「魂石化」と「欠片装備」のデータ構造を定義しました。
