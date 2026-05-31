import { Panel } from "@/components/kl/Panel";
import { KLBadge } from "@/components/kl/Badge";

export function OverviewTab({ service }) {
  if (!service) return null;
  const selector = service.spec?.selector ?? {};

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Panel title="Configuration">
          <div className="grid gap-y-2 gap-x-3" style={{ gridTemplateColumns: "minmax(100px, 160px) 1fr", fontSize: 12 }}>
            <span style={{ color: "var(--kl-text-muted)" }}>Type</span><span className="kl-mono">{service.spec?.type ?? "ClusterIP"}</span>
            <span style={{ color: "var(--kl-text-muted)" }}>Cluster IP</span><span className="kl-mono break-all">{service.spec?.clusterIP ?? "—"}</span>
            <span style={{ color: "var(--kl-text-muted)" }}>External IP</span><span className="kl-mono break-all">{(service.spec?.externalIPs ?? []).join(", ") || "—"}</span>
            <span style={{ color: "var(--kl-text-muted)" }}>Session Affinity</span><span className="kl-mono">{service.spec?.sessionAffinity ?? "None"}</span>
          </div>
        </Panel>
        <Panel title="Ports">
          {(service.spec?.ports ?? []).map((p, i) => (
            <div key={i} style={{ padding: "6px 0", borderBottom: "1px solid var(--kl-border)", fontSize: 12 }}>
              <span className="kl-mono">{p.name ? `${p.name}: ` : ""}{p.port} → {p.targetPort} ({p.protocol ?? "TCP"})</span>
            </div>
          ))}
        </Panel>
      </div>
      {Object.keys(selector).length > 0 && (
        <Panel title="Selector">
          <div className="flex flex-wrap gap-2">
            {Object.entries(selector).map(([k, v]) => <KLBadge key={k} tone="accent">{k}={v}</KLBadge>)}
          </div>
        </Panel>
      )}
    </div>
  );
}
