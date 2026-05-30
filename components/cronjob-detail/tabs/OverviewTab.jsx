import { Panel } from "@/components/kl/Panel";

export function OverviewTab({ cj }) {
  const suspended = cj?.spec?.suspend ?? false;

  return (
    <Panel title="CronJob Details">
      <div className="grid gap-y-2 gap-x-3" style={{ gridTemplateColumns: "minmax(120px, 180px) 1fr", fontSize: 12 }}>
        <span style={{ color: "var(--kl-text-muted)" }}>Schedule</span><span className="kl-mono">{cj?.spec?.schedule ?? "—"}</span>
        <span style={{ color: "var(--kl-text-muted)" }}>Concurrency Policy</span><span className="kl-mono">{cj?.spec?.concurrencyPolicy ?? "Allow"}</span>
        <span style={{ color: "var(--kl-text-muted)" }}>Suspend</span><span className="kl-mono">{suspended ? "Yes" : "No"}</span>
        <span style={{ color: "var(--kl-text-muted)" }}>Successful Jobs History</span><span className="kl-mono">{cj?.spec?.successfulJobsHistoryLimit ?? 3}</span>
        <span style={{ color: "var(--kl-text-muted)" }}>Failed Jobs History</span><span className="kl-mono">{cj?.spec?.failedJobsHistoryLimit ?? 1}</span>
        <span style={{ color: "var(--kl-text-muted)" }}>Last Schedule Time</span><span className="kl-mono">{cj?.status?.lastScheduleTime ? new Date(cj.status.lastScheduleTime).toLocaleString() : "—"}</span>
      </div>
    </Panel>
  );
}
