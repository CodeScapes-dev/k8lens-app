const KIND_COLOR = {
  ok: 'var(--kl-ok)',
  warn: 'var(--kl-warn)',
  err: 'var(--kl-err)',
  info: 'var(--kl-info)',
  muted: 'var(--kl-text-faint)',
};

export function KLStatus({ kind = 'ok', dotOnly = false, children }) {
  const color = KIND_COLOR[kind] || KIND_COLOR.muted;
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        fontFamily: 'var(--font-mono)',
        fontSize: 11.5,
        fontWeight: 500,
        color,
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: 999,
          background: color,
          flexShrink: 0,
        }}
      />
      {!dotOnly && children}
    </span>
  );
}
