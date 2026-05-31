import { KLBadge } from "@/components/kl/Badge";
import { calculateAge } from "@/lib/k8s/utils";

export function QuickStat({ label, value }) {
  return (
    <div className="flex flex-col gap-1 px-4 py-3">
      <span className="text-[10px] uppercase tracking-widest text-muted-foreground leading-none">{label}</span>
      <span className="font-mono text-sm font-bold leading-none">{value}</span>
    </div>
  );
}

export function ConditionsTimeline({ conditions, getStatus, descriptions = {} }) {
  const sorted = [...conditions].sort((a, b) => {
    if (!a.lastTransitionTime) return 1;
    if (!b.lastTransitionTime) return -1;
    return new Date(b.lastTransitionTime) - new Date(a.lastTransitionTime);
  });

  return (
    <div style={{ paddingLeft: 8 }}>
      {sorted.map((c, i) => {
        const { tone, dotColor } = getStatus(c);
        const isLast = i === sorted.length - 1;
        return (
          <div key={c.type} style={{ display: "flex", gap: 16, position: "relative" }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
              <div style={{ width: 10, height: 10, borderRadius: 999, background: dotColor, border: "2px solid var(--kl-surface)", boxShadow: `0 0 0 2px ${dotColor}`, marginTop: 14, flexShrink: 0 }} />
              {!isLast && <div style={{ width: 2, flex: 1, background: "var(--kl-border)", marginTop: 4 }} />}
            </div>
            <div style={{ flex: 1, paddingBottom: isLast ? 0 : 16 }}>
              <div style={{ background: "var(--kl-surface)", border: "1px solid var(--kl-border)", borderRadius: 10, padding: "12px 16px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: c.message ? 8 : 0 }}>
                  <span className="kl-mono" style={{ fontSize: 13.5, fontWeight: 600 }}>{c.type.replace(/([A-Z])/g, " $1").trim()}</span>
                  <KLBadge tone={tone}>{c.status}</KLBadge>
                  {c.reason && <KLBadge tone="neutral">{c.reason}</KLBadge>}
                </div>
                {c.message && <p style={{ fontSize: 13, color: "var(--kl-text)", lineHeight: 1.6, margin: "0 0 8px" }}>{c.message}</p>}
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                  {c.lastTransitionTime && (
                    <span style={{ fontSize: 11, color: "var(--kl-text-faint)" }}>
                      {new Date(c.lastTransitionTime).toLocaleString()} · {calculateAge(c.lastTransitionTime)} ago
                    </span>
                  )}
                  {descriptions[c.type] && (
                    <span style={{ fontSize: 11, color: "var(--kl-text-muted)", fontStyle: "italic" }}>{descriptions[c.type]}</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
