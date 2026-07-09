import { getNecroConfig } from '../actions';
import NecroConfigForm from '@/components/admin/forms/NecroConfigForm';

export default async function NecroConfigPage() {
  const config = await getNecroConfig();
  return <NecroConfigForm initialConfig={config} />;
}
