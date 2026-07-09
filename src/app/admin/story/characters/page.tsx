import { getStoryCharacters } from '../../actions';
import StoryCharactersForm from '@/components/admin/forms/StoryCharactersForm';

export default async function StoryCharactersPage() {
  const characters = await getStoryCharacters();
  return <StoryCharactersForm characters={characters} />;
}
