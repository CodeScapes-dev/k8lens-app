import { formatLabel } from '@/lib/k8s/utils';

export function Panel({ title, subtitle, children, rowAction, style }) {
  return (
    <div
      style={{
        background: 'var(--kl-surface)',
        border: '1px solid var(--kl-border)',
        borderRadius: 10,
        ...style,
      }}
    >
      <div
        style={{
          padding: '11px 16px',
          borderBottom: '1px solid var(--kl-border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div>
          <div style={{ fontSize: 13.5, fontWeight: 600, letterSpacing: -0.2, color: 'var(--kl-text)' }}>
            {formatLabel(title)}
          </div>
          {subtitle && (
            <div
              className="kl-mono"
              style={{ fontSize: 10.5, color: 'var(--kl-text-muted)', marginTop: 2 }}
            >
              {subtitle}
            </div>
          )}
        </div>
        {rowAction}
      </div>
      <div style={{ padding: 16 }}>{children}</div>
    </div>
  );
}
