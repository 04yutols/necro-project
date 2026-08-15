import { contentChangeDataForMaster, validateContentBundle, type ContentValidationContext } from './contentBundle';

const ctx: ContentValidationContext = {
  characters: { narrator: { id: 'narrator', expressions: [] } },
  storySceneIds: new Set(),
  storyPackIds: new Set(['act1_ch1']),
  stageIds: new Set(['area1_node1']),
  areaIds: new Set(['ch1_area1']),
  items: {},
  enemies: {},
  monsters: {},
  skills: {},
  jobs: {},
  materials: {},
  residueNames: {},
};

test('normalizes key-owned job and monster IDs before master apply', () => {
  expect(contentChangeDataForMaster({ scope: 'monster', id: 'shade', data: { id: 'shade', name: 'Shade' } })).toEqual({ name: 'Shade' });
  expect(contentChangeDataForMaster({ scope: 'job', id: 'reaper', data: { id: 'reaper', name: 'Reaper' } })).toEqual({ name: 'Reaper' });
  expect(contentChangeDataForMaster({ scope: 'skill', id: 'cut', data: { id: 'cut', name: 'Cut' } })).toEqual({ id: 'cut', name: 'Cut' });
});

function bundle(changes: unknown[]) {
  return {
    schemaVersion: 1,
    id: 'royal_capital_echoes',
    title: '王都の残響',
    chapter: 1,
    creativeBrief: { themes: ['喪失'], mustInclude: ['死者の記憶'], avoid: ['現代語'] },
    changes,
  };
}

describe('validateContentBundle', () => {
  test('同一バンドルで追加する人物をシーンから参照できる', () => {
    const findings = validateContentBundle(bundle([
      { scope: 'story-character', id: 'grave_keeper', data: { id: 'grave_keeper', nameJa: '墓守', nameEn: 'Grave Keeper', color: '#8B00FF', glow: 'rgba(139,0,255,0.5)', portraitBase: '/images/story/grave_keeper', expressions: ['default'] } },
      { scope: 'story-scene', id: 'CH1_GRAVE_KEEPER', packId: 'act1_ch1', data: { id: 'CH1_GRAVE_KEEPER', type: 'DIALOGUE', trigger: { type: 'STAGE_ENTER', stageId: 'area1_node1' }, lines: [{ speaker: 'grave_keeper', text: '死者は、まだ王の帰還を待っている。', textEn: 'The dead still await their king.', expression: 'default' }], isSkippable: true, archiveTitle: '墓守', archiveChapter: 1 } },
    ]), ctx);
    expect(findings.filter(f => f.level === 'FAIL')).toEqual([]);
  });

  test('既存IDの上書きと不明な参照を拒否する', () => {
    const findings = validateContentBundle(bundle([
      { scope: 'story-character', id: 'narrator', data: { id: 'narrator' } },
      { scope: 'story-scene', id: 'CH1_BAD', packId: 'missing', data: { id: 'CH1_BAD', type: 'DIALOGUE', trigger: { type: 'STAGE_ENTER', stageId: 'missing' }, lines: [], isSkippable: true, archiveTitle: 'bad', archiveChapter: 1 } },
    ]), ctx);
    expect(findings.some(f => f.level === 'FAIL' && f.message.includes('重複'))).toBe(true);
    expect(findings.some(f => f.level === 'FAIL' && f.field === 'packId')).toBe(true);
    expect(findings.some(f => f.level === 'FAIL' && f.field === 'trigger.stageId')).toBe(true);
  });

  test('残滓名称バンドルから性能値を変更できない', () => {
    const findings = validateContentBundle(bundle([
      { scope: 'residue-name', id: 'fallen_crown_ash', data: { id: 'fallen_crown_ash', name: '落冠の灰', rarity: 'EPIC', chapter: 1, origin: '戴冠式の炎に残った灰。', tags: ['亡国'], mainStat: { type: 'ATK%', value: 99 } } },
    ]), ctx);
    expect(findings.some(f => f.level === 'FAIL' && f.field === 'mainStat')).toBe(true);
  });
});
