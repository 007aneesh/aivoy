'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const ITEMS: { href: string; label: string; section?: string }[] = [
  { href: '/dashboard',           label: 'Overview',    section: 'GENERAL' },
  { href: '/dashboard/assistant', label: 'Assistant' },
  { href: '/dashboard/providers', label: 'Providers' },
  { href: '/dashboard/tools',     label: 'Tools' },
  { href: '/dashboard/tokens',    label: 'Tokens',      section: 'INTEGRATION' },
  { href: '/dashboard/playground', label: 'Playground' },
  { href: '/dashboard/usage',     label: 'Usage' },
];

export function DashboardNav() {
  const pathname = usePathname();
  return (
    <nav style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 1 }}>
      {ITEMS.map((item, idx) => {
        const isActive =
          item.href === '/dashboard'
            ? pathname === '/dashboard'
            : pathname?.startsWith(item.href);
        const showHeader = item.section && (idx === 0 || ITEMS[idx - 1].section !== item.section);
        return (
          <div key={item.href}>
            {showHeader && (
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  color: 'var(--muted)',
                  letterSpacing: '0.08em',
                  padding: '14px 8px 4px',
                }}
              >
                {item.section}
              </div>
            )}
            <Link
              href={item.href}
              style={{
                display: 'block',
                padding: '7px 10px',
                borderRadius: 6,
                fontSize: 13,
                color: isActive ? 'var(--accent)' : 'var(--fg-soft)',
                background: isActive ? 'var(--accent-soft)' : 'transparent',
                fontWeight: isActive ? 500 : 400,
                textDecoration: 'none',
                transition: 'background-color 120ms, color 120ms',
              }}
            >
              {item.label}
            </Link>
          </div>
        );
      })}
    </nav>
  );
}
