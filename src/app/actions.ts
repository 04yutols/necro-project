'use server';

// GameManagerのモック的役割を果たすサーバーアクション
export async function fetchPlayerAction(characterId: string) {
  // 本来はここから GameManager を呼び出し、PrismaでDBから取得する
  return {
    success: true,
    data: {
      id: characterId,
      name: 'アルド',
      stats: { hp: 100, mp: 20 },
      // ...
    }
  };
}

export async function processGrowthAction(characterId: string, type: 'RANK_UP' | 'CHANGE_JOB') {
  // 成長処理のモック
  return { success: true, message: `${type} completed.` };
}

export async function soulStoneAction(monsterId: string) {
  // GameManagerを介した魂石化 (モック)
  const id = `shard-${Math.random().toString(36).substr(2, 9)}`;
  return { success: true, data: { id, originMonsterName: 'Goblin', effect: { atkBonus: 5, matkBonus: 0 } } };
}

export async function updatePartyAction(characterId: string, monsterIds: (string | null)[]) {
  // パーティ編成の更新
  return { success: true };
}

export async function equipShardAction(monsterId: string, shardId: string) {
  // GameManagerを介した装備
  return { success: true };
}

export async function equipItemAction(characterId: string, slot: string, itemId: string) {
  // GameManagerを介したアイテム装備
  return { success: true };
}

export async function unequipItemAction(characterId: string, slot: string) {
  // GameManagerを介したアイテム装備解除
  return { success: true };
}
