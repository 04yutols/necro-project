import * as fs from 'fs/promises';
import path from 'path';
import type { ContentPackage } from '@/lib/content/contentPackage';

export const dynamic = 'force-dynamic';

type PackagePreview = {
  pkg: ContentPackage;
  hasContactSheet: boolean;
};

async function loadPackages(): Promise<PackagePreview[]> {
  const root = process.cwd();
  const directory = path.join(root, 'content/packages');
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const packages: PackagePreview[] = [];
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.json')) continue;
    try {
      const pkg = JSON.parse(await fs.readFile(path.join(directory, entry.name), 'utf8')) as ContentPackage;
      if (pkg.schemaVersion !== 2 || !Array.isArray(pkg.assets)) continue;
      let hasContactSheet = false;
      try {
        await fs.access(path.join(root, `content/packages/${pkg.id}/reviews/contact-sheet.webp`));
        hasContactSheet = true;
      } catch {
        hasContactSheet = false;
      }
      packages.push({ pkg, hasContactSheet });
    } catch {
      // Invalid drafts are handled by the package validator.
    }
  }
  return packages.sort((a, b) => a.pkg.id.localeCompare(b.pkg.id));
}

const badgeColor: Record<string, string> = {
  READY: '#65d9a6',
  PLANNED: '#d4af37',
  BLOCKED: '#f87171',
};

export default async function AssetForgePage() {
  const packages = await loadPackages();
  const assetCount = packages.reduce((sum, item) => sum + item.pkg.assets.filter(asset => asset.mediaType === 'image').length, 0);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
        <div>
          <p className="text-[10px] font-space tracking-[0.28em] uppercase mb-2" style={{ color: '#8B00FF' }}>Visual Asset Forge</p>
          <h1 className="font-cinzel text-xl font-bold tracking-widest" style={{ color: '#eadfff' }}>画像マニフェスト・プレビュー</h1>
          <p className="text-xs mt-2 max-w-2xl" style={{ color: '#8f86a6' }}>
            原本、WebP最適化結果、寸法、alpha、安全領域、生成プロンプト参照をContent Package単位で確認します。
          </p>
        </div>
        <div className="px-4 py-2 rounded-lg text-xs font-mono" style={{ background: '#111018', border: '1px solid rgba(139,0,255,0.3)', color: '#c4b5fd' }}>
          {packages.length} packages · {assetCount} images
        </div>
      </div>

      {packages.every(item => item.pkg.assets.length === 0) ? (
        <div className="rounded-xl p-8 text-sm" style={{ background: '#111018', border: '1px solid rgba(139,0,255,0.2)', color: '#8f86a6' }}>
          AssetSpec付き画像はまだありません。`npm run content:assets:prompts -- &lt;package.json&gt;` で生成キューを作成できます。
        </div>
      ) : (
        <div className="space-y-10">
          {packages.filter(item => item.pkg.assets.some(asset => asset.mediaType === 'image')).map(({ pkg, hasContactSheet }) => (
            <section key={pkg.id} className="rounded-2xl p-4 sm:p-6" style={{ background: '#0e0b15', border: '1px solid rgba(139,0,255,0.22)' }}>
              <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
                <div>
                  <h2 className="font-cinzel text-base font-bold" style={{ color: '#e0d0ff' }}>{pkg.title}</h2>
                  <p className="text-[10px] font-mono mt-1" style={{ color: '#776d8e' }}>{pkg.id} · revision {pkg.revision} · {pkg.status}</p>
                </div>
                {hasContactSheet && (
                  <a
                    href={`/api/admin/content-assets?packageId=${encodeURIComponent(pkg.id)}&contactSheet=1`}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3 py-2 rounded text-xs font-space"
                    style={{ color: '#d8c7ff', border: '1px solid rgba(139,0,255,0.38)', background: 'rgba(139,0,255,0.12)' }}
                  >
                    コンタクトシートを開く ↗
                  </a>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {pkg.assets.filter(asset => asset.mediaType === 'image').map(asset => (
                  <article key={asset.id} className="rounded-xl overflow-hidden" style={{ background: '#08060d', border: '1px solid rgba(139,0,255,0.18)' }}>
                    <div className="h-72 p-4 flex items-center justify-center" style={{ background: 'radial-gradient(circle at 50% 45%, rgba(139,0,255,0.14), rgba(4,2,9,0.96) 68%)' }}>
                      {(asset.sourcePath || asset.originalPath) ? (
                        <img
                          src={`/api/admin/content-assets?packageId=${encodeURIComponent(pkg.id)}&assetId=${encodeURIComponent(asset.id)}`}
                          alt={pkg.localization.find(item => item.ownerId === asset.ownerId && item.locale === 'ja' && item.kind === 'alt')?.text ?? asset.kind}
                          className="max-w-full max-h-full object-contain"
                        />
                      ) : (
                        <span className="text-xs" style={{ color: '#655d75' }}>原本待ち</span>
                      )}
                    </div>
                    <div className="p-4" style={{ borderTop: '1px solid rgba(139,0,255,0.14)' }}>
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="text-xs font-mono font-bold" style={{ color: '#e6dcf7' }}>{asset.id}</h3>
                        <span className="text-[9px] font-space font-bold tracking-wider" style={{ color: badgeColor[asset.state] ?? '#aaa' }}>{asset.state}</span>
                      </div>
                      <dl className="grid grid-cols-[78px_1fr] gap-x-2 gap-y-1 mt-3 text-[10px]">
                        <dt style={{ color: '#6f667e' }}>usage</dt><dd style={{ color: '#a99fba' }}>{asset.spec?.usage ?? '未指定'}</dd>
                        <dt style={{ color: '#6f667e' }}>size</dt><dd style={{ color: '#a99fba' }}>{asset.width ?? asset.spec?.width ?? '—'} × {asset.height ?? asset.spec?.height ?? '—'}</dd>
                        <dt style={{ color: '#6f667e' }}>alpha</dt><dd style={{ color: '#a99fba' }}>{asset.alpha === undefined ? asset.spec?.transparency ?? '—' : String(asset.alpha)}</dd>
                        <dt style={{ color: '#6f667e' }}>bytes</dt><dd style={{ color: '#a99fba' }}>{asset.bytes?.toLocaleString() ?? '—'}</dd>
                        <dt style={{ color: '#6f667e' }}>prompt</dt><dd className="truncate" style={{ color: '#a99fba' }}>{asset.provenancePromptRef ?? '—'}</dd>
                      </dl>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
