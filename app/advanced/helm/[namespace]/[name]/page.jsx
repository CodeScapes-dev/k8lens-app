"use client";

import React from "react";
import { useParams } from "next/navigation";
import { LayoutDashboardIcon, LayersIcon, CodeIcon, TagIcon } from "lucide-react";
import { useK8sResource } from "@/hooks/use-k8s";
import { KLStatus } from "@/components/kl/Status";
import { KLBadge } from "@/components/kl/Badge";
import { Panel } from "@/components/kl/Panel";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { SharedMetadataTab } from "@/components/shared-detail-tabs/SharedMetadataTab";
import { QuickStat } from "@/components/detail/helpers";
import { calculateAge } from "@/lib/k8s/utils";

const TABS = [
  { id: "Overview", icon: LayoutDashboardIcon },
  { id: "Resources", icon: LayersIcon },
  { id: "Values", icon: CodeIcon },
  { id: "Metadata", icon: TagIcon },
];

function helmStatusTone(phase) {
  if (phase === "deployed") return "ok";
  if (phase === "failed") return "err";
  return "warn";
}

function InfoRow({ label, value }) {
  return (
    <React.Fragment>
      <span style={{ color: "var(--kl-text-muted)", fontSize: 12 }}>{label}</span>
      <span className="kl-mono break-all" style={{ color: "var(--kl-text)", fontSize: 12 }}>{value ?? "—"}</span>
    </React.Fragment>
  );
}

function OverviewTab({ release }) {
  if (!release) return null;
  const { spec, status, metadata } = release;
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
      <Panel title="Release Info">
        <div className="grid gap-y-2 gap-x-3" style={{ gridTemplateColumns: "minmax(80px, 140px) 1fr" }}>
          <InfoRow label="Name" value={metadata?.name} />
          <InfoRow label="Namespace" value={metadata?.namespace} />
          <InfoRow label="Status" value={status?.phase} />
          <InfoRow label="Description" value={status?.description} />
          <InfoRow label="Revision" value={spec?.revision} />
          <InfoRow label="First Deployed" value={status?.firstDeployed ? calculateAge(status.firstDeployed) + " ago" : "—"} />
          <InfoRow label="Last Deployed" value={metadata?.creationTimestamp ? calculateAge(metadata.creationTimestamp) + " ago" : "—"} />
        </div>
      </Panel>
      <Panel title="Chart Info">
        <div className="grid gap-y-2 gap-x-3" style={{ gridTemplateColumns: "minmax(80px, 140px) 1fr" }}>
          <InfoRow label="Chart" value={spec?.chart} />
          <InfoRow label="Version" value={spec?.chartVersion} />
          <InfoRow label="App Version" value={spec?.appVersion} />
          <InfoRow label="Description" value={spec?.description} />
          {spec?.chartHome && <InfoRow label="Home" value={spec.chartHome} />}
          {spec?.keywords?.length > 0 && (
            <React.Fragment>
              <span style={{ color: "var(--kl-text-muted)", fontSize: 12 }}>Keywords</span>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                {spec.keywords.map((k) => (
                  <Badge key={k} variant="secondary" className="font-mono text-[10px] font-normal">{k}</Badge>
                ))}
              </div>
            </React.Fragment>
          )}
        </div>
      </Panel>
    </div>
  );
}

function ResourcesTab({ resources }) {
  if (!resources || resources.length === 0) {
    return <p style={{ fontSize: 13, color: "var(--kl-text-muted)", textAlign: "center", paddingTop: 32 }}>No resources found in this release manifest.</p>;
  }
  return (
    <Panel title="Managed Resources" subtitle={`${resources.length} resource${resources.length !== 1 ? "s" : ""}`}>
      <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
        {resources.map((r, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderTop: i === 0 ? "none" : "1px solid var(--kl-border)" }}>
            <KLBadge tone="accent" style={{ flexShrink: 0 }}>{r.kind}</KLBadge>
            <span className="kl-mono" style={{ fontSize: 12, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name}</span>
            {r.namespace && (
              <Badge variant="secondary" className="font-mono text-[10px] font-normal shrink-0">{r.namespace}</Badge>
            )}
          </div>
        ))}
      </div>
    </Panel>
  );
}

function ValuesTab({ config }) {
  const isEmpty = !config || Object.keys(config).length === 0;
  if (isEmpty) {
    return <p style={{ fontSize: 13, color: "var(--kl-text-muted)", textAlign: "center", paddingTop: 32 }}>No user-supplied values for this release.</p>;
  }
  const yaml = objectToYaml(config);
  return (
    <Panel title="User Values">
      <pre style={{ fontFamily: "var(--font-mono)", fontSize: 12, lineHeight: 1.6, color: "var(--kl-text)", background: "var(--kl-surface-2)", padding: "12px 14px", borderRadius: 6, overflowX: "auto", margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
        {yaml}
      </pre>
    </Panel>
  );
}

function objectToYaml(obj, indent = 0) {
  const pad = "  ".repeat(indent);
  let out = "";
  for (const [k, v] of Object.entries(obj)) {
    if (v === null || v === undefined) {
      out += `${pad}${k}: null\n`;
    } else if (typeof v === "object" && !Array.isArray(v)) {
      out += `${pad}${k}:\n${objectToYaml(v, indent + 1)}`;
    } else if (Array.isArray(v)) {
      if (v.length === 0) {
        out += `${pad}${k}: []\n`;
      } else {
        out += `${pad}${k}:\n`;
        for (const item of v) {
          if (typeof item === "object") {
            out += `${pad}- \n${objectToYaml(item, indent + 1)}`;
          } else {
            out += `${pad}- ${item}\n`;
          }
        }
      }
    } else {
      out += `${pad}${k}: ${v}\n`;
    }
  }
  return out;
}

export default function HelmReleaseDetailPage() {
  const { namespace, name } = useParams();
  const [activeTab, setActiveTab] = React.useState("Overview");

  const { data, loading, error, refresh } = useK8sResource("helm", "releases", {
    namespace,
    listParams: {},
  });

  const release = React.useMemo(
    () => (Array.isArray(data) ? data.find((r) => r.metadata?.name === name) : data?.item ?? null),
    [data, name]
  );

  const phase = release?.status?.phase ?? "unknown";
  const resources = release?.resources ?? [];

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
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-7 w-72" />
            <Skeleton className="h-5 w-full max-w-sm" />
          </div>
        ) : (
          <>
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-4">
              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <KLStatus kind={helmStatusTone(phase)} dotOnly />
                  <span className="font-mono text-xs text-muted-foreground">
                    HelmRelease · helm.sh/release.v1 · {namespace}
                  </span>
                </div>
                <h1 className="font-mono text-xl sm:text-2xl font-semibold tracking-tight break-all">{name}</h1>
                <div className="flex flex-wrap gap-1.5">
                  {release?.spec?.chart && (
                    <Badge variant="outline" className="font-mono text-[10.5px] font-normal">
                      {release.spec.chart} {release.spec.chartVersion}
                    </Badge>
                  )}
                  {release?.spec?.appVersion && release.spec.appVersion !== "—" && (
                    <Badge variant="secondary" className="font-mono text-[10.5px] font-normal">
                      app {release.spec.appVersion}
                    </Badge>
                  )}
                </div>
              </div>
              <div className="overflow-x-auto w-full sm:w-auto shrink-0" style={{ scrollbarWidth: "none" }}>
                <div className="grid grid-cols-4 rounded-xl border border-border overflow-hidden divide-x divide-border min-w-[280px] sm:min-w-0">
                  <QuickStat label="Status" value={phase} />
                  <QuickStat label="Revision" value={release?.spec?.revision ?? "—"} />
                  <QuickStat label="Resources" value={resources.length} />
                  <QuickStat label="Age" value={release?.metadata?.creationTimestamp ? calculateAge(release.metadata.creationTimestamp) : "—"} />
                </div>
              </div>
            </div>
            <div className="flex" style={{ overflowX: "auto", overflowY: "hidden", scrollbarWidth: "none", touchAction: "pan-x", overscrollBehaviorX: "contain" }}>
              <div className="flex gap-0 min-w-max">
                {TABS.map(({ id, icon: Icon }) => {
                  const active = activeTab === id;
                  return (
                    <button
                      key={id}
                      onClick={() => setActiveTab(id)}
                      style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 16px", background: "none", border: "none", borderBottom: active ? "2px solid var(--foreground)" : "2px solid transparent", fontSize: 13, fontWeight: active ? 600 : 400, color: active ? "var(--foreground)" : "var(--muted-foreground)", cursor: "pointer", marginBottom: -1, whiteSpace: "nowrap" }}
                    >
                      <Icon size={13} />{id}
                      {id === "Resources" && resources.length > 0 && (
                        <Badge className="text-[10px] h-4 min-w-4 px-1 rounded-full">{resources.length}</Badge>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>
      <div className="px-4 sm:px-7 py-5">
        {activeTab === "Overview" && <OverviewTab release={release} />}
        {activeTab === "Resources" && <ResourcesTab resources={resources} />}
        {activeTab === "Values" && <ValuesTab config={release?.config} />}
        {activeTab === "Metadata" && <SharedMetadataTab resource={release} />}
      </div>
    </div>
  );
}
