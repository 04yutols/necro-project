import AreaForm from '@/components/admin/forms/AreaForm';

export default async function NewAreaPage() {
  return (
    <AreaForm
      initialData={null}
      entryKey=""
      isNew={true}
    />
  );
}
