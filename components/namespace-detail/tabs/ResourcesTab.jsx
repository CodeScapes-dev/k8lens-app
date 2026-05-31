import { Panel } from "@/components/kl/Panel";
import { KLBadge } from "@/components/kl/Badge";
import { KLStatus } from "@/components/kl/Status";

function podTone(phase) {
  return phase === "Running" ? "ok" : phase === "Pending" ? "warn" : "err";
}

function ResourceSection({ title, items, renderRow }) {
  if (!items?.length) return null;
  return (
    <Panel title={title} subtitle={`${items.length}`}>
      <div className="flex flex-col">
        {items.map((item, i) => (
          <div key={item?.metadata?.uid ?? i} style={{ borderTop: "1px solid var(--kl-border)" }}>
            {renderRow(item)}
          </div>
        ))}
      </div>
    </Panel>
  );
}

export function ResourcesTab({ pods, deployments, services, configMaps, secrets, daemonSets, statefulSets, jobs, cronJobs, ingresses, quotas, limits }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
      <div className="flex flex-col gap-4">
        <ResourceSection title="Pods" items={pods} renderRow={(pod) => {
          const p = pod.status?.phase ?? "Unknown";
          return (
            <div className="flex items-center gap-2 py-2" style={{ fontSize: 12 }}>
              <KLStatus kind={podTone(p)} dotOnly />
              <span className="kl-mono break-all flex-1">{pod.metadata?.name}</span>
              <KLBadge tone={podTone(p)}>{p}</KLBadge>
            </div>
          );
        }} />
        <ResourceSection title="Deployments" items={deployments} renderRow={(d) => {
          const ready = d.status?.readyReplicas ?? 0;
          const desired = d.spec?.replicas ?? 0;
          return (
            <div className="flex items-center gap-2 py-2" style={{ fontSize: 12 }}>
              <KLStatus kind={ready >= desired ? "ok" : "warn"} dotOnly />
              <span className="kl-mono break-all flex-1">{d.metadata?.name}</span>
              <span style={{ fontSize: 11, color: "var(--kl-text-muted)" }}>{ready}/{desired}</span>
            </div>
          );
        }} />
        <ResourceSection title="StatefulSets" items={statefulSets} renderRow={(ss) => (
          <div className="flex items-center gap-2 py-2" style={{ fontSize: 12 }}>
            <span className="kl-mono break-all flex-1">{ss.metadata?.name}</span>
            <span style={{ fontSize: 11, color: "var(--kl-text-muted)" }}>{ss.status?.readyReplicas ?? 0}/{ss.spec?.replicas ?? 0}</span>
          </div>
        )} />
        <ResourceSection title="DaemonSets" items={daemonSets} renderRow={(ds) => (
          <div className="flex items-center gap-2 py-2" style={{ fontSize: 12 }}>
            <span className="kl-mono break-all flex-1">{ds.metadata?.name}</span>
            <span style={{ fontSize: 11, color: "var(--kl-text-muted)" }}>{ds.status?.numberReady ?? 0} ready</span>
          </div>
        )} />
        <ResourceSection title="Jobs" items={jobs} renderRow={(job) => {
          const done = (job.status?.succeeded ?? 0) > 0;
          return (
            <div className="flex items-center gap-2 py-2" style={{ fontSize: 12 }}>
              <KLStatus kind={done ? "ok" : "warn"} dotOnly />
              <span className="kl-mono break-all flex-1">{job.metadata?.name}</span>
              <KLBadge tone={done ? "ok" : "warn"}>{done ? "Complete" : "Running"}</KLBadge>
            </div>
          );
        }} />
        <ResourceSection title="CronJobs" items={cronJobs} renderRow={(cj) => (
          <div className="flex items-center gap-2 py-2" style={{ fontSize: 12 }}>
            <span className="kl-mono break-all flex-1">{cj.metadata?.name}</span>
            <KLBadge tone="neutral">{cj.spec?.schedule}</KLBadge>
          </div>
        )} />
      </div>
      <div className="flex flex-col gap-4">
        <ResourceSection title="Services" items={services} renderRow={(svc) => (
          <div className="flex items-center gap-2 py-2" style={{ fontSize: 12 }}>
            <span className="kl-mono break-all flex-1">{svc.metadata?.name}</span>
            <KLBadge tone="neutral">{svc.spec?.type ?? "ClusterIP"}</KLBadge>
          </div>
        )} />
        <ResourceSection title="Ingresses" items={ingresses} renderRow={(ing) => (
          <div className="flex items-center gap-2 py-2" style={{ fontSize: 12 }}>
            <span className="kl-mono break-all flex-1">{ing.metadata?.name}</span>
          </div>
        )} />
        <ResourceSection title="ConfigMaps" items={configMaps} renderRow={(cm) => (
          <div className="py-2" style={{ fontSize: 12 }}>
            <span className="kl-mono break-all">{cm.metadata?.name}</span>
          </div>
        )} />
        <ResourceSection title="Secrets" items={secrets} renderRow={(s) => (
          <div className="flex items-center gap-2 py-2" style={{ fontSize: 12 }}>
            <span className="kl-mono break-all flex-1">{s.metadata?.name}</span>
            <KLBadge tone="neutral">{s.type}</KLBadge>
          </div>
        )} />
        <ResourceSection title="Resource Quotas" items={quotas} renderRow={(rq) => (
          <div className="py-2" style={{ fontSize: 12 }}>
            <span className="kl-mono break-all">{rq.metadata?.name}</span>
          </div>
        )} />
        <ResourceSection title="Limit Ranges" items={limits} renderRow={(lr) => (
          <div className="py-2" style={{ fontSize: 12 }}>
            <span className="kl-mono break-all">{lr.metadata?.name}</span>
          </div>
        )} />
      </div>
    </div>
  );
}
