import { getStoryCharacters } from '../../actions';
import StorySceneForm from '@/components/admin/forms/StorySceneForm';
import type { StoryScene } from '@/types/story';
import { STORY_PACKS } from '@/data/story/packs';

export default async function NewStoryScenePage({
  searchParams,
}: {
  searchParams: Promise<{ packId?: string }>;
}) {
  const { packId } = await searchParams;
  const characters = await getStoryCharacters();

  const pack = packId ? STORY_PACKS.find((p) => p.id === packId) : null;
  const defaultChapter = pack ? pack.archiveChapterRange[0] : 1;

  const EMPTY_SCENE: StoryScene = {
    id: '',
    type: 'DIALOGUE',
    sequence: 100,
    trigger: { type: 'GAME_START' },
    background: 'DARK',
    lines: [],
    isSkippable: true,
    archiveTitle: '',
    archiveChapter: defaultChapter,
  };

  return <StorySceneForm scene={EMPTY_SCENE} isNew={true} characters={characters} />;
}
