import fs from 'fs';
import os from 'os';
import path from 'path';
import { applyFileTransaction, inspectFileTransaction, makeSnapshotName, undoFileTransaction } from './contentTransaction';

describe('content file transaction', () => {
  const tempRoots: string[] = [];

  afterEach(() => {
    for (const tempRoot of tempRoots.splice(0)) fs.rmSync(tempRoot, { recursive: true, force: true });
  });

  function makeRoot(): string {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'necro-content-transaction-'));
    tempRoots.push(root);
    fs.mkdirSync(path.join(root, '.content-snapshots'), { recursive: true });
    return root;
  }

  test('既存JSONと新規assetを同じsnapshotから復元する', () => {
    const root = makeRoot();
    fs.mkdirSync(path.join(root, 'src/data'), { recursive: true });
    fs.writeFileSync(path.join(root, 'src/data/master.json'), '{"old":true}\n');
    const snapshotName = makeSnapshotName('test_package', new Date('2026-07-31T00:00:00.000Z'));
    const applied = applyFileTransaction({
      rootDir: root,
      snapshotRootDir: path.join(root, '.content-snapshots'),
      snapshotName,
      packageId: 'test_package',
      packageRevision: 1,
      writes: new Map([
        ['src/data/master.json', '{"new":true}\n'],
        ['public/images/generated/test/icon.webp', Buffer.from('asset')],
      ]),
      createdAt: '2026-07-31T00:00:00.000Z',
    });

    expect(fs.readFileSync(path.join(root, 'src/data/master.json'), 'utf8')).toBe('{"new":true}\n');
    expect(fs.readFileSync(path.join(root, 'public/images/generated/test/icon.webp'), 'utf8')).toBe('asset');
    expect(applied.manifest.files).toHaveLength(2);

    undoFileTransaction({
      rootDir: root,
      snapshotRootDir: path.join(root, '.content-snapshots'),
      snapshotPath: applied.snapshotPath,
    });
    expect(fs.readFileSync(path.join(root, 'src/data/master.json'), 'utf8')).toBe('{"old":true}\n');
    expect(fs.existsSync(path.join(root, 'public/images/generated/test/icon.webp'))).toBe(false);
  });

  test('適用後に編集されたファイルはforceなしでundoしない', () => {
    const root = makeRoot();
    fs.writeFileSync(path.join(root, 'tracked.txt'), 'before');
    const applied = applyFileTransaction({
      rootDir: root,
      snapshotRootDir: path.join(root, '.content-snapshots'),
      snapshotName: makeSnapshotName('test_package', new Date('2026-07-31T00:00:00.000Z')),
      packageId: 'test_package',
      packageRevision: 1,
      writes: new Map([['tracked.txt', 'applied']]),
    });
    fs.writeFileSync(path.join(root, 'tracked.txt'), 'edited-after-apply');
    const inspection = inspectFileTransaction({
      rootDir: root,
      snapshotRootDir: path.join(root, '.content-snapshots'),
      snapshotPath: applied.snapshotPath,
    });
    expect(inspection.hasConflicts).toBe(true);
    expect(inspection.files).toEqual([
      expect.objectContaining({ targetPath: 'tracked.txt', currentExists: true, conflict: true }),
    ]);
    expect(() => undoFileTransaction({
      rootDir: root,
      snapshotRootDir: path.join(root, '.content-snapshots'),
      snapshotPath: applied.snapshotPath,
    })).toThrow('Undo conflict');
    expect(fs.readFileSync(path.join(root, 'tracked.txt'), 'utf8')).toBe('edited-after-apply');
  });

  test('symlinkされた親ディレクトリからroot外へ書き込まない', () => {
    const root = makeRoot();
    const outside = makeRoot();
    fs.symlinkSync(outside, path.join(root, 'linked-outside'), 'dir');
    expect(() => applyFileTransaction({
      rootDir: root,
      snapshotRootDir: path.join(root, '.content-snapshots'),
      snapshotName: makeSnapshotName('test_package', new Date('2026-07-31T00:00:00.000Z')),
      packageId: 'test_package',
      packageRevision: 1,
      writes: new Map([['linked-outside/escaped.txt', 'blocked']]),
    })).toThrow('symlink');
    expect(fs.existsSync(path.join(outside, 'escaped.txt'))).toBe(false);
  });
});
