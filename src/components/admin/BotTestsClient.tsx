'use client';

import { useMemo, useState } from 'react';
import type { BotTestHistoryEntry } from '@/services/BotTestHistoryService';
import type { BotTestSchedule } from '@/services/BotTestScheduleService';
import type { BotTestBatchView } from '@/services/BotTestQueueService';

const PANEL: React.CSSProperties = {
  background: 'linear-gradient(145deg, rgba(18,16,28,0.96), rgba(8,7,14,0.98))',
  border: '1px solid rgba(139,0,255,0.24)', borderRadius: 12, boxShadow: '0 12px 32px rgba(0,0,0,0.28)',
};
const BUTTON: React.CSSProperties = {
  minHeight: 38, padding: '0 14px', borderRadius: 8, border: '1px solid rgba(139,0,255,0.48)',
  background: 'linear-gradient(135deg, rgba(139,0,255,0.3), rgba(75,0,130,0.18))',
  color: '#eadcff', fontFamily: 'Space Mono, monospace', fontSize: 11, fontWeight: 700, cursor: 'pointer',
};

function pct(value: number) { return `${(value * 100).toFixed(1)}%`; }

function TrendChart({ history }: { history: BotTestHistoryEntry[] }) {
  const values = [...history].reverse().map(entry => entry.totals.simulations > 0 ? entry.totals.wins / entry.totals.simulations : 0);
  if (values.length < 2) return <div style={{ color: '#68647b', fontSize: 12 }}>履歴が2件以上になると推移を表示します。</div>;
  const points = values.map((value, index) => `${20 + index * (560 / Math.max(1, values.length - 1))},${180 - value * 140}`).join(' ');
  return (
    <svg viewBox="0 0 600 210" role="img" aria-label="クリア率履歴" style={{ width: '100%', height: 210 }}>
      {[0, 0.5, 1].map(value => <g key={value}>
        <line x1="20" x2="580" y1={180 - value * 140} y2={180 - value * 140} stroke="rgba(139,0,255,0.13)" />
        <text x="22" y={174 - value * 140} fill="#68647b" fontSize="10">{value * 100}%</text>
      </g>)}
      <polyline points={points} fill="none" stroke="#8B00FF" strokeWidth="3" strokeLinejoin="round" />
      {values.map((value, index) => <circle key={index} cx={20 + index * (560 / Math.max(1, values.length - 1))} cy={180 - value * 140} r="4" fill="#e0c8ff" stroke="#8B00FF" />)}
    </svg>
  );
}

export default function BotTestsClient({
  initialHistory, initialSchedules, redisEnabled,
}: {
  initialHistory: BotTestHistoryEntry[];
  initialSchedules: BotTestSchedule[];
  redisEnabled: boolean;
}) {
  const [history, setHistory] = useState(initialHistory);
  const [schedules, setSchedules] = useState(initialSchedules);
  const [batch, setBatch] = useState<BotTestBatchView | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const latest = history[0];
  const latestClearRate = latest && latest.totals.simulations > 0 ? latest.totals.wins / latest.totals.simulations : 0;
  const warningCount = useMemo(() => latest?.scenarios.reduce((sum, scenario) => sum + scenario.warnings.length, 0) ?? 0, [latest]);

  async function refreshHistory() {
    const response = await fetch('/api/admin/bot-history?limit=30', { cache: 'no-store' });
    if (response.ok) setHistory((await response.json()).history);
  }

  async function enqueue(suite: 'chapter1' | 'yomi') {
    setBusy(true); setMessage('');
    try {
      const response = await fetch('/api/admin/bot-jobs', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          suite, seed: `admin:${suite}:${Date.now()}`, iterations: 100,
          profile: suite === 'yomi' ? 'yomi_deep' : 'ch1_end', policy: 'weakness_first', jobId: 'warrior',
          firstClear: suite === 'yomi',
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? '投入に失敗しました。');
      setBatch(payload); setMessage(`${suite} を ${payload.jobs.length} jobで投入しました。`);
    } catch (error) { setMessage(error instanceof Error ? error.message : String(error)); }
    finally { setBusy(false); }
  }

  async function runWorker() {
    if (!batch) return;
    setBusy(true); setMessage('workerを実行中…');
    try {
      await fetch('/api/admin/bot-worker', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ maxJobs: 3 }),
      });
      const response = await fetch(`/api/admin/bot-jobs?batchId=${batch.id}`, { cache: 'no-store' });
      const next = await response.json();
      setBatch(next);
      const terminal = next.counts.COMPLETED + next.counts.FAILED === next.jobs.length;
      setMessage(terminal ? 'batchが完了しました。履歴を更新しました。' : `進捗 ${next.counts.COMPLETED + next.counts.FAILED}/${next.jobs.length}`);
      if (terminal) await refreshHistory();
    } catch (error) { setMessage(error instanceof Error ? error.message : String(error)); }
    finally { setBusy(false); }
  }

  async function saveSchedules() {
    setBusy(true);
    try {
      const response = await fetch('/api/admin/bot-schedules', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ schedules }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? '保存に失敗しました。');
      setSchedules(payload.schedules); setMessage('定期実行設定を保存しました。');
    } catch (error) { setMessage(error instanceof Error ? error.message : String(error)); }
    finally { setBusy(false); }
  }

  return (
    <div style={{ maxWidth: 1320, margin: '0 auto', padding: '28px 20px 60px', fontFamily: 'Space Mono, monospace' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap', marginBottom: 24 }}>
        <div><h1 style={{ margin: 0, color: '#eadcff', fontFamily: 'Cinzel, serif', letterSpacing: '0.12em', fontSize: 22, textShadow: '0 0 18px rgba(139,0,255,0.5)' }}>BOT OBSERVATORY</h1>
          <p style={{ color: '#827b98', fontSize: 11 }}>API battle telemetry / Chapter I + 黄泉 B1–B20</p></div>
        <div style={{ color: redisEnabled ? '#7dd3a8' : '#fbbf24', fontSize: 11, padding: '7px 10px', border: `1px solid ${redisEnabled ? '#2d6b52' : '#6b542d'}`, borderRadius: 999 }}>
          {redisEnabled ? '● UPSTASH REDIS' : '● DEV MEMORY'}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 12, marginBottom: 18 }}>
        {[['LATEST CLEAR', pct(latestClearRate)], ['SIMULATIONS', latest?.totals.simulations ?? 0], ['WARNINGS', warningCount], ['REGRESSIONS', latest?.comparison?.regressions.length ?? 0]].map(([label, value]) => (
          <div key={String(label)} style={{ ...PANEL, padding: 16 }}><div style={{ color: '#77708c', fontSize: 10 }}>{label}</div><div style={{ color: '#e8d9ff', fontFamily: 'Cinzel, serif', fontSize: 28, marginTop: 6 }}>{value}</div></div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,2fr) minmax(280px,1fr)', gap: 16, marginBottom: 18 }}>
        <section style={{ ...PANEL, padding: 18 }}><h2 style={{ color: '#c9b6e8', fontSize: 12, letterSpacing: '0.1em' }}>CLEAR RATE TREND</h2><TrendChart history={history} /></section>
        <section style={{ ...PANEL, padding: 18 }}><h2 style={{ color: '#c9b6e8', fontSize: 12, letterSpacing: '0.1em' }}>QUEUE CONTROL</h2>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}><button disabled={busy} style={BUTTON} onClick={() => enqueue('chapter1')}>第1章を投入</button><button disabled={busy} style={BUTTON} onClick={() => enqueue('yomi')}>黄泉を投入</button></div>
          {batch && <div style={{ marginTop: 14, color: '#aaa0bd', fontSize: 11, lineHeight: 1.9 }}>
            <div>ID {batch.id.slice(0, 12)}</div><div>待機 {batch.counts.QUEUED} / 実行中 {batch.counts.RUNNING}</div><div>完了 {batch.counts.COMPLETED} / 失敗 {batch.counts.FAILED}</div>
            {(batch.counts.QUEUED > 0 || batch.counts.RUNNING > 0) && <button disabled={busy} style={{ ...BUTTON, width: '100%', marginTop: 8 }} onClick={runWorker}>workerを3件実行</button>}
          </div>}
          {message && <p style={{ color: '#c6b1e6', fontSize: 10, lineHeight: 1.6 }}>{message}</p>}
        </section>
      </div>

      <section style={{ ...PANEL, padding: 18, marginBottom: 18 }}><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><h2 style={{ color: '#c9b6e8', fontSize: 12, letterSpacing: '0.1em' }}>SCHEDULES</h2><button disabled={busy} style={BUTTON} onClick={saveSchedules}>保存</button></div>
        {schedules.map((schedule, index) => <div key={schedule.id} style={{ display: 'grid', gridTemplateColumns: '40px minmax(150px,1fr) 100px 120px', gap: 10, alignItems: 'center', padding: '10px 0', borderTop: '1px solid rgba(139,0,255,0.12)' }}>
          <input type="checkbox" checked={schedule.enabled} onChange={event => setSchedules(values => values.map((value, i) => i === index ? { ...value, enabled: event.target.checked } : value))} />
          <span style={{ color: '#ddd0ee', fontSize: 11 }}>{schedule.name}</span><span style={{ color: '#8f85a4', fontSize: 10 }}>{schedule.suite}</span><span style={{ color: '#8f85a4', fontSize: 10 }}>{schedule.intervalMinutes} min</span>
        </div>)}
      </section>

      <section style={{ ...PANEL, padding: 18 }}><h2 style={{ color: '#c9b6e8', fontSize: 12, letterSpacing: '0.1em' }}>HISTORY & DIFF</h2>
        <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 780, fontSize: 10 }}><thead><tr>{['日時','suite','cases','clear','Δ clear','Δ p95','regressions'].map(value => <th key={value} style={{ textAlign: 'left', color: '#776d8d', padding: 9, borderBottom: '1px solid rgba(139,0,255,0.24)' }}>{value}</th>)}</tr></thead>
          <tbody>{history.map(entry => <tr key={entry.id}><td style={{ padding: 9, color: '#aaa0bd' }}>{new Date(entry.generatedAt).toLocaleString('ja-JP')}</td><td style={{ padding: 9, color: entry.suite === 'yomi' ? '#c084fc' : '#aaa0bd' }}>{entry.suite}</td><td style={{ padding: 9 }}>{entry.totals.scenarios}</td><td style={{ padding: 9 }}>{pct(entry.totals.simulations ? entry.totals.wins / entry.totals.simulations : 0)}</td><td style={{ padding: 9, color: (entry.comparison?.clearRateDelta ?? 0) < 0 ? '#fb7185' : '#7dd3a8' }}>{entry.comparison ? pct(entry.comparison.clearRateDelta) : '—'}</td><td style={{ padding: 9 }}>{entry.comparison ? entry.comparison.roundsP95Delta.toFixed(1) : '—'}</td><td style={{ padding: 9, color: entry.comparison?.regressions.length ? '#fb7185' : '#68647b' }}>{entry.comparison?.regressions.length ?? 0}</td></tr>)}</tbody></table></div>
      </section>
    </div>
  );
}

