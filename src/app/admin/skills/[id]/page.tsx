import { getEntry, getDependencies } from '../../actions';
import SkillForm from '@/components/admin/forms/SkillForm';
import { notFound } from 'next/navigation';

export default async function EditSkillPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [data, dependencies] = await Promise.all([
    getEntry('skills', id),
    getDependencies('skills', id),
  ]);
  if (!data) notFound();
  return <SkillForm initialData={data} entryKey={id} isNew={false} dependencies={dependencies} />;
}
