import { getMasterFile } from '../actions';
import JobsList from '@/components/admin/JobsList';

export default async function JobsPage() {
  const data = await getMasterFile('jobs');
  const count = Object.keys(data).length;

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <div className="mb-5">
        <h2 className="font-cinzel text-base font-bold tracking-widest uppercase mb-1" style={{ color: '#e0d0ff' }}>
          職業データ
        </h2>
        <p className="text-xs font-mono" style={{ color: '#7878a8' }}>
          jobs.json — {count} エントリ
        </p>
      </div>
      <JobsList data={data} />
    </div>
  );
}
