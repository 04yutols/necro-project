import { getEntry, getDependencies } from '../../actions';
import JobForm from '@/components/admin/forms/JobForm';
import { notFound } from 'next/navigation';

export default async function EditJobPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [data, dependencies] = await Promise.all([
    getEntry('jobs', id),
    getDependencies('jobs', id),
  ]);
  if (!data) notFound();
  return <JobForm initialData={data} entryKey={id} isNew={false} dependencies={dependencies} />;
}
