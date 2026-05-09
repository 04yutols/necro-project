import React, { Suspense } from 'react';

// Vite dev 用 next/dynamic shim。
// React.lazy でコード分割し、loading オプションを Suspense fallback に変換する。
export default function dynamic<T extends object>(
  loader: () => Promise<any>,
  opts?: { ssr?: boolean; loading?: () => React.ReactElement | null }
) {
  const Lazy = React.lazy(() =>
    loader().then((m) => (m?.default ? m : { default: m }))
  );
  const loading = opts?.loading ?? null;
  return (props: T) => (
    <Suspense fallback={loading ? loading() : null}>
      <Lazy {...(props as any)} />
    </Suspense>
  );
}
