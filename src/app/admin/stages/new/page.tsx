import { getMasterFile } from '../../actions';
import StageForm from '@/components/admin/forms/StageForm';

export default async function NewStagePage() {
  const [items, materials, enemies] = await Promise.all([
    getMasterFile('items'),
    getMasterFile('materials'),
    getMasterFile('enemies'),
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
    />
  );
}
