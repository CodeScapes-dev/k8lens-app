"use client";

export function Card({ children, style, padding = 12 }) {
  return (
    <div
      style={{
        background: "var(--kl-surface)",
        border: "1px solid var(--kl-border)",
        borderRadius: 12,
        padding,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function CardHeader({ icon, title, sub, action }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 10,
        marginBottom: 8,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          minWidth: 0,
          flex: 1,
        }}
      >
        {icon && (
          <span
            style={{
              color: "var(--kl-text-muted)",
              display: "inline-flex",
              flexShrink: 0,
            }}
          >
            {icon}
          </span>
        )}
        <span
          style={{
            fontSize: 13.5,
            fontWeight: 600,
            color: "var(--kl-text)",
            letterSpacing: -0.1,
          }}
        >
          {title}
        </span>
        {sub && (
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10.5,
              color: "var(--kl-text-faint)",
            }}
          >
            {sub}
          </span>
        )}
      </div>
      {action && <div style={{ flexShrink: 0 }}>{action}</div>}
    </div>
  );
}
