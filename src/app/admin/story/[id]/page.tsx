import { getStoryScene, getStoryCharacters } from '../../actions';
import StorySceneForm from '@/components/admin/forms/StorySceneForm';
import { notFound } from 'next/navigation';

export default async function EditStoryScenePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [scene, characters] = await Promise.all([
    getStoryScene(id),
    getStoryCharacters(),
  ]);
  if (!scene) notFound();
  return <StorySceneForm scene={scene} isNew={false} characters={characters} />;
}
