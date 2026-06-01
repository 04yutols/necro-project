import { getEntry, getMasterFile, getDependencies } from '../../actions';
import StageForm from '@/components/admin/forms/StageForm';
import { notFound } from 'next/navigation';

export default async function EditStagePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [data, items, materials, enemies, dependencies] = await Promise.all([
    getEntry('stages', id),
    getMasterFile('items'),
    getMasterFile('materials'),
    getMasterFile('enemies'),
    getDependencies('stages', id),
  ]);
  if (!data) notFound();
  const enemyData = Object.entries(enemies).map(([key, raw]) => ({
    id: key,
    nameJa: (raw.nameJa as string) || key,
    tier: (raw.tier as string) || 'MINION',
    tribe: (raw.tribe as string) || '',
  }));
  return (
    <StageForm
      initialData={data}
      entryKey={id}
      isNew={false}
      itemIds={Object.keys(items)}
      materialIds={Object.keys(materials)}
      enemyData={enemyData}
      dependencies={dependencies}
    />
  );
}
