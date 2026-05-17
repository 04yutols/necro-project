'use server';

import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { RewardService, StageDropResult } from '@/services/RewardService';
import { MasterDataService } from '@/services/MasterDataService';
import { RankingService } from '@/services/RankingService';
import { createWorldEvent, publishWorldEvents } from '@/services/WorldEventService';
import { calculateResidueScore } from '@/logic/ResidueScore';
import type { AbyssalResidueData, ItemData, WeaponRarity } from '@/types/game';
import type { OnlineStageRecordSummary, StageResultMeta, WorldEventType, WorldLogEntry } from '@/types/online';

// ── ユーザー登録 ──────────────────────────────────────────────────────────────

export interface SignUpResult {
  success: boolean;
  error?:  string;
}

export async function signUpAction(
  email:       string,
  password:    string,
  displayName: string,
): Promise<SignUpResult> {
  if (!email || !password || !displayName) {
    return { success: false, error: '全ての項目を入力してください' };
  }
  if (password.length < 8) {
    return { success: false, error: 'パスワードは8文字以上にしてください' };
  }
  if (displayName.length < 2 || displayName.length > 16) {
    return { success: false, error: 'プレイヤー名は2〜16文字にしてください' };
  }

  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) {
    return { success: false, error: 'このメールアドレスは既に登録されています' };
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.user.create({
    data: { email, passwordHash, displayName, name: displayName },
  });

  return { success: true };
}

export interface StageResultPayload {
  success:   boolean;
  dropResult: StageDropResult;
  expGain:   number;
  goldGain:  number;
  cloudSaved?: boolean;
  stageRecord?: OnlineStageRecordSummary;
  worldEvents?: WorldLogEntry[];
  error?:    string;
}

function emptyDrop(): StageDropResult {
  return { weapons: [], residues: [], materials: [], monsters: [] };
}

const DISCOVERY_RARITIES = new Set<ItemData['rarity']>(['SSR', 'UR', 'LR', 'UNIQUE', 'HIDDEN_UNIQUE']);

function getPlayerDisplayName(sessionUser: { name?: string | null; email?: string | null }) {
  return sessionUser.name ?? sessionUser.email ?? '名もなき死霊術師';
}

function isDiscoveryWeapon(weapon: ItemData): boolean {
  return weapon.isUnique || DISCOVERY_RARITIES.has(weapon.rarity);
}

function eventTypeForWeapon(weapon: ItemData): WorldEventType {
  return weapon.isUnique || weapon.rarity === 'UR' || weapon.rarity === 'UNIQUE' || weapon.rarity === 'HIDDEN_UNIQUE'
    ? 'UR_DISCOVERED'
    : 'SSR_DISCOVERED';
}

function weaponRarityForPayload(weapon: ItemData): WeaponRarity | ItemData['rarity'] {
  return weapon.weaponRarity ?? (weapon.rarity as WeaponRarity | ItemData['rarity']);
}

function toResidueData(row: {
  id: string;
  name: string;
  itemId: string;
  rarity: string;
  mainStat: Prisma.JsonValue;
  subOptions: Prisma.JsonValue;
  level: number;
  exp: number;
  maxExp: number;
}): AbyssalResidueData {
  return {
    id: row.id,
    name: row.name,
    itemId: row.itemId,
    rarity: row.rarity as AbyssalResidueData['rarity'],
    mainStat: row.mainStat as AbyssalResidueData['mainStat'],
    subOptions: row.subOptions as unknown as AbyssalResidueData['subOptions'],
    level: row.level,
    exp: row.exp,
    maxExp: row.maxExp,
  };
}

function toItemData(row: {
  id: string;
  name: string;
  type: string;
  rarity: string;
  atk: number;
  def: number;
  critRate: number;
  critDmg: number;
  spd: number;
  specialEffect: string | null;
  rank: number;
  archetype: string | null;
  ilv: number | null;
  passiveA: Prisma.JsonValue | null;
  passiveB: Prisma.JsonValue | null;
  subOptions: Prisma.JsonValue | null;
  isUnique: boolean;
  discovererId: string | null;
  discovererName: string | null;
  serialNo: number | null;
  discoveredAt: Date | null;
}): ItemData {
  return {
    id: row.id,
    name: row.name,
    type: row.type as ItemData['type'],
    rarity: row.rarity as ItemData['rarity'],
    stats: {
      atk: row.atk,
      def: row.def,
      critRate: row.critRate,
      critDmg: row.critDmg,
      spd: row.spd,
    },
    specialEffect: row.specialEffect ?? undefined,
    rank: row.rank,
    archetype: row.archetype as ItemData['archetype'],
    ilv: row.ilv ?? undefined,
    passiveA: row.passiveA as unknown as ItemData['passiveA'],
    passiveB: row.passiveB as unknown as ItemData['passiveB'],
    subOptions: row.subOptions as unknown as ItemData['subOptions'],
    isUnique: row.isUnique,
    discovererId: row.discovererId ?? undefined,
    discovererName: row.discovererName ?? undefined,
    serialNo: row.serialNo ?? undefined,
    discoveredAt: row.discoveredAt?.toISOString(),
  };
}

/**
 * ステージクリア後のリザルト処理。
 * 未ログイン時はゲスト動作（クライアント側ドロップのみ、DB保存なし）。
 * ログイン済み時はサーバー側でドロップ抽選 + DB保存を行う。
 */
export async function processStageResultAction(stageId: string, meta: StageResultMeta = {}): Promise<StageResultPayload> {
  const mds   = MasterDataService.getInstance();
  const stage = mds.getStage(stageId);
  const svc   = new RewardService();

  // ゲスト動作: セッションなしはクライアント side のみ
  const session = await auth().catch(() => null);
  if (!session?.user?.id) {
    const dropResult = svc.processDropTable(stage?.rewards.dropTable ?? []);
    return {
      success:   true,
      dropResult,
      expGain:   stage?.rewards.baseExp  ?? 0,
      goldGain:  stage?.rewards.baseGold ?? 0,
      cloudSaved: false,
    };
  }

  if (!stage) {
    return { success: false, dropResult: emptyDrop(), expGain: 0, goldGain: 0, error: 'Stage not found' };
  }
  const userId = session.user.id;
  const sessionUser = session.user;

  // Character 取得（userId で紐付け）
  const char = await prisma.character.findFirst({
    where: { userId },
    include: { jobs: true },
  });
  if (!char) {
    // キャラクター未作成のゲスト的挙動にフォールバック
    const dropResult = svc.processDropTable(stage.rewards.dropTable);
    return { success: true, dropResult, expGain: stage.rewards.baseExp, goldGain: stage.rewards.baseGold, cloudSaved: false };
  }

  // EXP 計算
  const playerForExp: Parameters<RewardService['calculateExp']>[1] = {
    category:     'PHYSICAL',
    currentJobId: char.currentJobId ?? 'warrior',
    jobs:         (char.jobs as any[]).map(j => ({ jobId: j.jobId, level: j.level, exp: j.exp })),
  } as any;
  const expGain  = svc.calculateExp(stage.rewards.baseExp, playerForExp);
  const goldGain = stage.rewards.baseGold;

  // ドロップ抽選（サーバー側で確定）
  const dropResult = svc.processDropTable(stage.rewards.dropTable);
  const bestResidueScore = Math.max(0, ...dropResult.residues.map(residue => calculateResidueScore(residue)));
  const playerName = getPlayerDisplayName(sessionUser);

  // DB 保存（トランザクション）
  const transactionResult = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const worldEvents: WorldLogEntry[] = [];

    // 武器保存
    for (const weapon of dropResult.weapons) {
      const isDiscoverable = isDiscoveryWeapon(weapon);
      const existingDiscovery = isDiscoverable
        ? await tx.item.findFirst({
            where: {
              name: weapon.name,
              rarity: weapon.rarity,
              discovererId: { not: null },
            },
            select: { id: true },
          })
        : null;
      const serialNo = isDiscoverable
        ? (await tx.itemSerialCounter.upsert({
            where: { itemName: weapon.name },
            update: { counter: { increment: 1 } },
            create: { itemName: weapon.name, counter: 1 },
            select: { counter: true },
          })).counter
        : undefined;
      const isFirstDiscovery = isDiscoverable && !existingDiscovery;
      const discoveredAt = isFirstDiscovery ? new Date() : null;

      await tx.item.create({
        data: {
          name:          weapon.name,
          type:          weapon.type,
          rarity:        weapon.rarity,
          ownerId:       userId,
          atk:           Math.round(weapon.stats?.atk ?? 0),
          def:           Math.round(weapon.stats?.def ?? 0),
          critRate:      weapon.stats?.critRate ?? 0,
          critDmg:       weapon.stats?.critDmg ?? 0,
          spd:           Math.round(weapon.stats?.spd ?? 0),
          specialEffect: weapon.specialEffect ?? null,
          rank:          weapon.rank ?? 0,
          archetype:     weapon.archetype ?? null,
          ilv:           weapon.ilv ?? null,
          passiveA:      weapon.passiveA ? (weapon.passiveA as unknown as Prisma.InputJsonValue) : undefined,
          passiveB:      weapon.passiveB ? (weapon.passiveB as unknown as Prisma.InputJsonValue) : undefined,
          subOptions:    weapon.subOptions ? (weapon.subOptions as unknown as Prisma.InputJsonValue) : undefined,
          isUnique:      weapon.isUnique,
          discovererId:  isFirstDiscovery ? userId : null,
          discovererName: isFirstDiscovery ? playerName : null,
          discoveredAt,
          serialNo,
        },
      });

      if (serialNo) weapon.serialNo = serialNo;
      if (isFirstDiscovery) {
        weapon.discovererId = userId;
        weapon.discovererName = playerName;
        weapon.discoveredAt = discoveredAt?.toISOString();
        worldEvents.push(await createWorldEvent(tx, eventTypeForWeapon(weapon), {
          playerName,
          itemName: weapon.name,
          rarity: weaponRarityForPayload(weapon),
          serialNo,
          isUnique: weapon.isUnique,
        }, userId));
      }
    }

    // 残滓保存
    for (const residue of dropResult.residues) {
      await tx.abyssalResidue.create({
        data: {
          name:        residue.name,
          itemId:      residue.itemId,
          characterId: char.id,
          rarity:      residue.rarity,
          mainStat:    residue.mainStat  as any,
          subOptions:  residue.subOptions as any,
          level:       residue.level,
          exp:         residue.exp,
          maxExp:      residue.maxExp,
        },
      });
    }

    // EXP 加算
    const currentJob = (char.jobs as any[]).find(j => j.jobId === char.currentJobId);
    if (currentJob) {
      const newExp   = currentJob.exp + expGain;
      const newLevel = Math.min(99, Math.floor(newExp / 100) + 1);
      await tx.userJob.update({
        where: { characterId_jobId: { characterId: char.id, jobId: char.currentJobId! } },
        data:  { exp: newExp, level: newLevel },
      });
    }

    // ステージクリアフラグ
    if (!char.clearedStages.includes(stageId)) {
      await tx.character.update({
        where: { id: char.id },
        data:  { clearedStages: { push: stageId } },
      });
    }

    const isBossStage = stage.nodeType === 'BOSS' || Boolean(stage.isAreaBoss);
    const isWorldFirstBossClear = isBossStage && !(await tx.stageRecord.findFirst({
      where: { stageId },
      select: { id: true },
    }));
    const stageRecord = await RankingService.recordStageClear(tx, {
      userId,
      stageId,
      turnCount: meta.turnCount,
      clearTimeSec: meta.clearTimeSec,
      totalDamage: meta.totalDamage,
      isBossStage,
      bestResidueScore,
    });

    if (isWorldFirstBossClear) {
      worldEvents.push(await createWorldEvent(tx, 'BOSS_CLEARED', {
        playerName,
        stageId,
        stageName: stage.nameJa ?? stage.name ?? stageId,
      }, userId));
    }
    if (stageRecord.becameTopResidue && bestResidueScore > 0) {
      worldEvents.push(await createWorldEvent(tx, 'RANKING_UPDATED', {
        playerName,
        rankingName: '残滓スコア',
        value: bestResidueScore,
      }, userId));
    }

    return { stageRecord, worldEvents };
  });

  await RankingService.invalidate();
  await publishWorldEvents(transactionResult.worldEvents);

  return {
    success: true,
    dropResult,
    expGain,
    goldGain,
    cloudSaved: true,
    stageRecord: transactionResult.stageRecord,
    worldEvents: transactionResult.worldEvents,
  };
}

export async function loadGameStateAction() {
  const session = await auth().catch(() => null);
  if (!session?.user?.id) {
    return { success: false, error: 'ログインが必要です' };
  }

  const character = await prisma.character.findFirst({
    where: { userId: session.user.id },
    include: { jobs: true, abyssalResidues: true },
  });
  const inventoryItems = await prisma.item.findMany({
    where: { ownerId: session.user.id },
    orderBy: { id: 'desc' },
  });

  return {
    success: true,
    character,
    inventoryItems: inventoryItems.map(toItemData),
    abyssalResidues: (character?.abyssalResidues ?? []).map(toResidueData),
  };
}

export async function fetchPlayerAction(characterId: string) {
  return {
    success: true,
    data: {
      id:    characterId,
      name:  'アルド',
      stats: { hp: 100, atk: 20, def: 10, spd: 100, critRate: 5, critDmg: 150, effectHit: 0, effectRes: 0 },
    },
  };
}

export async function processGrowthAction(characterId: string, type: 'RANK_UP' | 'CHANGE_JOB') {
  return { success: true, message: `${type} completed.` };
}

export async function soulStoneAction(monsterId: string) {
  const id = `shard-${Math.random().toString(36).substr(2, 9)}`;
  return { success: true, data: { id, originMonsterName: 'Goblin', effect: { atkBonus: 5, elementDmgBoost: 0 } } };
}

export async function updatePartyAction(characterId: string, monsterIds: (string | null)[]) {
  return { success: true };
}

export async function equipShardAction(monsterId: string, shardId: string) {
  return { success: true };
}

export async function equipItemAction(characterId: string, slot: string, itemId: string) {
  return { success: true };
}

export async function unequipItemAction(characterId: string, slot: string) {
  return { success: true };
}
