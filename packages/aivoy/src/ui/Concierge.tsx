import type { CSSProperties } from 'react';
import {
  ConciergeProvider,
  type ConciergeProviderProps,
} from '../core/ConciergeProvider';
import { useConcierge } from '../core/useConcierge';
import { useConciergeContext } from '../core/ConciergeProvider';
import { Launcher } from './Launcher';
import { ChatPanel } from './ChatPanel';

export type ConciergeProps = Omit<ConciergeProviderProps, 'children'>;

/** The main user-facing widget — floating launcher + chat panel. */
export function Concierge(props: ConciergeProps) {
  return (
    <ConciergeProvider {...(props as ConciergeProviderProps)}>
      <ConciergeShell />
    </ConciergeProvider>
  );
}

function ConciergeShell() {
  const { open, setOpen } = useConcierge();
  const { assistant, theme } = useConciergeContext();
  const position = theme.position ?? 'bottom-right';
  const accent = theme.accent ?? '#7c3aed';
  const radius = theme.radius ?? 'lg';
  const mode = theme.mode ?? 'auto';

  const rootStyle = {
    '--aivoy-accent': accent,
  } as CSSProperties;

  return (
    <div
      className="aivoy-root"
      style={rootStyle}
      data-radius={radius}
      data-mode={mode}
      data-position={position}
    >
      {open ? (
        <ChatPanel onClose={() => setOpen(false)} />
      ) : (
        <Launcher
          name={assistant.name}
          avatarUrl={assistant.avatarUrl}
          onClick={() => setOpen(true)}
          position={position}
        />
      )}
    </div>
  );
}
