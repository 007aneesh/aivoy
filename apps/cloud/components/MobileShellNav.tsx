'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

export function MobileShellNav({
  brandHref = '/',
  brandLabel,
  children,
}: {
  brandHref?: string;
  brandLabel: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open]);

  return (
    <>
      <header className="docs-topbar">
        <Link href={brandHref} className="docs-topbar-brand" onClick={() => setOpen(false)}>
          <span className="brand-badge">a</span>
          {brandLabel}
        </Link>
        <button
          type="button"
          className="docs-topbar-toggle"
          aria-expanded={open}
          aria-controls="mobile-shell-drawer"
          aria-label={open ? 'Close menu' : 'Open menu'}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <CloseIcon /> : <MenuIcon />}
        </button>
      </header>

      <div
        id="mobile-shell-drawer"
        className={`docs-drawer-backdrop${open ? ' is-open' : ''}`}
        onClick={() => setOpen(false)}
        aria-hidden={!open}
      >
        <nav
          className="docs-drawer"
          role="dialog"
          aria-modal="true"
          aria-label="Navigation"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="docs-drawer-content" onClick={() => setOpen(false)}>
            {children}
          </div>
        </nav>
      </div>
    </>
  );
}

function MenuIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <line x1="4" y1="7" x2="20" y2="7" />
      <line x1="4" y1="12" x2="20" y2="12" />
      <line x1="4" y1="17" x2="20" y2="17" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <line x1="6" y1="6" x2="18" y2="18" />
      <line x1="18" y1="6" x2="6" y2="18" />
    </svg>
  );
}
