export type SceneType =
  | 'DIALOGUE'
  | 'MONOLOGUE'
  | 'ENVIRONMENT'
  | 'CHAPTER_TITLE'
  | 'CHOICE';

export type SceneTrigger =
  | { type: 'GAME_START' }
  | { type: 'FLAG_SET'; flagKey: string }
  | { type: 'STAGE_CLEAR'; stageId: string }
  | { type: 'STAGE_ENTER'; stageId: string }
  | { type: 'AREA_UNLOCK'; areaId: string }
  | { type: 'BOSS_CLEAR'; bossStageId: string }
  | { type: 'DEMONIZE_FIRST' }
  | { type: 'MANUAL'; sceneId: string };

export interface CharacterPortrait {
  characterId: string;
  position: 'LEFT' | 'CENTER' | 'RIGHT';
  expression: string;
  isDimmed?: boolean;
}

export interface DialogueLine {
  speaker: string | null;
  speakerJa?: string;
  text: string;
  textEn?: string;
  portraits?: CharacterPortrait[];
  expression?: string;
  bgm?: string;
  vfx?: string;
  pauseAfter?: number;
  skipIf?: string[];
}

export interface StoryScene {
  id: string;
  type: SceneType;
  title?: string;
  titleEn?: string;
  description?: string;
  sequence?: number;
  trigger: SceneTrigger;
  background?: string;
  lines: DialogueLine[];
  onComplete?: {
    unlockArea?: string;
    setFlag?: string;
    navigateTo?: string;
  };
  isSkippable: boolean;
  archiveTitle: string;
  archiveChapter: number;
}

export interface StoryCharacter {
  id: string;
  nameJa: string;
  nameEn: string;
  color: string;
  glow: string;
  portraitBase: string;
  expressions: string[];
}
