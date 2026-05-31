import { notFound } from 'next/navigation';
import AdminNav from '@/components/admin/AdminNav';

// Force dynamic rendering so Next.js never tries to statically pre-render
// admin pages at build time (they require the filesystem at runtime).
export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'NECRO ADMIN — Master Data Studio',
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  if (process.env.NODE_ENV !== 'development') {
    notFound();
  }

  return (
    <div className="min-h-screen" style={{ background: '#08080f', color: '#c8c8d8' }}>
      <AdminNav />
      <main>{children}</main>
    </div>
  );
}
