import { useGameStore } from './useGameStore';

describe('useGameStore party formation actions', () => {
  beforeEach(() => {
    useGameStore.getState().initialize();
  });

  test('swapPartySlots swaps monster positions without changing party size', () => {
    const before = useGameStore.getState().party;
    expect(before).toHaveLength(3);
    expect(before[0]?.name).toBe('スケルトン');
    expect(before[1]?.name).toBe('ゾンビ');

    useGameStore.getState().swapPartySlots(0, 1);

    const after = useGameStore.getState().party;
    expect(after).toHaveLength(3);
    expect(after[0]?.name).toBe('ゾンビ');
    expect(after[1]?.name).toBe('スケルトン');
  });

  test('setParty replaces the three-slot formation explicitly', () => {
    const monsters = useGameStore.getState().inventoryMonsters;
    useGameStore.getState().setParty([monsters[0], null, monsters[2]]);

    const party = useGameStore.getState().party;
    expect(party).toHaveLength(3);
    expect(party[0]?.name).toBe('ゴブリン');
    expect(party[1]).toBeNull();
    expect(party[2]?.name).toBe('ゾンビ');
  });
});
