import { getEntry, getDependencies } from '../../actions';
import MaterialForm from '@/components/admin/forms/MaterialForm';
import { notFound } from 'next/navigation';

export default async function EditMaterialPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [data, dependencies] = await Promise.all([
    getEntry('materials', id),
    getDependencies('materials', id),
  ]);
  if (!data) notFound();
  return <MaterialForm initialData={data} entryKey={id} isNew={false} dependencies={dependencies} />;
}
