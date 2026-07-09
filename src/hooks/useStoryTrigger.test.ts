import { getFlagSceneIds, getPrologueSceneIds } from '../data/story';

const storageValues = new Map<string, string>();
const testStorage: Storage = {
  get length() {
    return storageValues.size;
  },
  clear: () => {
    storageValues.clear();
  },
  getItem: (name) => storageValues.get(name) ?? null,
  key: (index) => Array.from(storageValues.keys())[index] ?? null,
  setItem: (name, value) => {
    storageValues.set(name, value);
  },
  removeItem: (name) => {
    storageValues.delete(name);
  },
};

let useStoryStore: typeof import('../store/useStoryStore').useStoryStore;
let switchStoryPersistenceScope: typeof import('../store/useStoryStore').switchStoryPersistenceScope;
let enqueueInitialStoryScenes: typeof import('./useStoryTrigger').enqueueInitialStoryScenes;

function resetStoryStore() {
  storageValues.clear();
  useStoryStore.setState({
    activeScene: null,
    sceneQueue: [],
    viewedScenes: [],
    storyFlags: {},
    hasHydrated: true,
  });
}

describe('useStoryTrigger initial story enqueue', () => {
  beforeAll(() => {
    Object.defineProperty(globalThis, 'window', {
      value: { localStorage: testStorage },
      configurable: true,
    });
    Object.defineProperty(globalThis, 'localStorage', {
      value: testStorage,
      configurable: true,
    });

    useStoryStore = require('../store/useStoryStore').useStoryStore;
    switchStoryPersistenceScope = require('../store/useStoryStore').switchStoryPersistenceScope;
    enqueueInitialStoryScenes = require('./useStoryTrigger').enqueueInitialStoryScenes;
  });

  beforeEach(() => {
    resetStoryStore();
  });

  test('waits for player load before enqueueing prologue after signup reset', () => {
    expect(enqueueInitialStoryScenes(false)).toEqual([]);
    expect(useStoryStore.getState().activeScene).toBeNull();

    useStoryStore.getState().resetStoryProgress();

    const prologueIds = getPrologueSceneIds();
    const [firstSceneId, ...queuedSceneIds] = prologueIds;

    expect(enqueueInitialStoryScenes(true)).toEqual(prologueIds);
    expect(useStoryStore.getState().activeScene?.id).toBe(firstSceneId);
    expect(useStoryStore.getState().sceneQueue).toEqual(queuedSceneIds);
  });

  test('waits for main content readiness after character creation loads the player', () => {
    expect(enqueueInitialStoryScenes(true, false)).toEqual([]);
    expect(useStoryStore.getState().activeScene).toBeNull();

    useStoryStore.getState().resetStoryProgress();

    const prologueIds = getPrologueSceneIds();
    expect(enqueueInitialStoryScenes(true, true)).toEqual(prologueIds);
    expect(useStoryStore.getState().activeScene?.id).toBe(prologueIds[0]);
  });

  test('fires after character creation reload rehydrates the new user scope', async () => {
    await switchStoryPersistenceScope('story-new-character-user');

    expect(enqueueInitialStoryScenes(false, true)).toEqual([]);
    expect(enqueueInitialStoryScenes(true, false)).toEqual([]);

    await switchStoryPersistenceScope('story-new-character-user');

    const prologueIds = getPrologueSceneIds();
    expect(enqueueInitialStoryScenes(true, true)).toEqual(prologueIds);
    expect(useStoryStore.getState().activeScene?.id).toBe(prologueIds[0]);
  });

  test('does not duplicate prologue when startup check runs again', () => {
    expect(enqueueInitialStoryScenes(true)).toEqual(getPrologueSceneIds());
    expect(enqueueInitialStoryScenes(true)).toEqual([]);
  });

  test('keeps existing flag-based startup scenes after prologue is already viewed', () => {
    const store = useStoryStore.getState();
    store.markViewed('PROLOGUE_00');
    store.setFlag('LINE_DEATH_SEEN');

    const expectedSceneIds = getFlagSceneIds('LINE_DEATH_SEEN');

    expect(enqueueInitialStoryScenes(true)).toEqual(expectedSceneIds);
    expect(useStoryStore.getState().activeScene?.id).toBe(expectedSceneIds[0]);
  });
});
