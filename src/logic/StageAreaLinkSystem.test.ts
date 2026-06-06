import {
  applyStageAreaSelection,
  buildStageAreaOptions,
  getStageAreaMasterId,
  resolveStageArea,
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

describe('StageAreaLinkSystem', () => {
  test('builds the canonical area id from stage chapter and area', () => {
    expect(getStageAreaMasterId({ chapter: 2, area: 2 })).toBe('ch2_area2');
    expect(getStageAreaMasterId({ chapter: 1, area: 1 })).toBe('ch1_area1');
  });

  test('sorts area options by sortOrder and chapter area fallback', () => {
    const options = buildStageAreaOptions(AREA_RECORDS);

    expect(options.map(option => option.id)).toEqual(['ch1_area1', 'ch2_area2']);
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
});
