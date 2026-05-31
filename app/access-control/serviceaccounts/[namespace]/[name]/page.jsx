"use client";
import React from "react";
import { useParams } from "next/navigation";
import { LayoutDashboardIcon, ShieldIcon, BellIcon, TagIcon, ServerIcon, ShareIcon } from "lucide-react";
import { DependencyGraph } from "@/components/dependency-graph/DependencyGraph";
import { useK8sDetail } from "@/hooks/use-k8s";
import { Panel } from "@/components/kl/Panel";
import { KLBadge } from "@/components/kl/Badge";
import { KLStatus } from "@/components/kl/Status";
import { calculateAge } from "@/lib/k8s/utils";
import { SharedEventsTab } from "@/components/shared-detail-tabs/SharedEventsTab";
import { SharedMetadataTab } from "@/components/shared-detail-tabs/SharedMetadataTab";
import { QuickStat } from "@/components/detail/helpers";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

const TABS = [
  { id: "Overview", icon: LayoutDashboardIcon },
  { id: "Permissions", icon: ShieldIcon },
  { id: "Pods", icon: ServerIcon },
  { id: "Dependencies", icon: ShareIcon },
  { id: "Events", icon: BellIcon },
  { id: "Metadata", icon: TagIcon },
];

function privilegeTone(level) {
  return level === "Admin" ? "err" : level === "High" ? "warn" : level === "Medium" ? "accent" : "neutral";
}

function RulesTable({ rules }) {
  if (!rules?.length) return <div style={{ fontSize: 12, color: "var(--kl-text-muted)" }}>No rules defined.</div>;
  return (
    <div className="overflow-x-auto" style={{ scrollbarWidth: "none" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, minWidth: 480 }}>
        <thead>
          <tr>
            {["API Groups", "Resources", "Verbs"].map((h) => (
              <th key={h} className="kl-mono" style={{ padding: "0 12px 8px 0", fontSize: 10, textTransform: "uppercase", letterSpacing: 1, color: "var(--kl-text-faint)", fontWeight: 600, textAlign: "left" }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rules.map((rule, i) => {
            const groups = (rule.apiGroups ?? [""]).map((g) => g === "" ? "core" : g).join(", ");
            const resources = [...(rule.resources ?? []), ...(rule.resourceNames?.length ? [`(names: ${rule.resourceNames.join(", ")})`] : [])].join(", ") || "*";
            const isWild = rule.verbs?.includes("*") || rule.resources?.includes("*");
            return (
              <tr key={i} style={{ borderTop: "1px solid var(--kl-border)" }}>
                <td className="kl-mono" style={{ padding: "7px 12px 7px 0", color: "var(--kl-text-muted)", whiteSpace: "nowrap" }}>{groups || "core"}</td>
                <td className="kl-mono" style={{ padding: "7px 12px 7px 0", color: "var(--kl-text)" }}>{resources}</td>
                <td style={{ padding: "7px 0" }}>
                  <div className="flex flex-wrap gap-1">
                    {(rule.verbs ?? ["*"]).map((v) => (
                      <KLBadge key={v} tone={isWild || ["delete", "deletecollection", "patch", "update", "create"].includes(v) ? "warn" : "neutral"}>{v}</KLBadge>
                    ))}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function ServiceAccountDetailPage() {
  const { namespace, name } = useParams();
  const { data, loading, error, refresh } = useK8sDetail("serviceaccount", namespace, name);
  const [activeTab, setActiveTab] = React.useState("Overview");

  const sa = data?.serviceAccount ?? null;
  const roleBindings = data?.roleBindings ?? [];
  const clusterRoleBindings = data?.clusterRoleBindings ?? [];
  const pods = data?.podsUsingServiceAccount ?? [];
  const effectivePermissions = data?.effectivePermissions ?? { verbs: [], resources: [], rules: [] };
  const privilegeLevel = data?.privilegeLevel ?? "Low";
  const riskLevel = data?.riskLevel ?? { level: "Low", factors: [] };
  const events = data?.events ?? [];
  const allBindings = [...roleBindings, ...clusterRoleBindings];

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
                <span className="font-mono text-xs text-muted-foreground">ServiceAccount · v1 · {namespace}</span>
                <h1 className="font-mono text-xl sm:text-2xl font-semibold tracking-tight break-all">{name}</h1>
                <div className="flex flex-wrap gap-1.5">
                  <Badge variant="secondary" className="font-mono text-[10.5px] font-normal">{privilegeLevel} privilege</Badge>
                  {sa?.automountServiceAccountToken !== false && <Badge variant="secondary" className="font-mono text-[10.5px] font-normal">Automount token</Badge>}
                </div>
              </div>
              <div className="overflow-x-auto w-full sm:w-auto shrink-0" style={{ scrollbarWidth: "none" }}>
                <div className="grid grid-cols-3 rounded-xl border border-border overflow-hidden divide-x divide-border min-w-[240px] sm:min-w-0">
                  <QuickStat label="Bindings" value={allBindings.length} />
                  <QuickStat label="Pods" value={pods.length} />
                  <QuickStat label="Age" value={sa?.metadata?.creationTimestamp ? calculateAge(sa.metadata.creationTimestamp) : "—"} />
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
                      {id === "Pods" && pods.length > 0 && <Badge className="text-[10px] h-4 min-w-4 px-1 rounded-full">{pods.length}</Badge>}
                      {id === "Events" && events.length > 0 && <Badge className="text-[10px] h-4 min-w-4 px-1 rounded-full">{events.length}</Badge>}
                      {id === "Permissions" && effectivePermissions.rules.length > 0 && <Badge className="text-[10px] h-4 min-w-4 px-1 rounded-full">{effectivePermissions.rules.length}</Badge>}
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>
      <div className="px-4 sm:px-7 py-5">
        {activeTab === "Overview" && sa && (
          <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-4 items-start">
            <div className="flex flex-col gap-4">
              <Panel title="Effective Permissions" subtitle={`Aggregated from ${allBindings.length} binding${allBindings.length !== 1 ? "s" : ""} · see Permissions tab for full rules`}>
                <div className="flex items-center gap-8 mb-4 pb-4" style={{ borderBottom: "1px solid var(--kl-border)" }}>
                  <div>
                    <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 1, color: "var(--kl-text-muted)", marginBottom: 6 }}>Scope</div>
                    <KLBadge tone={clusterRoleBindings.length > 0 ? "warn" : "accent"}>{clusterRoleBindings.length > 0 ? "Cluster-Wide" : "Namespace"}</KLBadge>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 1, color: "var(--kl-text-muted)", marginBottom: 4 }}>Verbs</div>
                    <div className="kl-mono" style={{ fontSize: 22, fontWeight: 700, color: "var(--kl-text)" }}>{effectivePermissions.verbs.length}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 1, color: "var(--kl-text-muted)", marginBottom: 4 }}>Resources</div>
                    <div className="kl-mono" style={{ fontSize: 22, fontWeight: 700, color: "var(--kl-text)" }}>{effectivePermissions.resources.length}</div>
                  </div>
                </div>
                {effectivePermissions.rules.length === 0 ? (
                  <div style={{ fontSize: 12, color: "var(--kl-text-muted)" }}>No permissions granted.</div>
                ) : (
                  <div className="flex flex-col gap-3">
                    <div>
                      <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 1, color: "var(--kl-text-muted)", marginBottom: 6 }}>Can do</div>
                      <div className="flex flex-wrap gap-1">
                        {effectivePermissions.verbs.map((v) => (
                          <KLBadge key={v} tone={["delete", "deletecollection", "patch", "update", "create", "*"].includes(v) ? "warn" : "neutral"}>{v}</KLBadge>
                        ))}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 1, color: "var(--kl-text-muted)", marginBottom: 6 }}>On resources</div>
                      <div className="flex flex-wrap gap-1">
                        {effectivePermissions.resources.map((r) => <KLBadge key={r} tone="accent">{r}</KLBadge>)}
                      </div>
                    </div>
                  </div>
                )}
              </Panel>
            </div>
            <div className="flex flex-col gap-4">
              <Panel title="Info">
                <div className="grid gap-y-2 gap-x-3" style={{ gridTemplateColumns: "minmax(80px, 130px) 1fr", fontSize: 12 }}>
                  {[["Namespace", sa.metadata?.namespace], ["UID", sa.metadata?.uid], ["Automount", sa.automountServiceAccountToken !== false ? "Yes" : "No"], ["Created", sa.metadata?.creationTimestamp ? calculateAge(sa.metadata.creationTimestamp) + " ago" : "—"]].map(([l, v]) => (
                    <React.Fragment key={l}>
                      <span style={{ color: "var(--kl-text-muted)" }}>{l}</span>
                      <span className="kl-mono break-all" style={{ color: "var(--kl-text)" }}>{v ?? "—"}</span>
                    </React.Fragment>
                  ))}
                </div>
                <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--kl-border)", display: "flex", alignItems: "center", gap: 8 }}>
                  <KLBadge tone={privilegeTone(privilegeLevel)}>{privilegeLevel}</KLBadge>
                  <span style={{ fontSize: 11, color: "var(--kl-text-muted)" }}>{riskLevel?.factors?.map((f) => f.replace(/-/g, " ")).join(" · ")}</span>
                </div>
              </Panel>
              {allBindings.length > 0 && (
                <Panel title="Role Bindings" subtitle={`${allBindings.length} binding${allBindings.length !== 1 ? "s" : ""}`}>
                  {allBindings.map((b) => (
                    <div key={b.metadata?.uid} style={{ padding: "7px 0", borderTop: "1px solid var(--kl-border)" }}>
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <KLBadge tone="neutral">{b.kind === "ClusterRoleBinding" ? "CRB" : "RB"}</KLBadge>
                        <span className="kl-mono break-all" style={{ fontSize: 12, flex: 1 }}>{b.metadata?.name}</span>
                      </div>
                      <div style={{ fontSize: 11, color: "var(--kl-text-muted)", paddingLeft: 2 }}>
                        {b.roleRef?.kind}: <span className="kl-mono" style={{ color: "var(--kl-text-2)" }}>{b.roleRef?.name}</span>
                        {b.metadata?.creationTimestamp && <span> · {calculateAge(b.metadata.creationTimestamp)} ago</span>}
                      </div>
                    </div>
                  ))}
                </Panel>
              )}
              {sa.secrets?.length > 0 && (
                <Panel title="Secrets">
                  {sa.secrets.map((s, i) => (
                    <div key={i} style={{ padding: "5px 0", borderTop: i > 0 ? "1px solid var(--kl-border)" : "none" }}>
                      <span className="kl-mono" style={{ fontSize: 12 }}>{s.name}</span>
                    </div>
                  ))}
                </Panel>
              )}
              <Panel title="Pods Using This Account">
                {pods.length === 0 ? (
                  <div style={{ fontSize: 12, color: "var(--kl-text-muted)" }}>No pods using this service account.</div>
                ) : (
                  pods.slice(0, 5).map((pod) => {
                    const phase = pod.status?.phase ?? "Unknown";
                    const pkind = phase === "Running" ? "ok" : phase === "Pending" ? "warn" : "err";
                    return (
                      <div key={pod.metadata?.uid} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 0", borderTop: "1px solid var(--kl-border)" }}>
                        <KLStatus kind={pkind} dotOnly />
                        <span className="kl-mono break-all" style={{ fontSize: 12, flex: 1 }}>{pod.metadata?.name}</span>
                        <KLBadge tone={pkind}>{phase}</KLBadge>
                      </div>
                    );
                  })
                )}
                {pods.length > 5 && <div style={{ fontSize: 11, color: "var(--kl-text-muted)", paddingTop: 6 }}>+{pods.length - 5} more — see Pods tab</div>}
              </Panel>
            </div>
          </div>
        )}
        {activeTab === "Permissions" && (
          <div className="flex flex-col gap-4">
            {allBindings.map((b) => (
              <Panel key={b.metadata?.uid} title={b.metadata?.name} subtitle={`${b.kind === "ClusterRoleBinding" ? "ClusterRoleBinding" : "RoleBinding"} → ${b.roleRef?.kind}: ${b.roleRef?.name}`}>
                <RulesTable rules={b.rules ?? []} />
              </Panel>
            ))}
            {allBindings.length === 0 && (
              <Panel title="Permissions">
                <div style={{ fontSize: 12, color: "var(--kl-text-muted)" }}>No role bindings found for this service account.</div>
              </Panel>
            )}
          </div>
        )}
        {activeTab === "Pods" && (
          <Panel title="Pods Using This Service Account" subtitle={pods.length > 0 ? `${pods.length} pod${pods.length !== 1 ? "s" : ""}` : undefined}>
            {pods.length === 0 ? (
              <div style={{ fontSize: 12, color: "var(--kl-text-muted)" }}>No pods are currently using this service account.</div>
            ) : (
              <div className="overflow-x-auto" style={{ scrollbarWidth: "none" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, minWidth: 360 }}>
                  <thead>
                    <tr>
                      {["Pod", "Namespace", "Phase"].map((h) => (
                        <th key={h} className="kl-mono" style={{ padding: "0 12px 8px 0", fontSize: 10, textTransform: "uppercase", letterSpacing: 1, color: "var(--kl-text-faint)", fontWeight: 600, textAlign: "left" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {pods.map((pod) => {
                      const phase = pod.status?.phase ?? "Unknown";
                      const pkind = phase === "Running" ? "ok" : phase === "Pending" ? "warn" : "err";
                      return (
                        <tr key={pod.metadata?.uid} style={{ borderTop: "1px solid var(--kl-border)" }}>
                          <td className="kl-mono" style={{ padding: "7px 12px 7px 0", color: "var(--kl-text)" }}>
                            <div className="flex items-center gap-2"><KLStatus kind={pkind} dotOnly />{pod.metadata?.name}</div>
                          </td>
                          <td className="kl-mono" style={{ padding: "7px 12px 7px 0", color: "var(--kl-text-muted)" }}>{pod.metadata?.namespace}</td>
                          <td style={{ padding: "7px 0" }}><KLBadge tone={pkind}>{phase}</KLBadge></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        )}
        {activeTab === "Dependencies" && <DependencyGraph resourceType="serviceaccount" resource={sa} />}
        {activeTab === "Events" && <SharedEventsTab events={events} />}
        {activeTab === "Metadata" && <SharedMetadataTab resource={sa} />}
      </div>
    </div>
  );
}
