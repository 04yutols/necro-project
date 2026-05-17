import crypto from 'node:crypto';
import { prisma } from '../lib/prisma';
import type { Prisma, WorldLog } from '@prisma/client';
import type { WorldEventType, WorldLogEntry } from '../types/online';

type WorldEventPayload = Record<string, unknown>;

function toWorldLogEntry(row: WorldLog): WorldLogEntry {
  return {
    id: row.id,
    type: row.type as WorldEventType,
    payload: row.payload as WorldEventPayload,
    authorId: row.authorId,
    createdAt: row.createdAt.toISOString(),
  };
}

function getPusherConfig() {
  const appId = process.env.PUSHER_APP_ID;
  const key = process.env.NEXT_PUBLIC_PUSHER_KEY;
  const secret = process.env.PUSHER_SECRET;
  const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER ?? process.env.PUSHER_CLUSTER;
  if (!appId || !key || !secret || !cluster) return null;
  return { appId, key, secret, cluster };
}

async function triggerPusher(event: WorldLogEntry): Promise<void> {
  const config = getPusherConfig();
  if (!config) return;

  const body = JSON.stringify({
    name: event.type,
    channels: ['world-log'],
    data: JSON.stringify(event),
  });
  const bodyMd5 = crypto.createHash('md5').update(body).digest('hex');
  const authTimestamp = Math.floor(Date.now() / 1000).toString();
  const params = new URLSearchParams({
    auth_key: config.key,
    auth_timestamp: authTimestamp,
    auth_version: '1.0',
    body_md5: bodyMd5,
  });
  params.sort();
  const path = `/apps/${config.appId}/events`;
  const signatureBase = ['POST', path, params.toString()].join('\n');
  const signature = crypto.createHmac('sha256', config.secret).update(signatureBase).digest('hex');
  params.set('auth_signature', signature);

  const response = await fetch(`https://api-${config.cluster}.pusher.com${path}?${params.toString()}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  });

  if (!response.ok) {
    console.warn(`Pusher trigger failed: ${response.status}`);
  }
}

export async function createWorldEvent(
  tx: Prisma.TransactionClient,
  type: WorldEventType,
  payload: WorldEventPayload,
  authorId?: string | null,
): Promise<WorldLogEntry> {
  const row = await tx.worldLog.create({
    data: {
      type,
      payload: payload as Prisma.InputJsonObject,
      authorId: authorId ?? null,
    },
  });
  return toWorldLogEntry(row);
}

export async function emitWorldEvent(
  type: WorldEventType,
  payload: WorldEventPayload,
  authorId?: string | null,
): Promise<WorldLogEntry> {
  const row = await prisma.worldLog.create({
    data: {
      type,
      payload: payload as Prisma.InputJsonObject,
      authorId: authorId ?? null,
    },
  });
  const event = toWorldLogEntry(row);
  await triggerPusher(event).catch(() => undefined);
  return event;
}

export async function publishWorldEvents(events: WorldLogEntry[]): Promise<void> {
  await Promise.all(events.map(event => triggerPusher(event).catch(() => undefined)));
}

export async function getRecentWorldEvents(limit = 50): Promise<WorldLogEntry[]> {
  const rows = await prisma.worldLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: Math.min(Math.max(limit, 1), 100),
  });
  return rows.map(toWorldLogEntry);
}
