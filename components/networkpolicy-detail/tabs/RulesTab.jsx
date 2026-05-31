import { Panel } from "@/components/kl/Panel";
import { KLBadge } from "@/components/kl/Badge";

function peerToString(peer) {
  const parts = [];
  if (peer.podSelector) {
    const labels = peer.podSelector.matchLabels ?? {};
    parts.push(Object.keys(labels).length === 0 ? "All pods" : `Pods: ${Object.entries(labels).map(([k, v]) => `${k}=${v}`).join(", ")}`);
  }
  if (peer.namespaceSelector) {
    const labels = peer.namespaceSelector.matchLabels ?? {};
    parts.push(Object.keys(labels).length === 0 ? "All namespaces" : `NS: ${Object.entries(labels).map(([k, v]) => `${k}=${v}`).join(", ")}`);
  }
  if (peer.ipBlock) parts.push(`IP: ${peer.ipBlock.cidr}${peer.ipBlock.except?.length ? ` (except ${peer.ipBlock.except.join(", ")})` : ""}`);
  return parts.join(", ") || "Any";
}

function RuleTable({ direction, rules }) {
  const isIngress = direction === "Ingress";
  if (!rules?.length) return <div style={{ fontSize: 12, color: "var(--kl-text-muted)" }}>All {direction.toLowerCase()} allowed (no rules defined)</div>;

  const rows = rules.flatMap((rule, ri) => {
    const peers = isIngress ? (rule.from ?? []) : (rule.to ?? []);
    const ports = rule.ports?.map((p) => `${p.protocol ?? "TCP"}/${p.port ?? "all"}`).join(", ") ?? "All ports";
    if (peers.length === 0) return [{ rule: `Rule ${ri + 1}`, peer: isIngress ? "All sources" : "All destinations", ports }];
    return peers.map((peer) => ({ rule: `Rule ${ri + 1}`, peer: peerToString(peer), ports }));
  });

  return (
    <div className="overflow-x-auto" style={{ scrollbarWidth: "none" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, minWidth: 360 }}>
        <thead>
          <tr>
            {["Rule", isIngress ? "Source" : "Destination", "Ports"].map((h) => (
              <th key={h} className="kl-mono" style={{ padding: "0 12px 8px 0", fontSize: 10, textTransform: "uppercase", letterSpacing: 1, color: "var(--kl-text-faint)", fontWeight: 600, textAlign: "left" }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} style={{ borderTop: "1px solid var(--kl-border)" }}>
              <td className="kl-mono" style={{ padding: "7px 12px 7px 0", color: "var(--kl-text-muted)", whiteSpace: "nowrap" }}>{row.rule}</td>
              <td className="kl-mono" style={{ padding: "7px 12px 7px 0", color: "var(--kl-text)" }}>{row.peer}</td>
              <td style={{ padding: "7px 0" }}><KLBadge tone="accent">{row.ports}</KLBadge></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function RulesTab({ networkPolicy }) {
  const policyTypes = networkPolicy?.spec?.policyTypes ?? [];

  if (policyTypes.length === 0) {
    return <Panel title="Rules"><span style={{ fontSize: 12, color: "var(--kl-text-muted)" }}>No policy types defined.</span></Panel>;
  }

  return (
    <div className="flex flex-col gap-4">
      {policyTypes.includes("Ingress") && (
        <Panel title="Ingress Rules">
          <RuleTable direction="Ingress" rules={networkPolicy?.spec?.ingress} />
        </Panel>
      )}
      {policyTypes.includes("Egress") && (
        <Panel title="Egress Rules">
          <RuleTable direction="Egress" rules={networkPolicy?.spec?.egress} />
        </Panel>
      )}
    </div>
  );
}
