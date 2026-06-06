import { getMasterFile } from '../../actions';
import AreaForm from '@/components/admin/forms/AreaForm';

export default async function NewAreaPage() {
  const areas = await getMasterFile('areas');
  return (
    <AreaForm
      initialData={null}
      entryKey=""
      isNew={true}
      areas={areas}
    />
  );
}
