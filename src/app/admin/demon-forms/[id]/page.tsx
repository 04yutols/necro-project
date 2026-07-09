import { getEntry, getDependencies } from '../../actions';
import DemonFormEditor from '@/components/admin/forms/DemonFormEditor';
import { notFound } from 'next/navigation';

export default async function EditDemonFormPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [data, dependencies] = await Promise.all([
    getEntry('demonForms', id),
    getDependencies('demonForms', id),
  ]);
  if (!data) notFound();
  return <DemonFormEditor initialData={data} entryKey={id} isNew={false} dependencies={dependencies} />;
}
