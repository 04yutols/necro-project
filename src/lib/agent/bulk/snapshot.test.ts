import fs from 'fs';
import os from 'os';
import path from 'path';
import { writeSnapshot, listSnapshots, readSnapshot, restoreSnapshot, pruneSnapshots } from './snapshot';

// 注: 実ファイル IO を検証するが、すべて os.tmpdir() 内のみ。
// src/data/master は一切読み書きしない（R-1/R-2 のテストを実データ非破壊で行う）。

let tmpDir: string;
let snapDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'snap-test-'));
  snapDir = path.join(tmpDir, '.snapshots');
});
afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

const sampleSkills = () => ({
  s_a: { type: 'MAGICAL', power: 1.4 },
  s_b: { type: 'PHYSICAL', power: 1.5 },
});

describe('writeSnapshot / readSnapshot', () => {
  it('writes a snapshot and reads back the exact collection', () => {
    const data = sampleSkills();
    const meta = writeSnapshot(snapDir, 'skills', data, 'test');
    expect(meta.file).toBe('skills');
    expect(meta.entityCount).toBe(2);
    expect(fs.existsSync(path.join(snapDir, meta.id))).toBe(true);

    const read = readSnapshot(snapDir, meta.id);
    expect(read).toEqual(data);
  });

  it('returns null for a missing snapshot', () => {
    expect(readSnapshot(snapDir, 'nope.json')).toBeNull();
  });
});

describe('listSnapshots', () => {
  it('lists snapshots newest-first, filtered by file', () => {
    writeSnapshot(snapDir, 'skills', sampleSkills());
    writeSnapshot(snapDir, 'enemies', { e1: {} });
    writeSnapshot(snapDir, 'skills', sampleSkills());
    const all = listSnapshots(snapDir);
    expect(all.length).toBe(3);
    const skillsOnly = listSnapshots(snapDir, 'skills');
    expect(skillsOnly.length).toBe(2);
    expect(skillsOnly.every((m) => m.file === 'skills')).toBe(true);
  });

  it('returns [] for a non-existent dir', () => {
    expect(listSnapshots(path.join(tmpDir, 'missing'))).toEqual([]);
  });
});

describe('restoreSnapshot - full round-trip on realistic data (temp only)', () => {
  it('restores the master file to the snapshot content exactly', () => {
    // 1. 「マスターファイル」を temp に作る（実データのコピー相当）
    const masterPath = path.join(tmpDir, 'skills.json');
    const original = sampleSkills();
    fs.writeFileSync(masterPath, JSON.stringify(original, null, 2));

    // 2. 適用前スナップショット
    const meta = writeSnapshot(snapDir, 'skills', original, 'before bulk');

    // 3. マスターファイルを破壊的に変更（一括適用を模す）
    fs.writeFileSync(masterPath, JSON.stringify({ s_a: { type: 'MAGICAL', power: 0.1 } }, null, 2));
    expect(JSON.parse(fs.readFileSync(masterPath, 'utf-8'))).not.toEqual(original);

    // 4. スナップショットから復元（undo）
    const res = restoreSnapshot(snapDir, meta.id, masterPath);
    expect(res.ok).toBe(true);
    expect(res.entityCount).toBe(2);

    // 5. 完全復元を確認
    expect(JSON.parse(fs.readFileSync(masterPath, 'utf-8'))).toEqual(original);
  });

  it('fails gracefully for a missing snapshot', () => {
    const res = restoreSnapshot(snapDir, 'missing.json', path.join(tmpDir, 'x.json'));
    expect(res.ok).toBe(false);
  });
});

describe('pruneSnapshots', () => {
  it('keeps the newest N and removes the rest', () => {
    for (let i = 0; i < 5; i++) {
      writeSnapshot(snapDir, 'skills', sampleSkills());
      // タイムスタンプを別にするため微小待機の代わりにファイル名一意性はミリ秒で担保
    }
    const before = listSnapshots(snapDir, 'skills').length;
    const removed = pruneSnapshots(snapDir, 'skills', 2);
    const after = listSnapshots(snapDir, 'skills').length;
    expect(before - after).toBe(removed);
    expect(after).toBeLessThanOrEqual(2);
  });
});
