import type { StoryScene } from '../../types/story';
import ch1ScenesData from './ch1_scenes.json';
import ch2ScenesData from './ch2_scenes.json';

export interface StoryPack {
  id: string;
  fileName: string;
  label: string;
  archiveChapterRange: readonly [number, number];
  scenes: StoryScene[];
}

export interface StoryPackSummary {
  id: string;
  fileName: string;
  label: string;
  archiveChapterRange: readonly [number, number];
  sceneCount: number;
}

const ch1Scenes = (ch1ScenesData as { scenes: StoryScene[] }).scenes;
const ch2Scenes = (ch2ScenesData as { scenes: StoryScene[] }).scenes;

export const STORY_PACKS: StoryPack[] = [
  {
    id: 'act1_ch1',
    fileName: 'ch1_scenes.json',
    label: '第1章 亡国の王都',
    archiveChapterRange: [0, 1],
    scenes: ch1Scenes,
  },
  {
    id: 'act1_ch2',
    fileName: 'ch2_scenes.json',
    label: '第2章 幽霊都市',
    archiveChapterRange: [2, 2],
    scenes: ch2Scenes,
  },
];

export function sortStoryScenes(scenes: StoryScene[]): StoryScene[] {
  return [...scenes].sort((a, b) => {
    const aSeq = a.sequence ?? Number.MAX_SAFE_INTEGER;
    const bSeq = b.sequence ?? Number.MAX_SAFE_INTEGER;
    if (aSeq !== bSeq) return aSeq - bSeq;
    return a.id.localeCompare(b.id);
  });
}

export function getStoryPackSummaries(packs: StoryPack[] = STORY_PACKS): StoryPackSummary[] {
  return packs.map(pack => ({
    id: pack.id,
    fileName: pack.fileName,
    label: pack.label,
    archiveChapterRange: pack.archiveChapterRange,
    sceneCount: pack.scenes.length,
  }));
}

export function getStoryPackById(packId: string): StoryPack | null {
  return STORY_PACKS.find(pack => pack.id === packId) ?? null;
}

export function getStoryPackByFileName(fileName: string): StoryPack | null {
  return STORY_PACKS.find(pack => pack.fileName === fileName) ?? null;
}

export function getStoryPackForArchiveChapter(archiveChapter: number): StoryPack | null {
  return STORY_PACKS.find(pack => {
    const [minChapter, maxChapter] = pack.archiveChapterRange;
    return archiveChapter >= minChapter && archiveChapter <= maxChapter;
  }) ?? null;
}

export function getStoryPackForScene(scene: Pick<StoryScene, 'archiveChapter'>): StoryPack | null {
  return getStoryPackForArchiveChapter(scene.archiveChapter);
}
