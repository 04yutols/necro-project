import { getMasterFile } from '../actions';
import SimulatorClient from '@/components/admin/SimulatorClient';

export default async function SimulatorPage() {
  const [jobs, skills, enemies] = await Promise.all([
    getMasterFile('jobs'),
    getMasterFile('skills'),
    getMasterFile('enemies'),
  ]);

  return (
    <SimulatorClient
      jobsData={jobs as Record<string, unknown>}
      skillsData={skills as Record<string, unknown>}
      enemiesData={enemies as Record<string, unknown>}
    />
  );
}
