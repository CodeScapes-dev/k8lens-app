import { Panel } from "@/components/kl/Panel";
import { CostCard } from "@/components/cost-estimation/CostCard";

export function OverviewTab({ ds, pods, events }) {
  const containers = ds?.spec?.template?.spec?.containers ?? [];

  return (
    <div className="flex flex-col gap-4">
      <CostCard containers={containers} replicas={pods.length} />
      <Panel title="Status">
        <div className="grid gap-y-2 gap-x-3" style={{ gridTemplateColumns: "minmax(120px, 180px) 1fr", fontSize: 12 }}>
          <span style={{ color: "var(--kl-text-muted)" }}>Desired</span><span className="kl-mono">{ds?.status?.desiredNumberScheduled ?? 0}</span>
          <span style={{ color: "var(--kl-text-muted)" }}>Ready</span><span className="kl-mono">{ds?.status?.numberReady ?? 0}</span>
          <span style={{ color: "var(--kl-text-muted)" }}>Available</span><span className="kl-mono">{ds?.status?.numberAvailable ?? 0}</span>
          <span style={{ color: "var(--kl-text-muted)" }}>Misscheduled</span><span className="kl-mono">{ds?.status?.numberMisscheduled ?? 0}</span>
        </div>
      </Panel>
    </div>
  );
}
