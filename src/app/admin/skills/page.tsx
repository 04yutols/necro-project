import { getMasterFile } from '../actions';
import SkillsList from '@/components/admin/SkillsList';

export default async function SkillsPage() {
  const data = await getMasterFile('skills');
  const count = Object.keys(data).length;

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <div className="mb-5">
        <h2 className="font-cinzel text-base font-bold tracking-widest uppercase mb-1" style={{ color: '#e0d0ff' }}>
          スキルデータ
        </h2>
        <p className="text-xs font-mono" style={{ color: '#7878a8' }}>
          skills.json — {count} エントリ
        </p>
      </div>
      <SkillsList data={data} />
    </div>
  );
}
