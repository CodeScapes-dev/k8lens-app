import { Panel } from "@/components/kl/Panel";
import { KLBadge } from "@/components/kl/Badge";

export function PodsTab({ pods }) {
  return (
    <Panel title="Pods on this Node" subtitle={`${pods.length} pod${pods.length !== 1 ? "s" : ""}`}>
      <div className="flex flex-col gap-1.5">
        {pods.map((pod) => (
          <div key={pod?.metadata?.uid} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0", borderBottom: "1px solid var(--kl-border)40", fontSize: 12 }}>
            <span className="kl-mono flex-1 break-all">{pod?.metadata?.name}</span>
            <KLBadge tone="neutral">{pod?.metadata?.namespace}</KLBadge>
            <KLBadge tone={pod?.status?.phase === "Running" ? "ok" : pod?.status?.phase === "Pending" ? "warn" : "err"}>
              {pod?.status?.phase ?? "Unknown"}
            </KLBadge>
          </div>
        ))}
      </div>
    </Panel>
  );
}
