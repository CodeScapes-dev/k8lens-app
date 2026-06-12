"use client";

import Link from "next/link";
import { Card } from "./Card";
import { Sparkline } from "./Sparkline";

export function KpiCard({
  label,
  value,
  sub,
  accent,
  spark,
  sparkColor = "var(--kl-accent)",
  footer,
  href,
}) {
  const inner = (
    <Card
      style={{
        position: "relative",
        overflow: "hidden",
        minHeight: 120,
        ...(href ? { cursor: "pointer", transition: "background 0.15s" } : {}),
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
        }}
      >
        <span
          style={{
            fontSize: 11,
            color: "var(--kl-text-muted)",
            fontWeight: 500,
            letterSpacing: 0.4,
            textTransform: "uppercase",
          }}
        >
          {label}
        </span>
        <div style={{ flexShrink: 0 }}>{accent}</div>
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: 8,
          marginTop: 10,
        }}
      >
        <span
          style={{
            fontSize: 28,
            fontWeight: 600,
            letterSpacing: -1,
            lineHeight: 1,
            color: "var(--kl-text)",
          }}
        >
          {value}
        </span>
        {sub && (
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              color: "var(--kl-text-muted)",
              whiteSpace: "nowrap",
            }}
          >
            {sub}
          </span>
        )}
      </div>
      {spark && (
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: footer ? 30 : 0,
            height: 36,
            pointerEvents: "none",
          }}
        >
          <Sparkline data={spark} color={sparkColor} width={320} height={36} />
        </div>
      )}
      {footer && (
        <div
          style={{
            position: "absolute",
            left: 16,
            right: 16,
            bottom: 12,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            gap: 8,
          }}
        >
          {footer}
        </div>
      )}
    </Card>
  );
  return href ? (
    <Link
      href={href}
      style={{ textDecoration: "none", display: "block" }}
      className="hover:opacity-90"
    >
      {inner}
    </Link>
  ) : (
    inner
  );
}
