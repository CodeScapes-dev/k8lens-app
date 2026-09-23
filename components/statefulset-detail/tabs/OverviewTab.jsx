import { Panel } from "@/components/kl/Panel";
import { CostCard } from "@/components/cost-estimation/CostCard";

export function OverviewTab({ sts, pods, events }) {
  const containers = sts?.spec?.template?.spec?.containers ?? [];
  const desired = sts?.spec?.replicas ?? 0;

  return (
    <div className="flex flex-col gap-4">
      <CostCard containers={containers} replicas={desired} />
      <Panel title="Status">
        <div className="grid gap-y-2 gap-x-3" style={{ gridTemplateColumns: "minmax(120px, 160px) 1fr", fontSize: 12 }}>
          <span style={{ color: "var(--kl-text-muted)" }}>Ready Replicas</span><span className="kl-mono">{sts?.status?.readyReplicas ?? 0}</span>
          <span style={{ color: "var(--kl-text-muted)" }}>Current Replicas</span><span className="kl-mono">{sts?.status?.currentReplicas ?? 0}</span>
          <span style={{ color: "var(--kl-text-muted)" }}>Updated Replicas</span><span className="kl-mono">{sts?.status?.updatedReplicas ?? 0}</span>
          <span style={{ color: "var(--kl-text-muted)" }}>Service Name</span><span className="kl-mono">{sts?.spec?.serviceName ?? "—"}</span>
        </div>
      </Panel>
    </div>
  );
}
