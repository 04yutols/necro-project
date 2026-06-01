import { getEntry, getDependencies } from '../../actions';
import ItemForm from '@/components/admin/forms/ItemForm';
import { notFound } from 'next/navigation';

export default async function EditItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [data, dependencies] = await Promise.all([
    getEntry('items', id),
    getDependencies('items', id),
  ]);
  if (!data) notFound();
  return <ItemForm initialData={data} entryKey={id} isNew={false} dependencies={dependencies} />;
}
