"use client";

import { Badge } from "@/components/ui/badge";
import { formatLabel } from "@/lib/k8s/utils";

export function TimelineItem({ kind, title, target, time, msg, last }) {
  const tone =
    kind === "err"
      ? "var(--kl-err)"
      : kind === "warn"
        ? "var(--kl-warn)"
        : kind === "ok"
          ? "var(--kl-ok)"
          : "var(--kl-text-muted)";
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "22px 1fr",
        gap: 12,
        position: "relative",
      }}
    >
      <div
        style={{
          position: "relative",
          display: "flex",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            width: 8,
            height: 8,
            borderRadius: 999,
            background: tone,
            marginTop: 6,
            boxShadow: "0 0 0 3px var(--kl-bg)",
          }}
        />
        {!last && (
          <div
            style={{
              position: "absolute",
              top: 16,
              bottom: -14,
              left: "50%",
              width: 1,
              marginLeft: -0.5,
              background: "var(--kl-border)",
            }}
          />
        )}
      </div>
      <div style={{ paddingBottom: last ? 0 : 14, minWidth: 0 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 3,
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              fontWeight: 600,
              color: tone,
              textTransform: "uppercase",
              letterSpacing: 0.4,
            }}
          >
            {formatLabel(title)}
          </span>
          <Badge
            variant="secondary"
            className="shrink-0 font-mono text-[10.5px] font-normal"
          >
            {target}
          </Badge>
          <span style={{ flex: 1 }} />
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10.5,
              color: "var(--kl-text-faint)",
              flexShrink: 0,
            }}
          >
            {time}
          </span>
        </div>
        <div
          style={{
            fontSize: 12.5,
            color: "var(--kl-text-2)",
            lineHeight: 1.45,
          }}
        >
          {msg}
        </div>
      </div>
    </div>
  );
}
