/**
 * マスターデータのスナップショット（一括変更の undo / 復旧用）。
 *
 * 設計書 106 R-2: 一括適用は不可逆だった。適用前にファイル全体を退避し、
 * 「元に戻す」を可能にする。ディレクトリは引数で注入する（本番=src/data/master/.snapshots,
 * テスト=一時ディレクトリ）ため、テストが実データに一切触れずに IO を検証できる。
 */

import fs from 'fs';
import path from 'path';

export type SnapshotMeta = {
  id: string; // ファイル名（{file}__{timestamp}.json）
  file: string; // 'skills' 等
  timestamp: string; // ISO
  entityCount: number;
  reason?: string;
};

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function safeTimestamp(): string {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

/** 同一ミリ秒内の連続書き込みでも id が衝突しないための連番。 */
let snapshotSeq = 0;

/**
 * コレクション全体を snapshotDir に退避する。
 * @returns 作成したスナップショットのメタ
 */
export function writeSnapshot(
  snapshotDir: string,
  file: string,
  data: Record<string, unknown>,
  reason?: string,
): SnapshotMeta {
  ensureDir(snapshotDir);
  const timestamp = new Date().toISOString();
  snapshotSeq = (snapshotSeq + 1) % 1000;
  const id = `${file}__${safeTimestamp()}-${String(snapshotSeq).padStart(3, '0')}.json`;
  const payload = { __meta: { file, timestamp, reason }, data };
  fs.writeFileSync(path.join(snapshotDir, id), JSON.stringify(payload, null, 2), 'utf-8');
  return { id, file, timestamp, entityCount: Object.keys(data).length, reason };
}

/** スナップショット一覧（新しい順）。file 指定でその file のみ。 */
export function listSnapshots(snapshotDir: string, file?: string): SnapshotMeta[] {
  if (!fs.existsSync(snapshotDir)) return [];
  const metas: SnapshotMeta[] = [];
  for (const name of fs.readdirSync(snapshotDir)) {
    if (!name.endsWith('.json')) continue;
    if (file && !name.startsWith(`${file}__`)) continue;
    try {
      const raw = JSON.parse(fs.readFileSync(path.join(snapshotDir, name), 'utf-8')) as {
        __meta?: { file?: string; timestamp?: string; reason?: string };
        data?: Record<string, unknown>;
      };
      metas.push({
        id: name,
        file: raw.__meta?.file ?? name.split('__')[0],
        timestamp: raw.__meta?.timestamp ?? '',
        entityCount: raw.data ? Object.keys(raw.data).length : 0,
        reason: raw.__meta?.reason,
      });
    } catch {
      // 壊れたスナップショットは無視
    }
  }
  // timestamp 降順、同時刻は id（連番含む）降順で決定論的に
  return metas.sort((a, b) => (a.timestamp === b.timestamp ? (a.id < b.id ? 1 : -1) : a.timestamp < b.timestamp ? 1 : -1));
}

/** スナップショットの中身（コレクション）を読み出す。 */
export function readSnapshot(snapshotDir: string, id: string): Record<string, unknown> | null {
  const p = path.join(snapshotDir, id);
  if (!fs.existsSync(p)) return null;
  try {
    const raw = JSON.parse(fs.readFileSync(p, 'utf-8')) as { data?: Record<string, unknown> };
    return raw.data ?? null;
  } catch {
    return null;
  }
}

/**
 * スナップショットを対象マスターファイルへ書き戻す（復元）。
 * targetFilePath を直接上書きする（= スナップショット時点の完全復元）。
 */
export function restoreSnapshot(snapshotDir: string, id: string, targetFilePath: string): { ok: boolean; entityCount: number; error?: string } {
  const data = readSnapshot(snapshotDir, id);
  if (!data) return { ok: false, entityCount: 0, error: 'スナップショットが見つからないか壊れています。' };
  try {
    fs.writeFileSync(targetFilePath, JSON.stringify(data, null, 2), 'utf-8');
    return { ok: true, entityCount: Object.keys(data).length };
  } catch (e) {
    return { ok: false, entityCount: 0, error: e instanceof Error ? e.message : String(e) };
  }
}

/** 古いスナップショットを keep 件残して削除（任意・容量管理用）。 */
export function pruneSnapshots(snapshotDir: string, file: string, keep: number): number {
  const metas = listSnapshots(snapshotDir, file);
  let removed = 0;
  for (const m of metas.slice(keep)) {
    try {
      fs.unlinkSync(path.join(snapshotDir, m.id));
      removed++;
    } catch {
      // ignore
    }
  }
  return removed;
}
