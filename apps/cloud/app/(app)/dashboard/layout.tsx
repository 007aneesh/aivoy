import Link from 'next/link';
import { UserButton } from '@clerk/nextjs';
import { getOrCreateTenant } from '@/lib/tenant';

// Dashboard pages depend on the signed-in user and the database — never static.
export const dynamic = 'force-dynamic';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Ensures the tenant row exists before any dashboard page renders.
  await getOrCreateTenant();

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <aside
        style={{
          width: 240,
          borderRight: '1px solid var(--border)',
          padding: 20,
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
        }}
      >
        <Link
          href="/dashboard"
          style={{ fontWeight: 700, fontSize: 18, color: 'inherit' }}
        >
          aivoy
        </Link>
        <nav
          style={{
            marginTop: 20,
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
          }}
        >
          <NavLink href="/dashboard">Overview</NavLink>
          <NavLink href="/dashboard/assistant">Assistant</NavLink>
          <NavLink href="/dashboard/providers">Providers</NavLink>
          <NavLink href="/dashboard/tools">Tools</NavLink>
          <NavLink href="/dashboard/tokens">Tokens</NavLink>
          <NavLink href="/dashboard/playground">Playground</NavLink>
          <NavLink href="/dashboard/usage">Usage</NavLink>
        </nav>
        <div style={{ marginTop: 'auto' }}>
          <UserButton />
        </div>
      </aside>
      <main style={{ flex: 1, padding: '32px 40px' }}>{children}</main>
    </div>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      style={{
        padding: '6px 8px',
        borderRadius: 6,
        color: 'inherit',
      }}
    >
      {children}
    </Link>
  );
}
