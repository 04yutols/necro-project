/**
 * ストーリー生成エージェントの「物語コンテキスト」構築（LLM 不使用の純関数）。
 *
 * 設計書 104 §4.2: キャラの口調・世界観はバリデータでは測れない。豊富なコンテキストで担保する。
 *  - キャラバイブル: characters.json + 既存シーンから抽出した実台詞例（= データ駆動の口調見本）
 *  - 前後シーン: 挿入位置の流れ
 *  - 固有名詞集: 表記ゆれ防止
 */

export type SceneLike = {
  id?: string;
  type?: string;
  archiveTitle?: string;
  lines?: { speaker?: string | null; text?: string }[];
};
export type CharacterLike = { nameJa?: string; nameEn?: string; expressions?: string[] };

/** 固有名詞グロッサリ（表記統一）。 */
export const PROPER_NOUN_GLOSSARY = [
  '亡国の王都 / Fallen Royal Capital',
  'ネクロマンス（死霊術。倒した敵を使役に変える）',
  '魔神化（職業の一時的強化形態）',
  '魂ゲージ / 魂の共鳴',
  'アルド（主人公）/ ライン / 魔王',
];

/**
 * 各キャラの「口調見本」を既存シーンの実台詞から抽出してバイブルを組む。
 */
export function buildCharacterBible(
  characters: Record<string, CharacterLike>,
  allScenes: SceneLike[],
  maxExamplesPerChar = 3,
): string {
  // speaker → 台詞例
  const examples: Record<string, string[]> = {};
  for (const scene of allScenes) {
    for (const ln of scene.lines ?? []) {
      const sp = ln.speaker ?? 'narrator';
      if (typeof ln.text !== 'string' || ln.text.trim() === '') continue;
      examples[sp] ??= [];
      if (examples[sp].length < maxExamplesPerChar) {
        examples[sp].push(ln.text.replace(/\n/g, ' ').trim());
      }
    }
  }

  const blocks = Object.entries(characters).map(([id, c]) => {
    const name = c.nameJa || (id === 'narrator' ? 'ナレーション' : id);
    const exprs = (c.expressions ?? []).join(' / ') || '（なし）';
    const lines = (examples[id] ?? []).map((t) => `    「${t}」`).join('\n') || '    （台詞例なし）';
    return `- ${id}（${name}）表情: ${exprs}\n  口調見本:\n${lines}`;
  });
  return blocks.join('\n');
}

/**
 * 挿入位置の前 N シーン・後 1 シーンを要約して流れの文脈を作る。
 * insertAfterId が見つかればその直後に挿入する想定。見つからなければ末尾。
 */
export function buildAdjacentContext(
  packScenes: SceneLike[],
  insertAfterId: string | null,
  prevCount = 2,
): string {
  const idx = insertAfterId ? packScenes.findIndex((s) => s.id === insertAfterId) : packScenes.length - 1;
  const anchor = idx >= 0 ? idx : packScenes.length - 1;

  const prev = packScenes.slice(Math.max(0, anchor - prevCount + 1), anchor + 1);
  const next = packScenes[anchor + 1];

  const summarize = (s: SceneLike): string => {
    const head = `  [${s.id ?? '?'} / ${s.type ?? '?'}] ${s.archiveTitle ?? ''}`;
    const firstLines = (s.lines ?? [])
      .slice(0, 2)
      .map((l) => `${l.speaker ?? 'ナレ'}: ${(l.text ?? '').replace(/\n/g, ' ').slice(0, 40)}`)
      .join(' / ');
    return firstLines ? `${head}\n    ${firstLines}` : head;
  };

  const parts: string[] = [];
  parts.push('直前のシーン:');
  parts.push(prev.length ? prev.map(summarize).join('\n') : '  （なし）');
  if (next) {
    parts.push('直後のシーン:');
    parts.push(summarize(next));
  }
  return parts.join('\n');
}

/** プロンプトに添える物語コンテキスト全体を組む。 */
export function buildStoryContext(input: {
  characters: Record<string, CharacterLike>;
  allScenes: SceneLike[];
  packScenes: SceneLike[];
  insertAfterId: string | null;
}): string {
  return [
    '# キャラバイブル（口調・表情を厳守）',
    buildCharacterBible(input.characters, input.allScenes),
    '',
    '# 直前/直後の流れ（連続性を保つ）',
    buildAdjacentContext(input.packScenes, input.insertAfterId),
    '',
    '# 固有名詞（表記を統一）',
    PROPER_NOUN_GLOSSARY.map((g) => `- ${g}`).join('\n'),
  ].join('\n');
}
