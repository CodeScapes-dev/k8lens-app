import { Panel } from "@/components/kl/Panel";
import { KLBadge } from "@/components/kl/Badge";
import { KLStatus } from "@/components/kl/Status";

function pvStatusKind(phase) {
  return phase === "Bound" ? "ok" : phase === "Available" ? "info" : phase === "Released" ? "warn" : "err";
}

export function ResourcesTab({ pvs, pvcs }) {
  return (
    <div className="flex flex-col gap-4">
      <Panel title="PersistentVolumes" subtitle={`${pvs.length} volume${pvs.length !== 1 ? "s" : ""}`}>
        {pvs.length === 0 ? (
          <div style={{ fontSize: 12, color: "var(--kl-text-muted)" }}>No PersistentVolumes using this class.</div>
        ) : (
          <div className="overflow-x-auto" style={{ scrollbarWidth: "none" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, minWidth: 400 }}>
              <thead>
                <tr>
                  {["Name", "Capacity", "Access Modes", "Phase"].map((h) => (
                    <th key={h} className="kl-mono" style={{ padding: "0 12px 8px 0", fontSize: 10, textTransform: "uppercase", letterSpacing: 1, color: "var(--kl-text-faint)", fontWeight: 600, textAlign: "left" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pvs.map((pv) => {
                  const phase = pv.status?.phase ?? "Unknown";
                  const kind = pvStatusKind(phase);
                  return (
                    <tr key={pv.metadata?.uid} style={{ borderTop: "1px solid var(--kl-border)" }}>
                      <td className="kl-mono" style={{ padding: "7px 12px 7px 0", color: "var(--kl-text)" }}>
                        <div className="flex items-center gap-2"><KLStatus kind={kind} dotOnly />{pv.metadata?.name}</div>
                      </td>
                      <td className="kl-mono" style={{ padding: "7px 12px 7px 0", color: "var(--kl-text-muted)" }}>{pv.spec?.capacity?.storage ?? "—"}</td>
                      <td className="kl-mono" style={{ padding: "7px 12px 7px 0", color: "var(--kl-text-muted)" }}>{(pv.spec?.accessModes ?? []).join(", ")}</td>
                      <td style={{ padding: "7px 0" }}><KLBadge tone={kind}>{phase}</KLBadge></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
      <Panel title="PersistentVolumeClaims" subtitle={`${pvcs.length} claim${pvcs.length !== 1 ? "s" : ""}`}>
        {pvcs.length === 0 ? (
          <div style={{ fontSize: 12, color: "var(--kl-text-muted)" }}>No PersistentVolumeClaims using this class.</div>
        ) : (
          <div className="overflow-x-auto" style={{ scrollbarWidth: "none" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, minWidth: 400 }}>
              <thead>
                <tr>
                  {["Name", "Namespace", "Capacity", "Phase"].map((h) => (
                    <th key={h} className="kl-mono" style={{ padding: "0 12px 8px 0", fontSize: 10, textTransform: "uppercase", letterSpacing: 1, color: "var(--kl-text-faint)", fontWeight: 600, textAlign: "left" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pvcs.map((pvc) => {
                  const phase = pvc.status?.phase ?? "Unknown";
                  const kind = phase === "Bound" ? "ok" : phase === "Pending" ? "warn" : "err";
                  return (
                    <tr key={pvc.metadata?.uid} style={{ borderTop: "1px solid var(--kl-border)" }}>
                      <td className="kl-mono" style={{ padding: "7px 12px 7px 0", color: "var(--kl-text)" }}>
                        <div className="flex items-center gap-2"><KLStatus kind={kind} dotOnly />{pvc.metadata?.name}</div>
                      </td>
                      <td className="kl-mono" style={{ padding: "7px 12px 7px 0", color: "var(--kl-text-muted)" }}>{pvc.metadata?.namespace}</td>
                      <td className="kl-mono" style={{ padding: "7px 12px 7px 0", color: "var(--kl-text-muted)" }}>{pvc.status?.capacity?.storage ?? pvc.spec?.resources?.requests?.storage ?? "—"}</td>
                      <td style={{ padding: "7px 0" }}><KLBadge tone={kind}>{phase}</KLBadge></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
