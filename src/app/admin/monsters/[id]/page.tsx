import { getEntry, getDependencies } from '../../actions';
import MonsterForm from '@/components/admin/forms/MonsterForm';
import { notFound } from 'next/navigation';

export default async function EditMonsterPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [data, dependencies] = await Promise.all([
    getEntry('monsters', id),
    getDependencies('monsters', id),
  ]);
  if (!data) notFound();
  return <MonsterForm initialData={data} entryKey={id} isNew={false} dependencies={dependencies} />;
}
