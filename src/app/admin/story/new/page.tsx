import { getStoryCharacters } from '../../actions';
import StorySceneForm from '@/components/admin/forms/StorySceneForm';
import type { StoryScene } from '@/types/story';

const EMPTY_SCENE: StoryScene = {
  id: '',
  type: 'DIALOGUE',
  sequence: 100,
  trigger: { type: 'GAME_START' },
  background: 'DARK',
  lines: [],
  isSkippable: true,
  archiveTitle: '',
  archiveChapter: 1,
};

export default async function NewStoryScenePage() {
  const characters = await getStoryCharacters();
  return <StorySceneForm scene={EMPTY_SCENE} isNew={true} characters={characters} />;
}
