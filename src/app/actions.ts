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
