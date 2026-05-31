"use client";

import React from "react";
import { useParams } from "next/navigation";
import { LayoutDashboardIcon, GridIcon, UsersIcon, BellIcon, TagIcon } from "lucide-react";
import Link from "next/link";
import { useK8sDetail } from "@/hooks/use-k8s";
import { KLBadge } from "@/components/kl/Badge";
import { calculateAge } from "@/lib/k8s/utils";
import { Panel } from "@/components/kl/Panel";
import { SharedEventsTab } from "@/components/shared-detail-tabs/SharedEventsTab";
import { SharedMetadataTab } from "@/components/shared-detail-tabs/SharedMetadataTab";
import { PermissionMatrixTab } from "@/components/rbac-detail/tabs/PermissionMatrixTab";
import { PolicyRulesPanel } from "@/components/rbac-detail/tabs/PolicyRulesPanel";
import { BindingSubjectsTab, subjectTone } from "@/components/rbac-detail/tabs/SubjectsTab";
import { HealthBadge } from "@/components/health-score/HealthBadge";
import { Recommendations } from "@/components/recommendations/Recommendations";
import { QuickStat } from "@/components/detail/helpers";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

const DESTRUCTIVE_VERBS = ["delete", "deletecollection", "patch", "update", "create"];

const TABS = [
  { id: "Overview", icon: LayoutDashboardIcon },
  { id: "Permissions", icon: GridIcon },
  { id: "Subjects", icon: UsersIcon },
  { id: "Events", icon: BellIcon },
  { id: "Metadata", icon: TagIcon },
];

function privilegeTone(level) {
  return level === "Admin" ? "err" : level === "High" ? "warn" : level === "Medium" ? "accent" : "neutral";
}

export default function ClusterRoleDetailPage() {
  const { name } = useParams();
  const { data, loading, error, refresh } = useK8sDetail("clusterrole", null, name);
  const [activeTab, setActiveTab] = React.useState("Overview");

  const clusterRole = data?.clusterRole ?? null;
  const bindings = data?.bindings ?? [];
  const subjects = data?.subjects ?? [];
  const events = data?.events ?? [];
  const rules = clusterRole?.rules ?? [];
  const labels = clusterRole?.metadata?.labels ?? {};

  const allVerbs = rules.flatMap((r) => r?.verbs ?? []);
  const allResources = rules.flatMap((r) => r?.resources ?? []);
  const hasWildcardVerb = allVerbs.includes("*");
  const hasWildcardResource = allResources.includes("*");
  const privilegeLevel = hasWildcardVerb ? "Admin" : hasWildcardResource ? "High" : allVerbs.some((v) => DESTRUCTIVE_VERBS.includes(v)) ? "Medium" : "Low";

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
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-xs text-muted-foreground">ClusterRole · rbac.authorization.k8s.io/v1 · cluster-scoped</span>
                  {clusterRole && <HealthBadge resourceType="clusterrole" data={data} />}
                </div>
                <h1 className="font-mono text-xl sm:text-2xl font-semibold tracking-tight break-all">{name}</h1>
                <div className="flex flex-wrap gap-1.5">
                  <Badge variant="secondary" className="font-mono text-[10.5px] font-normal">{privilegeLevel} privilege</Badge>
                  {Object.entries(labels).slice(0, 4).map(([k, v]) => (
                    <Badge key={k} variant="secondary" className="font-mono text-[10.5px] font-normal">{k}={v}</Badge>
                  ))}
                </div>
              </div>
              <div className="overflow-x-auto w-full sm:w-auto shrink-0" style={{ scrollbarWidth: "none" }}>
                <div className="grid grid-cols-4 rounded-xl border border-border overflow-hidden divide-x divide-border min-w-[280px] sm:min-w-0">
                  <QuickStat label="Rules" value={rules.length} />
                  <QuickStat label="Bindings" value={bindings.length} />
                  <QuickStat label="Subjects" value={subjects.length} />
                  <QuickStat label="Age" value={clusterRole?.metadata?.creationTimestamp ? calculateAge(clusterRole.metadata.creationTimestamp) : "—"} />
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

      {clusterRole && <Recommendations resourceType="clusterrole" data={data} namespace={null} name={name} />}

      <div className="px-4 sm:px-7 py-5">
        {activeTab === "Overview" && clusterRole && (
          <div className="grid grid-cols-1 md:grid-cols-[1.5fr_1fr] gap-4 items-start">
            <div className="flex flex-col gap-4">
              <Panel title="ClusterRole Info">
                <div className="grid gap-y-2 gap-x-3" style={{ gridTemplateColumns: "minmax(80px, 130px) 1fr", fontSize: 12 }}>
                  {[["Name", clusterRole.metadata?.name], ["UID", clusterRole.metadata?.uid], ["Created", clusterRole.metadata?.creationTimestamp ? calculateAge(clusterRole.metadata.creationTimestamp) + " ago" : "—"]].map(([l, v]) => (
                    <React.Fragment key={l}>
                      <span style={{ color: "var(--kl-text-muted)" }}>{l}</span>
                      <span className="kl-mono break-all" style={{ color: "var(--kl-text)" }}>{v ?? "—"}</span>
                    </React.Fragment>
                  ))}
                </div>
                <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--kl-border)", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <KLBadge tone={privilegeTone(privilegeLevel)}>{privilegeLevel}</KLBadge>
                  <span style={{ fontSize: 11, color: "var(--kl-text-muted)" }}>privilege</span>
                  {hasWildcardVerb && <KLBadge tone="err">wildcard verbs</KLBadge>}
                  {hasWildcardResource && <KLBadge tone="warn">wildcard resources</KLBadge>}
                </div>
              </Panel>
              <PolicyRulesPanel rules={rules} />
            </div>
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-3">
                {[{ label: "Rules", value: rules.length }, { label: "Subjects", value: subjects.length }, { label: "Bindings", value: bindings.length }].map(({ label, value }) => (
                  <div key={label} style={{ padding: "10px 12px", background: "var(--kl-surface-2)", borderRadius: 8, border: "1px solid var(--kl-border)" }}>
                    <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 1, color: "var(--kl-text-muted)", marginBottom: 4 }}>{label}</div>
                    <div className="kl-mono" style={{ fontSize: 20, fontWeight: 700, color: "var(--kl-text)" }}>{value}</div>
                  </div>
                ))}
              </div>
              <Panel title="Subjects" subtitle={`${subjects.length} bound`}>
                {subjects.length === 0 ? (
                  <div style={{ fontSize: 12, color: "var(--kl-text-muted)" }}>No subjects bound.</div>
                ) : (
                  subjects.slice(0, 4).map((s, i) => {
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
                {subjects.length > 4 && <div style={{ fontSize: 11, color: "var(--kl-text-muted)", paddingTop: 4 }}>+{subjects.length - 4} more</div>}
              </Panel>
            </div>
          </div>
        )}
        {activeTab === "Permissions" && (
          <div className="flex flex-col gap-4">
            <PolicyRulesPanel rules={rules} />
            <PermissionMatrixTab rules={rules} />
          </div>
        )}
        {activeTab === "Subjects" && <BindingSubjectsTab bindings={bindings} subjects={subjects} resourceKind="ClusterRole" />}
        {activeTab === "Events" && <SharedEventsTab events={events} />}
        {activeTab === "Metadata" && <SharedMetadataTab resource={clusterRole} />}
      </div>
    </div>
  );
}
