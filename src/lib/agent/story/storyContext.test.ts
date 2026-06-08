import {
  buildCharacterBible,
  buildAdjacentContext,
  buildStoryContext,
  PROPER_NOUN_GLOSSARY,
  type SceneLike,
  type CharacterLike,
} from './storyContext';

const CHARS: Record<string, CharacterLike> = {
  aldo: { nameJa: 'アルド', expressions: ['default', 'sad'] },
  narrator: { nameJa: '', expressions: [] },
};

const SCENES: SceneLike[] = [
  { id: 'S1', type: 'DIALOGUE', archiveTitle: '出発', lines: [{ speaker: 'aldo', text: '行こう。' }, { speaker: null, text: '夜が明けた。' }] },
  { id: 'S2', type: 'MONOLOGUE', archiveTitle: '回想', lines: [{ speaker: 'aldo', text: 'あの日のことを思い出す。' }] },
  { id: 'S3', type: 'ENVIRONMENT', archiveTitle: '廃城', lines: [{ speaker: null, text: '崩れた城壁が見える。' }] },
];

describe('buildCharacterBible', () => {
  it('mines example lines per speaker from existing scenes', () => {
    const bible = buildCharacterBible(CHARS, SCENES);
    expect(bible).toContain('aldo（アルド）');
    expect(bible).toContain('行こう。');
    expect(bible).toContain('あの日のことを思い出す。');
    // narrator は speaker null の台詞を拾う
    expect(bible).toContain('夜が明けた。');
  });

  it('limits examples per character', () => {
    const many: SceneLike[] = [
      { lines: [{ speaker: 'aldo', text: 'a' }, { speaker: 'aldo', text: 'b' }, { speaker: 'aldo', text: 'c' }, { speaker: 'aldo', text: 'd' }] },
    ];
    const bible = buildCharacterBible(CHARS, many, 2);
    const count = (bible.match(/「[abcd]」/g) ?? []).length;
    expect(count).toBe(2);
  });
});

describe('buildAdjacentContext', () => {
  it('summarizes previous and next scenes around the insertion point', () => {
    const ctx = buildAdjacentContext(SCENES, 'S2', 2);
    expect(ctx).toContain('直前のシーン:');
    expect(ctx).toContain('S1');
    expect(ctx).toContain('S2');
    expect(ctx).toContain('直後のシーン:');
    expect(ctx).toContain('S3'); // S2 の次
  });

  it('handles insertion at end (no next scene)', () => {
    const ctx = buildAdjacentContext(SCENES, 'S3', 2);
    expect(ctx).toContain('S3');
    expect(ctx).not.toContain('直後のシーン:');
  });

  it('defaults to tail when insertAfterId is null', () => {
    const ctx = buildAdjacentContext(SCENES, null, 1);
    expect(ctx).toContain('S3');
  });
});

describe('buildStoryContext', () => {
  it('combines bible, flow and glossary', () => {
    const full = buildStoryContext({ characters: CHARS, allScenes: SCENES, packScenes: SCENES, insertAfterId: 'S1' });
    expect(full).toContain('キャラバイブル');
    expect(full).toContain('直前/直後の流れ');
    expect(full).toContain('固有名詞');
    expect(full).toContain(PROPER_NOUN_GLOSSARY[0].split(' ')[0]); // 亡国の王都
  });
});
