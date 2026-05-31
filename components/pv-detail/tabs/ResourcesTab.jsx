import { Panel } from "@/components/kl/Panel";
import { KLBadge } from "@/components/kl/Badge";
import { KLStatus } from "@/components/kl/Status";
import { pvStatusKind } from "./OverviewTab";

export function ResourcesTab({ pods, spec }) {
  return (
    <Panel title="Pods Using This Volume" subtitle={pods.length > 0 ? `${pods.length} pod${pods.length !== 1 ? "s" : ""}` : undefined}>
      {pods.length === 0 ? (
        <div style={{ fontSize: 12, color: "var(--kl-text-muted)" }}>
          {spec?.claimRef ? "No pods currently mounting this volume." : "Volume is not bound to any PVC."}
        </div>
      ) : (
        <div className="overflow-x-auto" style={{ scrollbarWidth: "none" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, minWidth: 360 }}>
            <thead>
              <tr>
                {["Pod", "Namespace", "Phase"].map((h) => (
                  <th key={h} className="kl-mono" style={{ padding: "0 12px 8px 0", fontSize: 10, textTransform: "uppercase", letterSpacing: 1, color: "var(--kl-text-faint)", fontWeight: 600, textAlign: "left" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pods.map((pod) => {
                const podPhase = pod.status?.phase ?? "Unknown";
                const pkind = podPhase === "Running" ? "ok" : podPhase === "Pending" ? "warn" : "err";
                return (
                  <tr key={pod.metadata?.uid} style={{ borderTop: "1px solid var(--kl-border)" }}>
                    <td className="kl-mono" style={{ padding: "7px 12px 7px 0", color: "var(--kl-text)" }}>
                      <div className="flex items-center gap-2"><KLStatus kind={pkind} dotOnly />{pod.metadata?.name}</div>
                    </td>
                    <td className="kl-mono" style={{ padding: "7px 12px 7px 0", color: "var(--kl-text-muted)" }}>{pod.metadata?.namespace}</td>
                    <td style={{ padding: "7px 0" }}><KLBadge tone={pkind}>{podPhase}</KLBadge></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}
