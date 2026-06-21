import {
  getStoryPersistenceScope,
  getStoryStorageKeyForScope,
  switchStoryPersistenceScope,
  useStoryStore,
} from './useStoryStore';

async function clearStoryScope(userId: string | null) {
  await switchStoryPersistenceScope(userId);
  useStoryStore.getState().resetStoryProgress();
}

describe('useStoryStore persistence scopes', () => {
  beforeEach(async () => {
    await clearStoryScope(null);
    await clearStoryScope('story-user-a');
    await clearStoryScope('story-user-b');
    await switchStoryPersistenceScope(null);
  });

  test('builds stable storage keys for authenticated users', () => {
    const scope = getStoryPersistenceScope(' user/a@example.test ');

    expect(scope).toBe(`user:${encodeURIComponent('user/a@example.test')}`);
    expect(getStoryStorageKeyForScope(scope)).toBe(`necro-story-store-v2:${scope}`);
    expect(getStoryStorageKeyForScope(null)).toBe('necro-story-store-v2');
  });

  test('does not carry guest story progress into an authenticated user scope', async () => {
    await switchStoryPersistenceScope(null);
    useStoryStore.getState().markViewed('PROLOGUE_00');

    await switchStoryPersistenceScope('story-user-a');

    expect(useStoryStore.getState().viewedScenes).toEqual([]);
    expect(useStoryStore.getState().storyFlags).toEqual({});
  });

  test('isolates viewed scenes and flags between authenticated users', async () => {
    await switchStoryPersistenceScope('story-user-a');
    useStoryStore.getState().markViewed('PROLOGUE_00');
    useStoryStore.getState().setFlag('LINE_DEATH_SEEN');

    await switchStoryPersistenceScope('story-user-b');
    expect(useStoryStore.getState().viewedScenes).toEqual([]);
    expect(useStoryStore.getState().storyFlags).toEqual({});

    useStoryStore.getState().markViewed('PROLOGUE_01');

    await switchStoryPersistenceScope('story-user-a');
    expect(useStoryStore.getState().viewedScenes).toContain('PROLOGUE_00');
    expect(useStoryStore.getState().viewedScenes).not.toContain('PROLOGUE_01');
    expect(useStoryStore.getState().storyFlags.LINE_DEATH_SEEN).toBe(true);
  });
});
