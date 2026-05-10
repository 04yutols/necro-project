import type { StoryScene } from '../../types/story';

// Viteは同ディレクトリへの変数パス動的importを解析できないため静的importで解決
import prologueData from './act1_prologue.json';
import ch1Data from './act1_ch1_royal_capital.json';

const CHAPTER_DATA: Record<string, { scenes: StoryScene[] }> = {
  'act1_prologue': prologueData as { scenes: StoryScene[] },
  'act1_ch1_royal_capital': ch1Data as { scenes: StoryScene[] },
};

const SCENE_CHAPTER_MAP: Record<string, string> = {
  PROLOGUE_00: 'act1_prologue',
  PROLOGUE_01: 'act1_prologue',
  PROLOGUE_02: 'act1_prologue',
  PROLOGUE_03: 'act1_prologue',
  CH1_TITLE:          'act1_ch1_royal_capital',
  CH1_OPEN:           'act1_ch1_royal_capital',
  CH1_NODE1_AFTER:    'act1_ch1_royal_capital',
  CH1_NODE2_ENTER:    'act1_ch1_royal_capital',
  CH1_BOSS_ENTER:     'act1_ch1_royal_capital',
  CH1_BOSS_AFTER:     'act1_ch1_royal_capital',
  CH1_CLEAR:          'act1_ch1_royal_capital',
  CH1_AREA2_UNLOCK:   'act1_ch1_royal_capital',
  CH1_DEMONIZE_FIRST: 'act1_ch1_royal_capital',
};

export function findScene(sceneId: string): StoryScene | null {
  const chapter = SCENE_CHAPTER_MAP[sceneId];
  if (!chapter) return null;
  return CHAPTER_DATA[chapter]?.scenes.find(s => s.id === sceneId) ?? null;
}

export function getAllSceneIds(): string[] {
  return Object.keys(SCENE_CHAPTER_MAP);
}
