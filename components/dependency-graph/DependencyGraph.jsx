"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { resolveDependencies } from "@/lib/k8s/dependency-resolver";
import { useK8sResource } from "@/hooks/use-k8s";
import { useClusterStore } from "@/stores/clusterStore";

const KIND_COLOR = {
  Pod: "#6366f1",
  Deployment: "#3b82f6",
  StatefulSet: "#8b5cf6",
  DaemonSet: "#06b6d4",
  Service: "#10b981",
  Ingress: "#f59e0b",
  ConfigMap: "#84cc16",
  Secret: "#ef4444",
  ServiceAccount: "#f97316",
  PersistentVolumeClaim: "#a78bfa",
  PersistentVolume: "#7c3aed",
  StorageClass: "#64748b",
  HorizontalPodAutoscaler: "#ec4899",
  Role: "#f43f5e",
  ClusterRole: "#dc2626",
};

function kindRoute(kind, namespace, name) {
  const routeMap = {
    Pod: `/workloads/pods/${namespace}/${name}`,
    Deployment: `/workloads/deployments/${namespace}/${name}`,
    StatefulSet: `/workloads/statefulsets/${namespace}/${name}`,
    DaemonSet: `/workloads/daemonsets/${namespace}/${name}`,
    Service: `/network/services/${namespace}/${name}`,
    Ingress: `/network/ingresses/${namespace}/${name}`,
    ConfigMap: `/configuration/configmaps/${namespace}/${name}`,
    Secret: `/configuration/secrets/${namespace}/${name}`,
    ServiceAccount: `/access-control/serviceaccounts/${namespace}/${name}`,
    Role: `/access-control/roles/${namespace}/${name}`,
    ClusterRole: `/access-control/clusterroles/${name}`,
    HorizontalPodAutoscaler: `/advanced/hpa/${namespace}/${name}`,
    PersistentVolumeClaim: `/storage/persistentvolumeclaims/${namespace}/${name}`,
    PersistentVolume: `/storage/persistentvolumes/${name}`,
  };
  return routeMap[kind] ?? null;
}

function Node({ kind, name, namespace, relationship, isRoot = false, onClick }) {
  const color = KIND_COLOR[kind] ?? "var(--kl-text-muted)";
  return (
    <div
      onClick={onClick}
      title={relationship ? `${relationship} → ${kind}/${name}` : `${kind}/${name}`}
      style={{
        padding: "8px 12px", borderRadius: 8,
        border: `${isRoot ? 2 : 1.5}px solid ${color}`,
        background: color + (isRoot ? "25" : "12"),
        cursor: onClick ? "pointer" : "default",
        display: "flex", flexDirection: "column", gap: 3,
        minWidth: 140, maxWidth: 200,
        transition: "opacity 0.15s",
      }}
    >
      <span style={{ fontSize: 9.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.8, color }}>{kind}</span>
      <span className="kl-mono" style={{ fontSize: 11.5, color: "var(--kl-text)", wordBreak: "break-all" }}>{name}</span>
      {relationship && (
        <span style={{ fontSize: 9.5, color: "var(--kl-text-muted)" }}>{relationship}</span>
      )}
    </div>
  );
}

function Column({ title, nodes, onNodeClick }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "center", minWidth: 160 }}>
      {title && <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 0.8, color: "var(--kl-text-muted)", marginBottom: 4 }}>{title}</div>}
      {nodes.map((n, i) => (
        <Node
          key={i}
          {...n}
          onClick={() => {
            const route = kindRoute(n.kind, n.namespace, n.name);
            if (route) onNodeClick(route);
          }}
        />
      ))}
    </div>
  );
}

export function DependencyGraph({ resourceType, resource }) {
  const activeContext = useClusterStore((s) => s.activeContext);
  const router = useRouter();
  const namespace = resource?.metadata?.namespace;

  const { data: servicesData } = useK8sResource("core", "services", { namespace, context: activeContext });
  const { data: ingressesData } = useK8sResource("networking", "ingresses", { namespace, context: activeContext });
  const { data: podsData } = useK8sResource("core", "pods", { namespace, context: activeContext });
  const { data: hpasData } = useK8sResource("autoscaling", "horizontalpodautoscalers", { namespace, context: activeContext });
  const { data: rbData } = useK8sResource("rbac.authorization.k8s.io", "rolebindings", { namespace, context: activeContext });

  const allData = {
    services: servicesData?.items ?? [],
    ingresses: ingressesData?.items ?? [],
    pods: podsData?.items ?? [],
    hpas: hpasData?.items ?? [],
    roleBindings: rbData?.items ?? [],
  };

  const { upstream, downstream } = React.useMemo(
    () => resolveDependencies(resourceType, resource, allData),
    [resourceType, resource, servicesData, ingressesData, podsData, hpasData, rbData],
  );

  const rootName = resource?.metadata?.name ?? resourceType;
  const rootKind = resourceType.charAt(0).toUpperCase() + resourceType.slice(1);

  if (upstream.length === 0 && downstream.length === 0) {
    return (
      <div style={{ padding: "60px 0", textAlign: "center", color: "var(--kl-text-muted)", fontSize: 13 }}>
        No dependencies found for this resource.
      </div>
    );
  }

  return (
    <div style={{ display: "flex", gap: 32, alignItems: "flex-start", justifyContent: "center", flexWrap: "wrap", padding: "32px 0" }}>
      {upstream.length > 0 && (
        <Column title="Upstream" nodes={upstream} onNodeClick={(route) => router.push(route)} />
      )}

      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
        {upstream.length > 0 && (
          <div style={{ width: 1, height: 24, background: "var(--kl-border)" }} />
        )}
        <Node kind={rootKind} name={rootName} isRoot />
        {downstream.length > 0 && (
          <div style={{ width: 1, height: 24, background: "var(--kl-border)" }} />
        )}
      </div>

      {downstream.length > 0 && (
        <Column title="Downstream" nodes={downstream} onNodeClick={(route) => router.push(route)} />
      )}
    </div>
  );
}
