import { runMasterDataAudit } from '../actions';
import AuditPanel from '@/components/admin/AuditPanel';

export default async function AuditPage() {
  const findings = await runMasterDataAudit();

  const failCount = findings.filter((f) => f.level === 'FAIL').length;
  const warnCount = findings.filter((f) => f.level === 'WARN').length;
  const passCount = findings.filter((f) => f.level === 'PASS').length;

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <div className="mb-5">
        <h2
          className="font-cinzel text-base font-bold tracking-widest uppercase mb-1"
          style={{ color: '#e0d0ff' }}
        >
          データ監査
        </h2>
        <p className="text-xs font-mono" style={{ color: '#7878a8' }}>
          {failCount} FAIL, {warnCount} WARN, {passCount} PASS
        </p>
      </div>

      <AuditPanel findings={findings} />
    </div>
  );
}
