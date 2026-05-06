'use client';

interface Point {
  date: string;
  messages: number;
}

/**
 * Tiny inline-SVG bar chart. Avoids pulling in a chart library — phase 5
 * doesn't need anything more sophisticated and bundle-size matters here.
 */
export function UsageChart({ data }: { data: Point[] }) {
  const max = Math.max(1, ...data.map((p) => p.messages));
  const W = 600;
  const H = 120;
  const PAD_X = 8;
  const PAD_Y = 12;
  const innerW = W - PAD_X * 2;
  const innerH = H - PAD_Y * 2;
  const barW = innerW / data.length - 2;

  return (
    <div style={{ padding: 16, overflowX: 'auto' }}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        width="100%"
        height={H}
        style={{ display: 'block' }}
        role="img"
        aria-label="Daily message volume — last 30 days"
      >
        <line
          x1={PAD_X}
          y1={H - PAD_Y}
          x2={W - PAD_X}
          y2={H - PAD_Y}
          stroke="var(--border)"
          strokeWidth={1}
        />
        {data.map((p, i) => {
          const h = p.messages > 0 ? (p.messages / max) * innerH : 0;
          const x = PAD_X + i * (innerW / data.length) + 1;
          const y = H - PAD_Y - h;
          const isToday = i === data.length - 1;
          return (
            <g key={p.date}>
              <rect
                x={x}
                y={y}
                width={barW}
                height={h}
                fill={isToday ? 'var(--accent)' : 'var(--accent-soft)'}
                rx={2}
              >
                <title>{`${p.date}: ${p.messages} message${p.messages === 1 ? '' : 's'}`}</title>
              </rect>
            </g>
          );
        })}
      </svg>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: 11,
          color: 'var(--muted)',
          marginTop: 4,
        }}
      >
        <span>{data[0]?.date}</span>
        <span>today</span>
      </div>
    </div>
  );
}
