import {
  CH1_FINAL_NODE_ID,
  getYomiFloorNumber,
  getYomiMilestoneFloorForFirstClear,
  isYomiArea,
  isYomiStage,
} from './YomiFloors';

describe('YomiFloors', () => {
  test('isYomiStage recognizes yomi_b floor ids', () => {
    expect(isYomiStage('yomi_b01')).toBe(true);
    expect(isYomiStage('yomi_b20')).toBe(true);
    expect(isYomiStage('yomi_b1')).toBe(true);
    expect(isYomiStage('yomi_b100')).toBe(true);

    expect(isYomiStage('area1_node3')).toBe(false);
    expect(isYomiStage('yomi_boss1')).toBe(false);
    expect(isYomiStage('yomi_b')).toBe(false);
    expect(isYomiStage('yomi_b1x')).toBe(false);
    expect(isYomiStage('YOMI_B1')).toBe(false);
    expect(isYomiStage(' yomi_b01')).toBe(false);
    expect(isYomiStage('yomi_b01 ')).toBe(false);
    expect(isYomiStage(null)).toBe(false);
    expect(isYomiStage(undefined)).toBe(false);
    expect(isYomiStage('')).toBe(false);
  });

  test('getYomiFloorNumber parses positive floor numbers', () => {
    expect(getYomiFloorNumber('yomi_b01')).toBe(1);
    expect(getYomiFloorNumber('yomi_b09')).toBe(9);
    expect(getYomiFloorNumber('yomi_b10')).toBe(10);
    expect(getYomiFloorNumber('yomi_b20')).toBe(20);
    expect(getYomiFloorNumber('yomi_b1')).toBe(1);
    expect(getYomiFloorNumber('yomi_b21')).toBe(21);
    expect(getYomiFloorNumber('yomi_b100')).toBe(100);

    expect(getYomiFloorNumber('yomi_b0')).toBeNull();
    expect(getYomiFloorNumber('yomi_b00')).toBeNull();
    expect(getYomiFloorNumber('area1_node3')).toBeNull();
    expect(getYomiFloorNumber(null)).toBeNull();
    expect(getYomiFloorNumber(undefined)).toBeNull();
  });

  test('isYomiArea recognizes the dedicated virtual area', () => {
    expect(isYomiArea(1, 99)).toBe(true);
    expect(isYomiArea(1, 1)).toBe(false);
    expect(isYomiArea(2, 99)).toBe(false);
    expect(isYomiArea(0, 99)).toBe(false);
    expect(isYomiArea(null, 99)).toBe(false);
    expect(isYomiArea(1, undefined)).toBe(false);
  });

  test('CH1 final node id stays frozen to the release decision', () => {
    expect(CH1_FINAL_NODE_ID).toBe('area1_node3');
  });

  test('getYomiMilestoneFloorForFirstClear returns only first-clear 10-floor milestones', () => {
    expect(getYomiMilestoneFloorForFirstClear('yomi_b10', [])).toBe(10);
    expect(getYomiMilestoneFloorForFirstClear('yomi_b10', ['yomi_b10'])).toBeNull();
    expect(getYomiMilestoneFloorForFirstClear('yomi_b05', [])).toBeNull();
    expect(getYomiMilestoneFloorForFirstClear('yomi_b20', ['yomi_b10'])).toBe(20);
    expect(getYomiMilestoneFloorForFirstClear('area1_node3', [])).toBeNull();
    expect(getYomiMilestoneFloorForFirstClear(null, [])).toBeNull();
    expect(getYomiMilestoneFloorForFirstClear('yomi_b100', [])).toBe(100);
  });
});
