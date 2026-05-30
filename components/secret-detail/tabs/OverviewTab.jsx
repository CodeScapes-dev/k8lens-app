import { Panel } from "@/components/kl/Panel";

export function OverviewTab({ secret, namespace }) {
  const keys = Object.keys(secret?.data ?? {});

  return (
    <Panel title="Details">
      <div className="grid gap-y-2 gap-x-3" style={{ gridTemplateColumns: "minmax(100px, 160px) 1fr", fontSize: 12 }}>
        <span style={{ color: "var(--kl-text-muted)" }}>Type</span><span className="kl-mono">{secret?.type ?? "Opaque"}</span>
        <span style={{ color: "var(--kl-text-muted)" }}>Namespace</span><span className="kl-mono">{namespace}</span>
        <span style={{ color: "var(--kl-text-muted)" }}>Data Keys</span><span className="kl-mono break-all">{keys.join(", ") || "—"}</span>
        <span style={{ color: "var(--kl-text-muted)" }}>Immutable</span><span className="kl-mono">{secret?.immutable ? "Yes" : "No"}</span>
      </div>
    </Panel>
  );
}
