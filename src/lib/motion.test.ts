import { getNavigationDirection } from './motion';

describe('motion navigation direction', () => {
  it('returns forward direction for deeper app tabs', () => {
    expect(getNavigationDirection('HOME', 'EQUIP')).toBe(1);
    expect(getNavigationDirection('EQUIP', 'LAB')).toBe(1);
  });

  it('returns backward direction for parentward app tabs', () => {
    expect(getNavigationDirection('LAB', 'HOME')).toBe(-1);
    expect(getNavigationDirection('JOB', 'MAP')).toBe(-1);
  });

  it('returns neutral direction for same or unknown tabs', () => {
    expect(getNavigationDirection('HOME', 'HOME')).toBe(0);
    expect(getNavigationDirection('HOME', 'UNKNOWN')).toBe(0);
  });
});
