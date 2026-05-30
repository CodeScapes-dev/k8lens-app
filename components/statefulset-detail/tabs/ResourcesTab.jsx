import { Panel } from "@/components/kl/Panel";

export function ResourcesTab({ containers }) {
  return (
    <Panel title="Containers">
      <div className="flex flex-col gap-3">
        {containers.map((c) => (
          <div key={c.name} style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid var(--kl-border)", background: "var(--kl-surface-2)" }}>
            <div className="kl-mono font-semibold mb-1.5">{c.name}</div>
            <div style={{ fontSize: 11.5, color: "var(--kl-text-muted)" }}>{c.image}</div>
            <div className="flex flex-wrap gap-3 mt-2" style={{ fontSize: 11 }}>
              <span>CPU: {c.resources?.requests?.cpu ?? "—"} / {c.resources?.limits?.cpu ?? "—"}</span>
              <span>Mem: {c.resources?.requests?.memory ?? "—"} / {c.resources?.limits?.memory ?? "—"}</span>
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}
