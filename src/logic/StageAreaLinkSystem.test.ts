import {
  applyStageAreaSelection,
  buildStageAreaStageGroups,
  buildStageDependencyOptions,
  buildStageAreaOptions,
  generateStageMasterId,
  getNextAreaDraft,
  getStageAreaMasterId,
  resolveStageArea,
  suggestStagePosition,
} from './StageAreaLinkSystem';

const AREA_RECORDS = {
  ch2_area2: {
    id: 'ch2_area2',
    chapter: 2,
    area: 2,
    nameJa: '幽霊都市',
    nameEn: 'PHANTOM CITY',
    description: '2章の仮エリア',
    color: '#38BDF8',
    sortOrder: 202,
  },
  ch1_area1: {
    id: 'ch1_area1',
    chapter: 1,
    area: 1,
    nameJa: '亡国の王都',
    nameEn: 'FALLEN ROYAL CAPITAL',
    description: '1章の開始エリア',
    color: '#8A2BE2',
    sortOrder: 101,
  },
};

const STAGE_RECORDS = {
  area1_safe: {
    id: 'area1_safe',
    nameJa: '亡者の前哨陣',
    chapter: 1,
    area: 1,
    nodeType: 'SAFE',
    difficulty: 0,
    position: { x: 188, y: 508 },
    unlockRequires: [],
  },
  area1_node1: {
    id: 'area1_node1',
    nameJa: '王都外縁の墓道',
    chapter: 1,
    area: 1,
    nodeType: 'DUNGEON',
    difficulty: 1,
    position: { x: 188, y: 422 },
    unlockRequires: [],
  },
  area1_node2: {
    id: 'area1_node2',
    nameJa: '煤けた王城の地下牢',
    chapter: 1,
    area: 1,
    nodeType: 'DUNGEON',
    difficulty: 2,
    position: { x: 102, y: 326 },
    unlockRequires: ['area1_node1'],
  },
  area1_node3: {
    id: 'area1_node3',
    nameJa: '血沼の渡し',
    chapter: 1,
    area: 1,
    nodeType: 'DUNGEON',
    difficulty: 4,
    position: { x: 140, y: 182 },
    unlockRequires: ['area1_boss'],
  },
  area1_boss: {
    id: 'area1_boss',
    nameJa: '竜骨祭壇',
    chapter: 1,
    area: 1,
    nodeType: 'BOSS',
    difficulty: 3,
    position: { x: 246, y: 265 },
    unlockRequires: ['area1_node2'],
  },
  area2_gate: {
    id: 'area2_gate',
    nameJa: '幽霊都市の城門',
    chapter: 2,
    area: 2,
    nodeType: 'DUNGEON',
    difficulty: 5,
    position: { x: 254, y: 94 },
    unlockRequires: ['area1_node3'],
  },
};

describe('StageAreaLinkSystem', () => {
  test('builds the canonical area id from stage chapter and area', () => {
    expect(getStageAreaMasterId({ chapter: 2, area: 2 })).toBe('ch2_area2');
    expect(getStageAreaMasterId({ chapter: 1, area: 1 })).toBe('ch1_area1');
  });

  test('sorts area options by sortOrder and chapter area fallback', () => {
    const options = buildStageAreaOptions(AREA_RECORDS);

    expect(options.map(option => option.id)).toEqual(['ch1_area1', 'ch2_area2']);
  });

  test('suggests the next area id from existing area masters', () => {
    expect(getNextAreaDraft(AREA_RECORDS)).toEqual({
      id: 'ch2_area3',
      chapter: 2,
      area: 3,
      sortOrder: 203,
    });
  });

  test('resolves a stage to its linked area option', () => {
    const options = buildStageAreaOptions(AREA_RECORDS);

    expect(resolveStageArea({ chapter: 2, area: 2 }, options)).toMatchObject({
      id: 'ch2_area2',
      nameJa: '幽霊都市',
    });
  });

  test('returns null when the stage points at an unregistered area', () => {
    const options = buildStageAreaOptions(AREA_RECORDS);

    expect(resolveStageArea({ chapter: 3, area: 1 }, options)).toBeNull();
  });

  test('applies selected area values to a stage form without changing unrelated fields', () => {
    const options = buildStageAreaOptions(AREA_RECORDS);
    const form = { chapter: 1, area: 1, difficulty: 4, nameJa: '仮ステージ' };

    expect(applyStageAreaSelection(form, options[1])).toEqual({
      chapter: 2,
      area: 2,
      difficulty: 4,
      nameJa: '仮ステージ',
    });
  });

  test('generates a canonical dungeon stage id after legacy node ids', () => {
    expect(generateStageMasterId({ chapter: 1, area: 1, nodeType: 'DUNGEON' }, STAGE_RECORDS)).toBe('ch1_area1_node4');
  });

  test('generates boss and safe ids without reusing existing semantic slots', () => {
    expect(generateStageMasterId({ chapter: 1, area: 1, nodeType: 'BOSS' }, STAGE_RECORDS)).toBe('ch1_area1_boss2');
    expect(generateStageMasterId({ chapter: 1, area: 1, nodeType: 'SAFE' }, STAGE_RECORDS)).toBe('ch1_area1_safe2');
  });

  test('builds sorted dependency options and can exclude the current stage', () => {
    const options = buildStageDependencyOptions(STAGE_RECORDS, 'area1_node1');

    expect(options.map(option => option.id)).toEqual([
      'area1_safe',
      'area1_node2',
      'area1_boss',
      'area1_node3',
      'area2_gate',
    ]);
  });

  test('suggests a position above the selected dependency stage', () => {
    const position = suggestStagePosition({
      id: 'draft',
      chapter: 1,
      area: 1,
      nodeType: 'DUNGEON',
      unlockRequires: ['area1_node3'],
    }, STAGE_RECORDS);

    expect(position).toEqual({ x: 64, y: 96 });
  });

  test('fans out sibling nodes from the same dependency', () => {
    const position = suggestStagePosition({
      id: 'draft',
      chapter: 1,
      area: 1,
      nodeType: 'DUNGEON',
      unlockRequires: ['area1_node1'],
    }, STAGE_RECORDS);

    expect(position).toEqual({ x: 102, y: 336 });
  });

  test('groups stages by registered area order', () => {
    const groups = buildStageAreaStageGroups(STAGE_RECORDS, AREA_RECORDS);

    expect(groups.map(group => group.areaId)).toEqual(['ch1_area1', 'ch2_area2']);
    expect(groups[0].stages.map(stage => stage.id)).toEqual([
      'area1_safe',
      'area1_node1',
      'area1_node2',
      'area1_boss',
      'area1_node3',
    ]);
  });
});
