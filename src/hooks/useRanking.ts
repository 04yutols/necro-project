'use client';

import { useEffect, useState } from 'react';
import type { RankingEntry, RankingType } from '../types/online';

export function useRanking(type: RankingType, options: { stageId?: string; limit?: number } = {}) {
  const [entries, setEntries] = useState<RankingEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const stageId = options.stageId;
  const limit = options.limit ?? 10;

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ type, limit: String(limit) });
    if (stageId) params.set('stageId', stageId);

    const load = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/ranking?${params.toString()}`, { cache: 'no-store', signal: controller.signal });
        if (!response.ok) throw new Error('ranking failed');
        const json = await response.json() as { data?: RankingEntry[] };
        setEntries(json.data ?? []);
        setError(null);
      } catch {
        if (!controller.signal.aborted) setError('ランキングを取得できません');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };

    void load();
    return () => controller.abort();
  }, [limit, stageId, type]);

  return { entries, loading, error };
}
