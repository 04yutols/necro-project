import { getMasterFile } from '../../actions';
import StageForm from '@/components/admin/forms/StageForm';

export default async function NewStagePage({ searchParams }: { searchParams?: Promise<{ areaId?: string }> }) {
  const params = searchParams ? await searchParams : {};
  const initialAreaId = params?.areaId;
  const [items, materials, enemies, areas, stages] = await Promise.all([
    getMasterFile('items'),
    getMasterFile('materials'),
    getMasterFile('enemies'),
    getMasterFile('areas'),
    getMasterFile('stages'),
  ]);
  const enemyData = Object.entries(enemies).map(([key, raw]) => ({
    id: key,
    nameJa: (raw.nameJa as string) || key,
    tier: (raw.tier as string) || 'MINION',
    tribe: (raw.tribe as string) || '',
  }));
  return (
    <StageForm
      initialData={null}
      entryKey=""
      isNew={true}
      itemIds={Object.keys(items)}
      materialIds={Object.keys(materials)}
      enemyData={enemyData}
      areas={areas}
      stages={stages}
      initialAreaId={initialAreaId}
    />
  );
}
