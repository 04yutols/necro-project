import { getMasterFile } from '../../actions';
import EnemyForm from '@/components/admin/forms/EnemyForm';

export default async function NewEnemyPage() {
  const [items, materials] = await Promise.all([
    getMasterFile('items'),
    getMasterFile('materials'),
  ]);
  return (
    <EnemyForm
      initialData={null}
      entryKey=""
      isNew={true}
      itemIds={Object.keys(items)}
      materialIds={Object.keys(materials)}
    />
  );
}
