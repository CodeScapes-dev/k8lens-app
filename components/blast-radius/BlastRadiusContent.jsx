"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useK8sResource } from "@/hooks/use-k8s";
import { useClusterStore } from "@/stores/clusterStore";
import { Panel } from "@/components/kl/Panel";
import { KLBadge } from "@/components/kl/Badge";
import { KLStatus } from "@/components/kl/Status";
import { ShieldAlertIcon, ShieldIcon } from "lucide-react";

function labelsMatch(selector, podLabels) {
  if (!selector || Object.keys(selector).length === 0) return false;
  return Object.entries(selector).every(([k, v]) => podLabels?.[k] === v);
}

function computeRisk(affectedPods, affectedServices, affectedIngresses, hasPdb) {
  if (affectedIngresses.length > 0 && !hasPdb) return "Critical";
  if (affectedServices.length > 1 || affectedPods.length > 10) return "High";
  if (affectedServices.length === 1 && hasPdb) return "Medium";
  return "Low";
}

const RISK_COLOR = {
  Critical: { text: "var(--kl-err)",  bg: "var(--kl-err-tint)",  border: "var(--kl-err)" },
  High:     { text: "var(--kl-warn)", bg: "var(--kl-warn-tint)", border: "var(--kl-warn)" },
  Medium:   { text: "#d97706",        bg: "rgba(245,158,11,0.08)", border: "rgba(245,158,11,0.4)" },
  Low:      { text: "var(--kl-ok)",   bg: "var(--kl-ok-tint)",   border: "var(--kl-ok)" },
};

const RISK_SUMMARY = {
  Critical: "One or more public Ingress routes are affected and no PodDisruptionBudget is in place.",
  High: "Multiple Services or more than 10 pods would be affected.",
  Medium: "One Service is affected but a PodDisruptionBudget provides some protection.",
  Low: "No Services or Ingresses affected — impact is limited.",
};

export function BlastRadiusContent({ resourceType, resource, namespace }) {
  const activeContext = useClusterStore((s) => s.activeContext);
  const router = useRouter();

  const { data: servicesData } = useK8sResource("core", "services", { namespace, context: activeContext });
  const { data: ingressesData } = useK8sResource("networking", "ingresses", { namespace, context: activeContext });
  const { data: pdbsData } = useK8sResource("policy", "poddisruptionbudgets", { namespace, context: activeContext });

  const services = servicesData?.items ?? [];
  const ingresses = ingressesData?.items ?? [];
  const pdbs = pdbsData?.items ?? [];

  const selector = resource?.spec?.selector?.matchLabels ?? resource?.spec?.selector ?? {};
  const pods = resource?.pods ?? [];
  const isNode = resourceType === "node";

  const affectedPods = pods.map((p) => ({ name: p?.metadata?.name, namespace: p?.metadata?.namespace ?? namespace }));

  const affectedServices = services.filter((svc) => {
    const svcSel = svc?.spec?.selector ?? {};
    if (Object.keys(svcSel).length === 0) return false;
    if (isNode) return pods.some((pod) => labelsMatch(svcSel, pod?.metadata?.labels ?? {}));
    return labelsMatch(svcSel, selector);
  });

  const affectedSvcNames = new Set(affectedServices.map((s) => s?.metadata?.name));
  const affectedIngresses = ingresses.filter((ing) =>
    (ing?.spec?.rules ?? []).some((rule) =>
      (rule?.http?.paths ?? []).some((path) => affectedSvcNames.has(path?.backend?.service?.name)),
    ),
  );

  const podLabels = pods[0]?.metadata?.labels ?? selector;
  const hasPdb = pdbs.some((pdb) => labelsMatch(pdb?.spec?.selector?.matchLabels ?? {}, podLabels));

  const riskLevel = computeRisk(affectedPods, affectedServices, affectedIngresses, hasPdb);
  const riskColor = RISK_COLOR[riskLevel];
  const { text: riskText, bg: riskBg, border: riskBorder } = riskColor;

  // Pod phase breakdown
  const phaseCounts = pods.reduce((acc, pod) => {
    const phase = pod.status?.phase ?? "Unknown";
    acc[phase] = (acc[phase] ?? 0) + 1;
    return acc;
  }, {});

  // Restart heatmap
  const podRestarts = pods.map((pod) => ({
    name: pod.metadata?.name,
    namespace: pod.metadata?.namespace ?? namespace,
    restarts: (pod.status?.containerStatuses ?? []).reduce((s, c) => s + (c.restartCount ?? 0), 0),
    phase: pod.status?.phase ?? "Unknown",
  })).sort((a, b) => b.restarts - a.restarts);
  const maxRestarts = Math.max(...podRestarts.map((p) => p.restarts), 1);

  // Node spread
  const nodeSpread = pods.reduce((acc, pod) => {
    const node = pod.spec?.nodeName ?? "unscheduled";
    acc[node] = (acc[node] ?? 0) + 1;
    return acc;
  }, {});

  if (affectedPods.length === 0 && affectedServices.length === 0 && affectedIngresses.length === 0) {
    return (
      <div style={{ padding: "40px 0", textAlign: "center", color: "var(--kl-text-muted)", fontSize: 13 }}>
        <ShieldIcon size={32} style={{ margin: "0 auto 12px", display: "block", opacity: 0.3 }} />
        No downstream impact detected. This resource has no services, ingresses, or dependent workloads.
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Risk banner */}
      <div style={{
        padding: "12px 16px", borderRadius: 10,
        background: riskBg, border: `1px solid ${riskBorder}`,
        display: "flex", alignItems: "center", gap: 12,
      }}>
        <ShieldAlertIcon size={20} style={{ color: riskText, flexShrink: 0 }} />
        <div>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: riskText }}>{riskLevel} Risk</div>
          <div style={{ fontSize: 12, color: "var(--kl-text-muted)", marginTop: 2 }}>{RISK_SUMMARY[riskLevel]}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
        {/* Left column */}
        <div className="flex flex-col gap-4">
          {/* Affected pods */}
          <Panel title="Affected Pods" subtitle={`${affectedPods.length} pod${affectedPods.length !== 1 ? "s" : ""} would be lost`}>
            {affectedPods.length === 0 ? (
              <span style={{ fontSize: 12, color: "var(--kl-text-muted)" }}>None</span>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {affectedPods.slice(0, 20).map((p) => (
                  <button
                    key={p.name}
                    onClick={() => router.push(`/workloads/pods/${p.namespace ?? namespace}/${p.name}`)}
                    style={{ textAlign: "left", background: "none", border: "none", cursor: "pointer", padding: "2px 0", fontSize: 12, color: "var(--kl-accent)", fontFamily: "monospace" }}
                  >
                    {p.name}
                  </button>
                ))}
                {affectedPods.length > 20 && <span style={{ fontSize: 11, color: "var(--kl-text-muted)" }}>+{affectedPods.length - 20} more</span>}
              </div>
            )}
          </Panel>

          {/* Pod phase distribution */}
          {pods.length > 0 && (
            <Panel title="Pod Phase Distribution">
              {Object.entries(phaseCounts).map(([phase, count]) => {
                const pct = pods.length > 0 ? Math.round((count / pods.length) * 100) : 0;
                const color = phase === "Running" ? "var(--kl-ok)" : phase === "Pending" ? "var(--kl-warn)" : "var(--kl-err)";
                return (
                  <div key={phase} style={{ marginBottom: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                      <span style={{ fontSize: 12 }}>{phase}</span>
                      <span className="kl-mono" style={{ fontSize: 12, color: "var(--kl-text-muted)" }}>{count} ({pct}%)</span>
                    </div>
                    <div style={{ height: 6, borderRadius: 3, background: "var(--kl-surface-3)", overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 3 }} />
                    </div>
                  </div>
                );
              })}
            </Panel>
          )}

          {/* Affected services */}
          <Panel title="Affected Services" subtitle={`${affectedServices.length} service${affectedServices.length !== 1 ? "s" : ""}`}>
            {affectedServices.length === 0 ? (
              <span style={{ fontSize: 12, color: "var(--kl-text-muted)" }}>None</span>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {affectedServices.map((svc) => (
                  <div key={svc?.metadata?.name} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span className="kl-mono" style={{ fontSize: 12 }}>{svc?.metadata?.name}</span>
                    <KLBadge tone="neutral">{svc?.spec?.type ?? "ClusterIP"}</KLBadge>
                  </div>
                ))}
              </div>
            )}
          </Panel>

          {/* Affected ingress routes */}
          <Panel title="Affected Ingress Routes" subtitle={`${affectedIngresses.length} ingress${affectedIngresses.length !== 1 ? "es" : ""}`}>
            {affectedIngresses.length === 0 ? (
              <span style={{ fontSize: 12, color: "var(--kl-text-muted)" }}>None</span>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {affectedIngresses.flatMap((ing) =>
                  (ing?.spec?.rules ?? []).map((rule, ri) => (
                    <div key={`${ing?.metadata?.name}-${ri}`} style={{ fontSize: 12 }}>
                      <span className="kl-mono" style={{ color: "var(--kl-text)" }}>{rule?.host}</span>
                      {(rule?.http?.paths ?? []).map((p, pi) => (
                        <span key={pi} className="kl-mono" style={{ color: "var(--kl-text-muted)", marginLeft: 4 }}>{p.path}</span>
                      ))}
                    </div>
                  )),
                )}
              </div>
            )}
          </Panel>
        </div>

        {/* Right column */}
        <div className="flex flex-col gap-4">
          {/* Node spread */}
          <Panel title="Node Spread" subtitle={`${Object.keys(nodeSpread).length} node${Object.keys(nodeSpread).length !== 1 ? "s" : ""}`}>
            {Object.keys(nodeSpread).length === 0 ? (
              <span style={{ fontSize: 12, color: "var(--kl-text-muted)" }}>No pods scheduled</span>
            ) : (
              <>
                {Object.entries(nodeSpread).sort((a, b) => b[1] - a[1]).map(([node, count]) => (
                  <div key={node} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 0", borderBottom: "1px solid var(--kl-border)" }}>
                    <span style={{ fontSize: 14, color: "var(--kl-text-muted)" }}>⬡</span>
                    <span className="kl-mono" style={{ fontSize: 12, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{node}</span>
                    <KLBadge tone="neutral">{count} pod{count !== 1 ? "s" : ""}</KLBadge>
                  </div>
                ))}
                {Object.keys(nodeSpread).length > 1 && (
                  <div style={{ marginTop: 10, padding: "8px 12px", background: "var(--kl-ok-tint)", border: "1px solid var(--kl-ok)", borderRadius: 7, fontSize: 12, color: "var(--kl-ok)" }}>
                    Pods spread across {Object.keys(nodeSpread).length} nodes — failure of any single node affects at most {Math.max(...Object.values(nodeSpread))} pod{Math.max(...Object.values(nodeSpread)) !== 1 ? "s" : ""}.
                  </div>
                )}
                {Object.keys(nodeSpread).length === 1 && pods.length > 1 && (
                  <div style={{ marginTop: 10, padding: "8px 12px", background: "var(--kl-warn-tint)", border: "1px solid var(--kl-warn)", borderRadius: 7, fontSize: 12, color: "var(--kl-warn)" }}>
                    All pods on a single node — node failure would take down all {pods.length} replicas.
                  </div>
                )}
              </>
            )}
          </Panel>

          {/* Restart heatmap */}
          {pods.length > 0 && (
            <Panel title="Restart Heatmap" subtitle="pods by restart count">
              {podRestarts.map((p) => {
                const heat = maxRestarts > 0 ? p.restarts / maxRestarts : 0;
                const color = heat === 0 ? "var(--kl-ok)" : heat < 0.4 ? "var(--kl-warn)" : "var(--kl-err)";
                return (
                  <div key={p.name} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 0", borderBottom: "1px solid var(--kl-border)" }}>
                    <KLStatus kind={p.phase === "Running" ? "ok" : "warn"} dotOnly />
                    <button
                      onClick={() => router.push(`/workloads/pods/${p.namespace}/${p.name}`)}
                      style={{ textAlign: "left", background: "none", border: "none", cursor: "pointer", fontSize: 11, color: "var(--kl-accent)", fontFamily: "monospace", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                    >
                      {p.name}
                    </button>
                    <span className="kl-mono" style={{ fontSize: 12, fontWeight: 600, color }}>{p.restarts}</span>
                  </div>
                );
              })}
            </Panel>
          )}
        </div>
      </div>
    </div>
  );
}
