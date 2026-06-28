import type { StoryScene } from '../../types/story';
import {
  STORY_PACKS,
  getStoryPackForArchiveChapter,
  getStoryPackForScene,
  getStoryPackSummaries,
  sortStoryScenes,
} from './packs';

describe('Story packs', () => {
  test('maps prologue and chapter 1 archive chapters to the first story pack', () => {
    expect(getStoryPackForArchiveChapter(0)?.fileName).toBe('ch1_scenes.json');
    expect(getStoryPackForArchiveChapter(1)?.fileName).toBe('ch1_scenes.json');
  });

  test('maps chapter 2 archive chapter to the placeholder chapter 2 pack', () => {
    expect(getStoryPackForArchiveChapter(2)?.fileName).toBe('ch2_scenes.json');
  });

  test('rejects archive chapters without a registered pack', () => {
    expect(getStoryPackForArchiveChapter(3)).toBeNull();
  });

  test('resolves a scene target by archiveChapter', () => {
    expect(getStoryPackForScene({ archiveChapter: 1 })?.id).toBe('act1_ch1');
    expect(getStoryPackForScene({ archiveChapter: 2 })?.id).toBe('act1_ch2');
  });

  test('builds pack summaries without exposing scene bodies', () => {
    expect(getStoryPackSummaries()).toEqual([
      {
        id: 'act1_ch1',
        fileName: 'ch1_scenes.json',
        label: '第1章 亡国の王都',
        archiveChapterRange: [0, 1],
        sceneCount: 19,
      },
      {
        id: 'act1_ch2',
        fileName: 'ch2_scenes.json',
        label: '第2章 幽霊都市',
        archiveChapterRange: [2, 2],
        sceneCount: 4,
      },
    ]);
  });

  test('sorts scenes by sequence and id for stable registry order', () => {
    const scenes = [
      { id: 'B', sequence: 10, archiveChapter: 1 },
      { id: 'A', sequence: 10, archiveChapter: 1 },
      { id: 'C', sequence: 1, archiveChapter: 1 },
    ] as StoryScene[];

    expect(sortStoryScenes(scenes).map(scene => scene.id)).toEqual(['C', 'A', 'B']);
    expect(STORY_PACKS).toHaveLength(2);
  });
});
