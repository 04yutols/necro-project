import { getEntry, getMasterFile, getDependencies, getNecroConfig } from '../../actions';
import EnemyForm from '@/components/admin/forms/EnemyForm';
import { notFound } from 'next/navigation';

export default async function EditEnemyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [data, items, materials, dependencies, necroConfig] = await Promise.all([
    getEntry('enemies', id),
    getMasterFile('items'),
    getMasterFile('materials'),
    getDependencies('enemies', id),
    getNecroConfig(),
  ]);
  if (!data) notFound();
  return (
    <EnemyForm
      initialData={data}
      entryKey={id}
      isNew={false}
      itemIds={Object.keys(items)}
      materialIds={Object.keys(materials)}
      necroConfig={necroConfig}
      dependencies={dependencies}
    />
  );
}
