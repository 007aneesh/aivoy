import Link from 'next/link';
import { UserButton } from '@clerk/nextjs';
import { getOrCreateTenant } from '@/lib/tenant';
import { MobileShellNav } from '@/components/MobileShellNav';
import { DashboardNav } from './DashboardNav';

export const dynamic = 'force-dynamic';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await getOrCreateTenant();

  const sidebarBody = (
    <>
      <Link
        href="/dashboard"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '6px 8px',
          color: 'inherit',
          fontWeight: 700,
          fontSize: 16,
          letterSpacing: '-0.01em',
        }}
      >
        <span className="brand-badge">a</span>
        aivoy
      </Link>

      <DashboardNav />

      <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 8px', borderTop: '1px solid var(--border)' }}>
        <UserButton />
        <Link href="/docs" className="btn btn-ghost btn-sm" style={{ marginLeft: 'auto' }}>
          Docs
        </Link>
      </div>
    </>
  );

  return (
    <div className="app-shell">
      <MobileShellNav brandHref="/dashboard" brandLabel="aivoy">
        {sidebarBody}
      </MobileShellNav>
      <aside className="app-sidebar desktop-only">{sidebarBody}</aside>
      <main className="app-main">
        <div className="app-main-narrow">{children}</div>
      </main>
    </div>
  );
}
