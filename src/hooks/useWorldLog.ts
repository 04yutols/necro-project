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

    const key = process.env.NEXT_PUBLIC_PUSHER_KEY;
    const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER;
    let socket: WebSocket | null = null;
    if (key && cluster) {
      socket = new WebSocket(`wss://ws-${cluster}.pusher.com/app/${key}?protocol=7&client=necro-browser&version=1.0&flash=false`);
      socket.addEventListener('message', (message) => {
        try {
          const packet = JSON.parse(String(message.data)) as { event?: string; data?: string | WorldLogEntry };
          if (packet.event === 'pusher:connection_established') {
            socket?.send(JSON.stringify({ event: 'pusher:subscribe', data: { channel: 'world-log' } }));
            return;
          }
          if (!['UR_DISCOVERED', 'SSR_DISCOVERED', 'BOSS_CLEARED', 'RANKING_UPDATED'].includes(packet.event ?? '')) return;
          const event = typeof packet.data === 'string' ? JSON.parse(packet.data) as WorldLogEntry : packet.data;
          if (!event?.id) return;
          setEvents(prev => [event, ...prev.filter(item => item.id !== event.id)].slice(0, 50));
          setError(null);
        } catch {
          // Pusher is a live enhancement; polling remains the source of truth.
        }
      });
      socket.addEventListener('error', () => {
        if (active) setError('ライブ接続を再試行中です');
      });
    }

    return () => {
      active = false;
      controller.abort();
      window.clearInterval(interval);
      socket?.close();
    };
  }, []);

  return { events, loading, error };
}
