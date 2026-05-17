'use client';

import { useEffect, useState } from 'react';
import type { WorldLogEntry } from '../types/online';

async function fetchWorldLog(signal?: AbortSignal): Promise<WorldLogEntry[]> {
  const response = await fetch('/api/world-log?limit=50', { cache: 'no-store', signal });
  if (!response.ok) return [];
  const json = await response.json() as { events?: WorldLogEntry[] };
  return json.events ?? [];
}

export function useWorldLog() {
  const [events, setEvents] = useState<WorldLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    const load = async () => {
      try {
        const next = await fetchWorldLog(controller.signal);
        if (!active) return;
        setEvents(next);
        setError(null);
      } catch {
        if (!active || controller.signal.aborted) return;
        setError('世界ログを取得できません');
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();
    const interval = window.setInterval(load, 30000);
    return () => {
      active = false;
      controller.abort();
      window.clearInterval(interval);
    };
  }, []);

  return { events, loading, error };
}
