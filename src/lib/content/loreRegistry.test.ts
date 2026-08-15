import { validateLoreRegistry, type LoreRegistry } from './loreRegistry';

function registry(): LoreRegistry {
  return {
    schemaVersion: 1,
    updatedAt: '2026-07-31T00:00:00.000Z',
    entries: [
      {
        id: 'aldo',
        kind: 'CHARACTER',
        certainty: 'CONFIRMED',
        nameJa: 'アルド',
        nameEn: 'Aldo',
        aliases: [],
        summary: '死霊術の力を継いだ主人公。',
        chapterIntroduced: 0,
        sourceRefs: ['src/data/story/characters.json#/aldo'],
        tags: ['主人公'],
      },
      {
        id: 'royal_capital',
        kind: 'PLACE',
        certainty: 'CONFIRMED',
        nameJa: '亡国の王都',
        aliases: ['王都'],
        summary: '第1章の舞台。',
        chapterIntroduced: 1,
        sourceRefs: ['docs/progress/CH1_TODO.md'],
        tags: ['第1章'],
      },
    ],
    relationships: [],
    timeline: [
      {
        id: 'arrival_at_capital',
        order: 100,
        chapter: 1,
        title: '王都へ',
        summary: 'アルドが王都へ入る。',
        participantRefs: ['aldo'],
        locationRef: 'royal_capital',
        certainty: 'CONFIRMED',
        sourceRefs: ['src/data/story/ch1_scenes.json'],
      },
    ],
  };
}

describe('validateLoreRegistry', () => {
  test('構造化された人物・場所・時系列の参照を検証する', () => {
    const findings = validateLoreRegistry(registry());
    expect(findings.filter(finding => finding.level === 'FAIL')).toEqual([]);
  });

  test('存在しない人物や場所への参照を拒否する', () => {
    const value = registry();
    value.timeline[0].participantRefs = ['missing_character'];
    value.timeline[0].locationRef = 'missing_place';
    const findings = validateLoreRegistry(value);
    expect(findings.some(finding => finding.level === 'FAIL' && finding.field === 'participantRefs')).toBe(true);
    expect(findings.some(finding => finding.level === 'FAIL' && finding.field === 'locationRef')).toBe(true);
  });

  test('schemaにないフィールドを拒否する', () => {
    const value = registry() as LoreRegistry & { unexpected?: string };
    value.unexpected = 'drift';
    const findings = validateLoreRegistry(value);
    expect(findings.some(finding => finding.level === 'FAIL' && finding.field === 'unexpected')).toBe(true);
  });
});
