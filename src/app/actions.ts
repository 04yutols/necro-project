'use server';

import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { RewardService, StageDropResult } from '@/services/RewardService';
import { MasterDataService } from '@/services/MasterDataService';

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
  error?:    string;
}

function emptyDrop(): StageDropResult {
  return { weapons: [], residues: [], materials: [], monsters: [] };
}

/**
 * ステージクリア後のリザルト処理。
 * 未ログイン時はゲスト動作（クライアント側ドロップのみ、DB保存なし）。
 * ログイン済み時はサーバー側でドロップ抽選 + DB保存を行う。
 */
export async function processStageResultAction(stageId: string): Promise<StageResultPayload> {
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
    };
  }

  if (!stage) {
    return { success: false, dropResult: emptyDrop(), expGain: 0, goldGain: 0, error: 'Stage not found' };
  }

  // Character 取得（userId で紐付け）
  const char = await prisma.character.findFirst({
    where: { userId: session.user.id },
    include: { jobs: true },
  });
  if (!char) {
    // キャラクター未作成のゲスト的挙動にフォールバック
    const dropResult = svc.processDropTable(stage.rewards.dropTable);
    return { success: true, dropResult, expGain: stage.rewards.baseExp, goldGain: stage.rewards.baseGold };
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

  // DB 保存（トランザクション）
  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    // 武器保存
    for (const weapon of dropResult.weapons) {
      await tx.item.create({
        data: {
          name:          weapon.name,
          type:          weapon.type,
          rarity:        weapon.rarity,
          rank:          weapon.rank ?? 0,
          archetype:     weapon.archetype ?? null,
          ilv:           weapon.ilv ?? null,
          passiveA:      weapon.passiveA  as any ?? undefined,
          passiveB:      weapon.passiveB  as any ?? undefined,
          subOptions:    weapon.subOptions as any ?? undefined,
          isUnique:      weapon.isUnique,
        },
      });
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
  });

  return { success: true, dropResult, expGain, goldGain };
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
