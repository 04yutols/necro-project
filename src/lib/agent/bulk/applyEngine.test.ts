import { applyChangesWithWriter, type ApplyWriter } from './applyEngine';
import type { BulkChange } from './bulkEngine';

// 注: モック Writer を使い、ディスクには一切触れない。

function changes(ids: string[]): BulkChange[] {
  return ids.map((id) => ({ id, before: { x: 1 }, after: { x: 2 }, diff: [] }));
}

describe('applyChangesWithWriter', () => {
  it('saves all and collects savedIds when writer succeeds', async () => {
    const calls: { id: string; after: unknown }[] = [];
    const writer: ApplyWriter = async (id, after) => {
      calls.push({ id, after });
      return { success: true };
    };
    const res = await applyChangesWithWriter(changes(['a', 'b', 'c']), writer);
    expect(res.savedIds).toEqual(['a', 'b', 'c']);
    expect(res.failedIds).toHaveLength(0);
    expect(calls.map((c) => c.id)).toEqual(['a', 'b', 'c']);
    expect(calls[0].after).toEqual({ x: 2 });
  });

  it('continues after a partial failure and records failedIds', async () => {
    const writer: ApplyWriter = async (id) =>
      id === 'b' ? { success: false, error: 'disk full' } : { success: true };
    const res = await applyChangesWithWriter(changes(['a', 'b', 'c']), writer);
    expect(res.savedIds).toEqual(['a', 'c']);
    expect(res.failedIds).toEqual([{ id: 'b', error: 'disk full' }]);
  });

  it('treats a thrown writer error as a failure', async () => {
    const writer: ApplyWriter = async (id) => {
      if (id === 'b') throw new Error('boom');
      return { success: true };
    };
    const res = await applyChangesWithWriter(changes(['a', 'b']), writer);
    expect(res.savedIds).toEqual(['a']);
    expect(res.failedIds[0].id).toBe('b');
    expect(res.failedIds[0].error).toContain('boom');
  });

  it('no-op on empty changes', async () => {
    const writer: ApplyWriter = async () => ({ success: true });
    const res = await applyChangesWithWriter([], writer);
    expect(res.savedIds).toHaveLength(0);
    expect(res.failedIds).toHaveLength(0);
  });
});
