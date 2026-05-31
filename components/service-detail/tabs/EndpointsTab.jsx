import { Panel } from "@/components/kl/Panel";
import { KLBadge } from "@/components/kl/Badge";

export function EndpointsTab({ endpoints }) {
  const readyAddrs = (endpoints?.subsets ?? []).flatMap((s) => s.addresses ?? []);

  return (
    <Panel title="Ready Endpoints" subtitle={`${readyAddrs.length} ready`}>
      {readyAddrs.length === 0 ? (
        <div style={{ fontSize: 12, color: "var(--kl-text-muted)" }}>No ready endpoints.</div>
      ) : (
        <div className="flex flex-col gap-2">
          {readyAddrs.map((addr, i) => (
            <div key={i} style={{ fontSize: 12, fontFamily: "monospace", display: "flex", alignItems: "center", gap: 8 }}>
              <span>{addr.ip}</span>
              {addr.targetRef?.name && <KLBadge tone="neutral">{addr.targetRef.name}</KLBadge>}
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}
