"use client";
import React from "react";
import { useParams } from "next/navigation";
import { LayoutDashboardIcon, UsersIcon, GridIcon, BellIcon, TagIcon } from "lucide-react";
import { useK8sDetail } from "@/hooks/use-k8s";
import { Panel } from "@/components/kl/Panel";
import { KLBadge } from "@/components/kl/Badge";
import { calculateAge } from "@/lib/k8s/utils";
import { SharedEventsTab } from "@/components/shared-detail-tabs/SharedEventsTab";
import { SharedMetadataTab } from "@/components/shared-detail-tabs/SharedMetadataTab";
import { PermissionMatrixTab } from "@/components/rbac-detail/tabs/PermissionMatrixTab";
import { PolicyRulesPanel } from "@/components/rbac-detail/tabs/PolicyRulesPanel";
import { SubjectsTab, subjectTone } from "@/components/rbac-detail/tabs/SubjectsTab";
import { QuickStat } from "@/components/detail/helpers";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import Link from "next/link";

const TABS = [
  { id: "Overview", icon: LayoutDashboardIcon },
  { id: "Subjects", icon: UsersIcon },
  { id: "Permissions", icon: GridIcon },
  { id: "Events", icon: BellIcon },
  { id: "Metadata", icon: TagIcon },
];

export default function ClusterRoleBindingDetailPage() {
  const { name } = useParams();
  const { data, loading, error, refresh } = useK8sDetail("clusterrolebinding", null, name);
  const [activeTab, setActiveTab] = React.useState("Overview");

  const crb = data?.clusterRoleBinding ?? null;
  const role = data?.role ?? null;
  const events = data?.events ?? [];
  const subjects = crb?.subjects ?? [];
  const rules = role?.rules ?? [];
  const isClusterAdmin = crb?.roleRef?.name === "cluster-admin";

  if (error) return (
    <div className="flex flex-col items-center gap-3 pt-20 px-4">
      <p className="text-sm text-destructive">{error}</p>
      <button onClick={refresh} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm cursor-pointer border-none">Retry</button>
    </div>
  );

  return (
    <div>
      <div className="sm:sticky sm:top-0 sm:z-10 bg-background border-b border-border px-4 sm:px-7 pt-4">
        {loading ? (
          <div className="space-y-3 pb-4">
            <Skeleton className="h-4 w-40" /><Skeleton className="h-7 w-72" /><Skeleton className="h-5 w-full max-w-sm" />
          </div>
        ) : (
          <>
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-4">
              <div className="min-w-0 flex-1 space-y-2">
                <span className="font-mono text-xs text-muted-foreground">ClusterRoleBinding · rbac.authorization.k8s.io/v1 · cluster-scoped</span>
                <h1 className="font-mono text-xl sm:text-2xl font-semibold tracking-tight break-all">{name}</h1>
                <div className="flex flex-wrap gap-1.5">
                  {crb?.roleRef && (
                    <Badge variant="secondary" className={`font-mono text-[10.5px] font-normal ${isClusterAdmin ? "text-destructive" : ""}`}>
                      {crb.roleRef.kind}: {crb.roleRef.name}
                    </Badge>
                  )}
                </div>
              </div>
              <div className="overflow-x-auto w-full sm:w-auto shrink-0" style={{ scrollbarWidth: "none" }}>
                <div className="grid grid-cols-3 rounded-xl border border-border overflow-hidden divide-x divide-border min-w-[220px] sm:min-w-0">
                  <QuickStat label="Subjects" value={subjects.length} />
                  <QuickStat label="Rules" value={rules.length} />
                  <QuickStat label="Age" value={crb?.metadata?.creationTimestamp ? calculateAge(crb.metadata.creationTimestamp) : "—"} />
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
                      {id === "Subjects" && subjects.length > 0 && <Badge className="text-[10px] h-4 min-w-4 px-1 rounded-full">{subjects.length}</Badge>}
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
        {activeTab === "Overview" && crb && (
          <div className="grid grid-cols-1 md:grid-cols-[1.5fr_1fr] gap-4 items-start">
            <div className="flex flex-col gap-4">
              <Panel title="ClusterRoleBinding Info">
                <div className="grid gap-y-2 gap-x-3" style={{ gridTemplateColumns: "minmax(80px, 130px) 1fr", fontSize: 12 }}>
                  {[["Name", crb.metadata?.name], ["UID", crb.metadata?.uid], ["Created", crb.metadata?.creationTimestamp ? calculateAge(crb.metadata.creationTimestamp) + " ago" : "—"]].map(([l, v]) => (
                    <React.Fragment key={l}>
                      <span style={{ color: "var(--kl-text-muted)" }}>{l}</span>
                      <span className="kl-mono break-all" style={{ color: "var(--kl-text)" }}>{v ?? "—"}</span>
                    </React.Fragment>
                  ))}
                </div>
              </Panel>
              <Panel title="Subjects" subtitle={`${subjects.length} subject${subjects.length !== 1 ? "s" : ""}`}>
                {subjects.length === 0 ? (
                  <div style={{ fontSize: 12, color: "var(--kl-text-muted)" }}>No subjects bound.</div>
                ) : (
                  subjects.slice(0, 5).map((s, i) => {
                    const href = s.kind === "ServiceAccount" ? `/access-control/serviceaccounts/${s.namespace}/${s.name}` : null;
                    const inner = (
                      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderTop: "1px solid var(--kl-border)" }}>
                        <KLBadge tone={subjectTone(s.kind)}>{s.kind}</KLBadge>
                        <span className="kl-mono break-all" style={{ fontSize: 12, flex: 1 }}>{s.name}</span>
                        {s.namespace && <span style={{ fontSize: 11, color: "var(--kl-text-faint)" }}>{s.namespace}</span>}
                      </div>
                    );
                    return href ? <Link key={i} href={href}>{inner}</Link> : <div key={i}>{inner}</div>;
                  })
                )}
                {subjects.length > 5 && <div style={{ fontSize: 11, color: "var(--kl-text-muted)", paddingTop: 4 }}>+{subjects.length - 5} more</div>}
              </Panel>
              {rules.length > 0 && <PolicyRulesPanel rules={rules} />}
            </div>
            <div className="flex flex-col gap-4">
              <Panel title="Role Reference">
                <div className="flex items-center gap-2 flex-wrap">
                  <KLBadge tone={isClusterAdmin ? "err" : "accent"}>{crb.roleRef?.kind}</KLBadge>
                  <span className="kl-mono break-all" style={{ fontSize: 13 }}>{crb.roleRef?.name}</span>
                </div>
                {isClusterAdmin && (
                  <div style={{ marginTop: 10, padding: "8px 10px", background: "var(--kl-err-tint, rgba(239,68,68,0.1))", borderRadius: 6, fontSize: 12, color: "var(--kl-err)" }}>
                    ⚠ This binding grants cluster-admin — full cluster access
                  </div>
                )}
              </Panel>
              <div className="grid grid-cols-2 gap-3">
                {[{ label: "Subjects", value: subjects.length }, { label: "Rules", value: rules.length }].map(({ label, value }) => (
                  <div key={label} style={{ padding: "10px 12px", background: "var(--kl-surface-2)", borderRadius: 8, border: "1px solid var(--kl-border)" }}>
                    <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 1, color: "var(--kl-text-muted)", marginBottom: 4 }}>{label}</div>
                    <div className="kl-mono" style={{ fontSize: 20, fontWeight: 700, color: "var(--kl-text)" }}>{value}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
        {activeTab === "Subjects" && <SubjectsTab subjects={subjects} />}
        {activeTab === "Permissions" && (
          <div className="flex flex-col gap-4">
            <PolicyRulesPanel rules={rules} />
            <PermissionMatrixTab rules={rules} />
          </div>
        )}
        {activeTab === "Events" && <SharedEventsTab events={events} />}
        {activeTab === "Metadata" && <SharedMetadataTab resource={crb} />}
      </div>
    </div>
  );
}
