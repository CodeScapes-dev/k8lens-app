"use client";

import React from "react";
import { useParams } from "next/navigation";
import { LayoutDashboardIcon, CpuIcon, BellIcon, TagIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useK8sDetail } from "@/hooks/use-k8s";
import { calculateAge, formatTimestamp } from "@/lib/k8s/utils";
import { Panel } from "@/components/kl/Panel";
import { KLBadge } from "@/components/kl/Badge";
import { KLStatus } from "@/components/kl/Status";
import { SharedEventsTab } from "@/components/shared-detail-tabs/SharedEventsTab";
import { SharedMetadataTab } from "@/components/shared-detail-tabs/SharedMetadataTab";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from "@/components/ui/table";

const TABS = [
  { id: "Overview", icon: LayoutDashboardIcon },
  { id: "Resources", icon: CpuIcon },
  { id: "Events", icon: BellIcon },
  { id: "Metadata", icon: TagIcon },
];

function jobStatusKind(job) {
  const conds = job?.status?.conditions ?? [];
  if (conds.find((c) => c.type === "Complete" && c.status === "True")) return "ok";
  if (conds.find((c) => c.type === "Failed" && c.status === "True")) return "err";
  return "warn";
}

function jobStatusLabel(job) {
  const k = jobStatusKind(job);
  return k === "ok" ? "Complete" : k === "err" ? "Failed" : "Running";
}

function statusColor(job) {
  const k = jobStatusKind(job);
  return k === "ok" ? "bg-green-500" : k === "err" ? "bg-destructive" : "bg-yellow-500";
}

function QuickStat({ label, value }) {
  return (
    <div className="flex flex-col gap-1 px-4 py-3">
      <span className="text-[10px] uppercase tracking-widest text-muted-foreground leading-none">{label}</span>
      <span className="font-mono text-sm font-bold leading-none">{value}</span>
    </div>
  );
}

function OverviewTab({ job, pods }) {
  if (!job) return null;
  const meta = job.metadata ?? {};
  const spec = job.spec ?? {};
  const status = job.status ?? {};
  const skind = jobStatusKind(job);
  const conditions = status.conditions ?? [];

  const startTime = status.startTime;
  const completionTime = status.completionTime;
  let duration = "—";
  if (startTime) {
    const end = completionTime ? new Date(completionTime) : new Date();
    const diff = Math.floor((end - new Date(startTime)) / 1000);
    duration = diff < 60 ? `${diff}s` : diff < 3600 ? `${Math.floor(diff / 60)}m ${diff % 60}s` : `${Math.floor(diff / 3600)}h ${Math.floor((diff % 3600) / 60)}m`;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-[1.4fr_1fr] gap-4 items-start">
      <div className="flex flex-col gap-4">
        <Panel title="Job Info">
          <div className="grid gap-y-2 gap-x-3" style={{ gridTemplateColumns: "minmax(100px, 160px) 1fr" }}>
            {[
              ["Name", meta.name], ["Namespace", meta.namespace], ["UID", meta.uid],
              ["Created", meta.creationTimestamp ? calculateAge(meta.creationTimestamp) + " ago" : "—"],
              ["Parallelism", spec.parallelism ?? 1], ["Completions", spec.completions ?? 1],
              ["Backoff Limit", spec.backoffLimit ?? "—"],
              ["Started", startTime ? formatTimestamp(startTime) : "—"],
              ["Completed", completionTime ? formatTimestamp(completionTime) : "—"],
              ["Duration", duration],
            ].map(([label, value]) => (
              <React.Fragment key={label}>
                <span style={{ color: "var(--kl-text-muted)", fontSize: 12 }}>{label}</span>
                <span className="kl-mono" style={{ fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{value ?? "—"}</span>
              </React.Fragment>
            ))}
          </div>
        </Panel>

      </div>

      <div className="flex flex-col gap-4">
        <Panel title="Execution">
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: "Succeeded", value: status.succeeded ?? 0, kind: "ok" },
              { label: "Failed",    value: status.failed ?? 0,    kind: "err" },
              { label: "Active",    value: status.active ?? 0,    kind: "warn" },
              { label: "Ready",     value: status.ready ?? 0,     kind: "neutral" },
            ].map(({ label, value }) => (
              <div key={label} style={{ padding: "10px 8px", background: "var(--kl-surface-2)", borderRadius: 8, border: "1px solid var(--kl-border)", textAlign: "center" }}>
                <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 1, color: "var(--kl-text-muted)", marginBottom: 4 }}>{label}</div>
                <div className="kl-mono" style={{ fontSize: 18, fontWeight: 700 }}>{value}</div>
              </div>
            ))}
          </div>
        </Panel>

        {(meta.ownerReferences ?? []).length > 0 && (
          <Panel title="Owner References">
            <div className="flex flex-col gap-1.5">
              {(meta.ownerReferences ?? []).map((o) => (
                <div key={o.uid} className="flex items-center gap-2">
                  <KLBadge tone="accent">{o.kind}</KLBadge>
                  <span className="kl-mono" style={{ fontSize: 12 }}>{o.name}</span>
                </div>
              ))}
            </div>
          </Panel>
        )}
      </div>
    </div>
  );
}

export default function JobDetailPage() {
  const router = useRouter();
  const { namespace, name } = useParams();
  const { data, loading, error, refresh } = useK8sDetail("job", namespace, name);
  const [activeTab, setActiveTab] = React.useState("Overview");

  const job = data?.job ?? null;
  const pods = data?.pods ?? [];
  const events = data?.events ?? [];
  const containers = job?.spec?.template?.spec?.containers ?? [];

  const labels = job?.metadata?.labels ?? {};

  if (error) {
    return (
      <div className="flex flex-col items-center gap-3 pt-20 px-4">
        <p className="text-sm text-destructive">{error}</p>
        <button onClick={refresh} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm cursor-pointer border-none">Retry</button>
      </div>
    );
  }

  return (
    <div>
      <div className="sm:sticky sm:top-0 sm:z-10 bg-background border-b border-border px-4 sm:px-7 pt-4">
        {loading ? (
          <div className="space-y-3 pb-4">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-7 w-72" />
            <Skeleton className="h-5 w-full max-w-sm" />
          </div>
        ) : (
          <>
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-4">
              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex items-center gap-2">
                  {job && <span className={`inline-block w-2 h-2 rounded-full shrink-0 ${statusColor(job)}`} />}
                  <span className="font-mono text-xs text-muted-foreground">Job · batch/v1 · {namespace}</span>
                </div>
                <h1 className="font-mono text-xl sm:text-2xl font-semibold tracking-tight break-all">{name}</h1>
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(labels).slice(0, 6).map(([k, v]) => (
                    <Badge key={k} variant="secondary" className="font-mono text-[10.5px] font-normal break-all">{k}={v}</Badge>
                  ))}
                </div>
              </div>
              <div className="overflow-x-auto w-full sm:w-auto shrink-0" style={{ scrollbarWidth: "none" }}>
                <div className="grid grid-cols-3 rounded-xl border border-border overflow-hidden divide-x divide-border min-w-[240px] sm:min-w-0">
                  <QuickStat label="Status" value={job ? jobStatusLabel(job) : "—"} />
                  <QuickStat label="Succeeded" value={job?.status?.succeeded ?? 0} />
                  <QuickStat label="Age" value={job?.metadata?.creationTimestamp ? calculateAge(job.metadata.creationTimestamp) : "—"} />
                </div>
              </div>
            </div>
            <div className="flex" style={{ overflowX: "auto", overflowY: "hidden", scrollbarWidth: "none", touchAction: "pan-x", overscrollBehaviorX: "contain" }}>
              <div className="flex gap-0 min-w-max">
                {TABS.map(({ id, icon: Icon }) => {
                  const active = activeTab === id;
                  return (
                    <button key={id} onClick={() => setActiveTab(id)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 16px", background: "none", border: "none", borderBottom: active ? "2px solid var(--foreground)" : "2px solid transparent", fontSize: 13, fontWeight: active ? 600 : 400, color: active ? "var(--foreground)" : "var(--muted-foreground)", cursor: "pointer", marginBottom: -1, whiteSpace: "nowrap" }}>
                      <Icon size={13} />{id}
                      {id === "Events" && events.length > 0 && <Badge className="text-[10px] h-4 min-w-4 px-1 rounded-full">{events.length}</Badge>}
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>

      <div className="px-4 sm:px-7 py-5">
        {activeTab === "Overview" && <OverviewTab job={job} pods={pods} />}
        {activeTab === "Resources" && (
          <div className="flex flex-col gap-4">
            {containers.length > 0 && (
              <Panel title="Container Template" subtitle="Container specifications for pods created by this Job" style={{ overflow: "hidden" }}>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/70">Name</TableHead>
                      <TableHead className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/70">Image</TableHead>
                      <TableHead className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/70">Ports</TableHead>
                      <TableHead className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/70">Requests</TableHead>
                      <TableHead className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/70">Limits</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {containers.map((c) => (
                      <TableRow key={c.name}>
                        <TableCell className="font-mono text-xs font-semibold">{c.name}</TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground max-w-[200px] truncate" title={c.image}>{c.image}</TableCell>
                        <TableCell className="font-mono text-xs">{c.ports?.map((p) => `${p.containerPort}/${p.protocol ?? "TCP"}`).join(", ") || "—"}</TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">{c.resources?.requests ? Object.entries(c.resources.requests).map(([k, v]) => `${k}: ${v}`).join(", ") : "—"}</TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">{c.resources?.limits ? Object.entries(c.resources.limits).map(([k, v]) => `${k}: ${v}`).join(", ") : "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Panel>
            )}
            {pods.length > 0 && (
              <Panel title="Job Pods" subtitle={`${pods.length} pod${pods.length !== 1 ? "s" : ""}`} style={{ overflow: "hidden" }}>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-6" />
                      <TableHead className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/70">Name</TableHead>
                      <TableHead className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/70 w-[80px]">Restarts</TableHead>
                      <TableHead className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/70 w-[70px]">Ready</TableHead>
                      <TableHead className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/70 w-[90px]">Status</TableHead>
                      <TableHead className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/70">Node</TableHead>
                      <TableHead className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/70 w-[60px]">Age</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pods.map((pod) => {
                      const phase = pod.status?.phase ?? "Unknown";
                      const pkind = phase === "Running" ? "ok" : phase === "Pending" ? "warn" : phase === "Succeeded" ? "ok" : "err";
                      const restarts = (pod.status?.containerStatuses ?? []).reduce((s, c) => s + (c.restartCount ?? 0), 0);
                      const totalC = pod.spec?.containers?.length ?? 0;
                      const readyC = (pod.status?.containerStatuses ?? []).filter((c) => c.ready).length;
                      const podNode = pod.spec?.nodeName ?? "—";
                      return (
                        <TableRow key={pod.metadata?.uid} className="cursor-pointer" onClick={() => router.push(`/workloads/pods/${pod.metadata?.namespace ?? namespace}/${pod.metadata?.name}`)}>
                          <TableCell><KLStatus kind={pkind} dotOnly /></TableCell>
                          <TableCell className="font-mono text-xs text-[var(--kl-accent)] max-w-[200px] truncate">{pod.metadata?.name}</TableCell>
                          <TableCell className="font-mono text-xs">{restarts}</TableCell>
                          <TableCell className="font-mono text-xs">{readyC}/{totalC}</TableCell>
                          <TableCell><KLBadge tone={pkind}>{phase}</KLBadge></TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground truncate max-w-[120px]">{podNode}</TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground">{pod.metadata?.creationTimestamp ? calculateAge(pod.metadata.creationTimestamp) : "—"}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </Panel>
            )}
          </div>
        )}
        {activeTab === "Events" && <SharedEventsTab events={events} />}
        {activeTab === "Metadata" && <SharedMetadataTab resource={job} />}
      </div>
    </div>
  );
}
