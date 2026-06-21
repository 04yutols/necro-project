import { getMasterFile, getNecroConfig } from '../../actions';
import EnemyForm from '@/components/admin/forms/EnemyForm';

export default async function NewEnemyPage() {
  const [items, materials, necroConfig] = await Promise.all([
    getMasterFile('items'),
    getMasterFile('materials'),
    getNecroConfig(),
  ]);
  return (
    <EnemyForm
      initialData={null}
      entryKey=""
      isNew={true}
      itemIds={Object.keys(items)}
      materialIds={Object.keys(materials)}
      necroConfig={necroConfig}
    />
  );
}
