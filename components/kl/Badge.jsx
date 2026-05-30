const TONES = {
  neutral: { c: 'var(--kl-text-2)', bg: 'var(--kl-surface-2)', bd: 'var(--kl-border)' },
  accent:  { c: 'var(--kl-accent)', bg: 'var(--kl-accent-tint)', bd: 'var(--kl-accent)' },
  ok:      { c: 'var(--kl-ok)',     bg: 'var(--kl-ok-tint)',     bd: 'var(--kl-ok)'     },
  warn:    { c: 'var(--kl-warn)',   bg: 'var(--kl-warn-tint)',   bd: 'var(--kl-warn)'   },
  err:     { c: 'var(--kl-err)',    bg: 'var(--kl-err-tint)',    bd: 'var(--kl-err)'    },
};

export function KLBadge({ children, tone = 'neutral' }) {
  const t = TONES[tone] ?? TONES.neutral;
  return (
    <span
      className="kl-mono"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        fontSize: 10.5,
        fontWeight: 500,
        padding: '1px 7px',
        borderRadius: 5,
        border: `1px solid ${t.bd}33`,
        background: t.bg,
        color: t.c,
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </span>
  );
}
