import { LockIcon } from "lucide-react";
import { Panel } from "@/components/kl/Panel";

export function OverviewTab({ ingress }) {
  if (!ingress) return null;
  const rules = ingress.spec?.rules ?? [];
  const tls = ingress.spec?.tls ?? [];

  return (
    <Panel title="Routing Rules">
      {rules.length === 0 ? (
        <div style={{ fontSize: 12, color: "var(--kl-text-muted)" }}>No routing rules defined.</div>
      ) : (
        <div className="flex flex-col gap-3">
          {rules.map((rule, ri) => {
            const hasTls = tls.some((t) => t.hosts?.includes(rule.host));
            return (
              <div key={ri} style={{ border: "1px solid var(--kl-border)", borderRadius: 8, overflow: "hidden" }}>
                <div style={{ padding: "8px 12px", background: "var(--kl-surface-2)", display: "flex", alignItems: "center", gap: 8, fontSize: 12, fontFamily: "monospace", fontWeight: 600 }}>
                  {hasTls && <LockIcon size={11} style={{ color: "var(--kl-ok)" }} />}
                  {rule.host ?? "*"}
                </div>
                {(rule.http?.paths ?? []).map((path, pi) => (
                  <div key={pi} style={{ padding: "6px 12px", borderTop: "1px solid var(--kl-border)", display: "flex", flexWrap: "wrap", gap: 8, fontSize: 11.5 }}>
                    <span className="kl-mono" style={{ color: "var(--kl-text-muted)" }}>{path.path ?? "/"}</span>
                    <span style={{ color: "var(--kl-text-muted)" }}>→</span>
                    <span className="kl-mono break-all">{path.backend?.service?.name}:{path.backend?.service?.port?.number ?? path.backend?.service?.port?.name}</span>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}
    </Panel>
  );
}
