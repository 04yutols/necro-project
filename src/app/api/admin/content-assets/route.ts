import * as fs from 'fs/promises';
import path from 'path';
import { NextRequest, NextResponse } from 'next/server';
import { standardAssetContactSheetPath } from '@/lib/content/assetSpec';
import type { ContentPackage } from '@/lib/content/contentPackage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ROOT = process.cwd();
const PACKAGES_DIR = path.join(ROOT, 'content/packages');

function validId(value: string | null): value is string {
  return typeof value === 'string' && /^[a-z][a-z0-9_]*$/.test(value);
}

async function findPackage(packageId: string): Promise<ContentPackage | undefined> {
  const entries = await fs.readdir(PACKAGES_DIR, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.json')) continue;
    try {
      const pkg = JSON.parse(await fs.readFile(path.join(PACKAGES_DIR, entry.name), 'utf8')) as ContentPackage;
      if (pkg.schemaVersion === 2 && pkg.id === packageId) return pkg;
    } catch {
      // A malformed draft is surfaced by content:validate; the preview skips it.
    }
  }
  return undefined;
}

async function safeAssetFile(repositoryPath: string): Promise<string | undefined> {
  const root = await fs.realpath(ROOT);
  const candidate = path.resolve(root, repositoryPath);
  const relative = path.relative(root, candidate);
  if (relative.startsWith('..') || path.isAbsolute(relative)) return undefined;
  const allowedPrefix = 'content/packages/';
  if (!relative.replaceAll(path.sep, '/').startsWith(allowedPrefix)) return undefined;
  try {
    const resolved = await fs.realpath(candidate);
    const resolvedRelative = path.relative(root, resolved).replaceAll(path.sep, '/');
    return resolvedRelative.startsWith(allowedPrefix) ? resolved : undefined;
  } catch {
    return undefined;
  }
}

function mediaType(filePath: string): string {
  const extension = path.extname(filePath).toLowerCase();
  if (extension === '.webp') return 'image/webp';
  if (extension === '.png') return 'image/png';
  if (extension === '.jpg' || extension === '.jpeg') return 'image/jpeg';
  if (extension === '.svg') return 'image/svg+xml';
  return 'application/octet-stream';
}

export async function GET(request: NextRequest): Promise<Response> {
  if (process.env.NODE_ENV !== 'development') return new NextResponse(null, { status: 404 });
  const packageId = request.nextUrl.searchParams.get('packageId');
  const assetId = request.nextUrl.searchParams.get('assetId');
  const evidenceName = request.nextUrl.searchParams.get('evidence');
  const contactSheet = request.nextUrl.searchParams.get('contactSheet') === '1';
  const evidenceRequested = typeof evidenceName === 'string' && /^[a-z0-9_-]+\.svg$/.test(evidenceName);
  if (!validId(packageId) || (!contactSheet && !evidenceRequested && !validId(assetId))) return NextResponse.json({ error: 'invalid request' }, { status: 400 });
  const pkg = await findPackage(packageId);
  if (!pkg) return new NextResponse(null, { status: 404 });
  const repositoryPath = contactSheet
    ? standardAssetContactSheetPath(pkg.id)
    : evidenceRequested
      ? pkg.evidence.find(item => item.artifactPath === `content/packages/${pkg.id}/reviews/${evidenceName}`)?.artifactPath
    : (() => {
        const asset = pkg.assets.find(item => item.id === assetId && item.mediaType === 'image');
        return asset?.sourcePath ?? asset?.originalPath;
      })();
  if (!repositoryPath) return new NextResponse(null, { status: 404 });
  const file = await safeAssetFile(repositoryPath);
  if (!file) return new NextResponse(null, { status: 404 });
  const body = await fs.readFile(file);
  return new Response(body, {
    headers: {
      'Content-Type': mediaType(file),
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
