import { getDependencies, getEntry } from '../../actions';
import AreaForm from '@/components/admin/forms/AreaForm';
import { notFound } from 'next/navigation';

export default async function EditAreaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [data, dependencies] = await Promise.all([
    getEntry('areas', id),
    getDependencies('areas', id),
  ]);
  if (!data) notFound();

  return (
    <AreaForm
      initialData={data}
      entryKey={id}
      isNew={false}
      dependencies={dependencies}
    />
  );
}
