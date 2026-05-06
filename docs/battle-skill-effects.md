# Battle Skill Effects Design

## 目的

`Necromance Brave` の戦闘スキルは、属性と攻撃種別を分離して扱う。
これにより、同じ雷属性でも「雷の魔法」と「雷の斬撃」を別の演出として表現できる。
現段階ではスキル個別の専用アニメーションを全て作らず、`属性 x 攻撃種別` の共通VFXをフォールバックとして使う。

## 属性

主要属性は以下の5属性を、序盤から中盤までの基本スキル設計に使う。

| 表示 | 内部ID | 主な用途 |
| --- | --- | --- |
| 炎 | `FIRE` | 火球、爆炎、焼却、継続ダメージ |
| 水 | `WATER` | 水槍、水流、渦、冷却ギミック |
| 雷 | `THUNDER` | 落雷、感電、雷斬、瞬間火力 |
| 土 | `EARTH` | 岩撃、地割れ、防御寄りの重い攻撃 |
| 風 | `WIND` | 風刃、広域斬撃、軽量な範囲攻撃 |

世界観属性として `LIGHT / DARK / ICE / NONE` は維持する。
`LIGHT` は勇者由来や天界勢、`DARK` は死霊術・魔王由来、`ICE` は一部エリアや上位派生、`NONE` は通常攻撃・無属性追撃に使う。

## 攻撃種別

スキルは属性とは別に `attackType` を持つ。

| 内部ID | 意味 | VFXの基準 |
| --- | --- | --- |
| `SLASH` | 斬撃 | 斜めの軌跡、刃筋、連続斬線 |
| `STRIKE` | 打撃/衝撃 | 地面衝撃、波紋、重いヒット |
| `PROJECTILE` | 弾/射出 | 射出体、着弾、細い軌跡 |
| `MAGIC` | 術式/魔法 | 魔法陣、詠唱円、範囲展開 |
| `SUMMON` | 召喚 | 召喚陣、使役魔の影、霊体介入 |
| `HEAL` | 回復 | 上昇粒子、柔らかい光、状態回復 |

## データ構造

`SkillData` は以下を基本形とする。

```ts
interface SkillData {
  id: string;
  name: string;
  mpCost: number;
  power: number;
  type: 'PHYSICAL' | 'MAGICAL' | 'HEAL';
  element?: ElementType;
  attackType?: SkillAttackType;
  targetType?: 'SINGLE' | 'ALL_ENEMIES' | 'SELF' | 'ALLY';
  effectKey?: string;
  description: string;
}
```

`type` はダメージ計算に使う物理/魔法の軸、`attackType` は演出軸として扱う。
たとえば `雷鳴斬り` は `type: PHYSICAL`, `element: THUNDER`, `attackType: SLASH` になる。
`ライトニング` は `type: MAGICAL`, `element: THUNDER`, `attackType: MAGIC` になる。

## VFX解決順

フロントエンドは以下の順番で演出を解決する。

1. `effectKey` があり専用VFXが登録されている場合は、それを最優先で使う。
2. 専用VFXがない場合は `element x attackType` の共通VFXを使う。
3. `element` がない場合は `NONE` を使う。
4. `attackType` がない場合は、魔法系は `MAGIC`、物理系は `SLASH` にフォールバックする。

この方針により、マスターデータへ先に `effectKey` を記録しておけば、後から個別演出へ差し替えられる。

## BattleEngine連携

`BattleEngine` はスキルIDから `SkillData` を取得し、以下を行う。

1. `mpCost` を確認し、MP不足なら行動ログだけ返す。
2. `type` を物理/魔法ダメージ計算へ渡す。
3. `element` を耐性計算へ渡す。
4. `attackType` と `element` を `BattleLog` に残す。
5. UIは `BattleLog.element` と `BattleLog.attackType` を見て演出を再生できる。

ダメージ計算は既存式を維持する。

```text
最終ダメージ = 基礎計算式 * スキル威力倍率 * 属性耐性補正 * TEC補正 * 会心補正
属性耐性補正 = 1 - (resistance / 100)
```

耐性が `-30` の場合は `1.3` 倍、耐性が `30` の場合は `0.7` 倍になる。

## 現在の実装範囲

- `ElementType` に `WATER / THUNDER / EARTH / WIND` を追加した。
- `SkillAttackType` を追加した。
- `skills.json` に主要5属性のスキルを追加した。
- `jobs.json` で剣士と魔法使いの習得スキルを拡張した。
- `monsters.json` に主要5属性の耐性を追加した。
- `BattleLog` に `element` と `attackType` を追加した。
- `BattleCanvas` のモック戦闘に、属性ごとのスキルボタンと共通VFXオーバーレイを追加した。

## 次に作るべきもの

- `BattleCanvas` のローカルモックスキルを `MasterDataService` 経由の習得スキルに寄せる。
- `effectKey` ごとの専用VFX登録テーブルを作る。
- `SUMMON` と `HEAL` の共通VFXを追加する。
- 弱点/耐性表示をダメージ数字の横に表示する。
- 敵AIにも属性スキルを持たせ、エリアごとの属性学習曲線を作る。
