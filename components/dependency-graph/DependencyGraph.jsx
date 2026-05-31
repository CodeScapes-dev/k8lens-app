"use client";

import React from "react";
import { useRouter } from "next/navigation";
import {
  ReactFlow, ReactFlowProvider, Background, Controls,
  useNodesState, useEdgesState, useReactFlow,
  Handle, Position, BaseEdge, EdgeLabelRenderer, getSmoothStepPath,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import dagre from "dagre";

import { useK8sResource } from "@/hooks/use-k8s";
import { useClusterStore } from "@/stores/clusterStore";
import { KIND_COLOR, kindRoute } from "@/lib/k8s/kind-config";

const useStore = useClusterStore;

const NODE_W = 164;
const NODE_H = 68;

// ── Dep node card ──────────────────────────────────────────────────────────
function DepNode({ data, selected }) {
  const { kind, name, isRoot, relationship } = data;
  const color = KIND_COLOR[kind] ?? "#94a3b8";
  return (
    <div
      style={{
        background: "var(--kl-surface)",
        borderTop:    `1.5px solid ${selected || isRoot ? color : "var(--kl-border)"}`,
        borderRight:  `1.5px solid ${selected || isRoot ? color : "var(--kl-border)"}`,
        borderBottom: `1.5px solid ${selected || isRoot ? color : "var(--kl-border)"}`,
        borderLeft:   `3px solid ${color}`,
        borderRadius: 8,
        padding: "7px 10px 7px 8px",
        width: NODE_W,
        minHeight: NODE_H,
        cursor: "pointer",
        boxShadow: isRoot
          ? `0 0 0 3px ${color}28, 0 2px 8px rgba(0,0,0,0.1)`
          : "0 1px 4px rgba(0,0,0,0.07)",
        display: "flex", flexDirection: "column", gap: 3,
        transition: "box-shadow 0.15s",
      }}
    >
      <Handle type="target" position={Position.Left}  style={{ background: color, width: 6, height: 6, left: -4 }} />
      <Handle type="source" position={Position.Right} style={{ background: color, width: 6, height: 6, right: -4 }} />
      <span style={{ fontSize: 9.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.7, color }}>
        {kind}
      </span>
      <span
        title={name}
        style={{
          fontSize: 11.5, fontWeight: 600, fontFamily: "monospace",
          color: "var(--kl-text)", overflow: "hidden",
          textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}
      >
        {name}
      </span>
      {relationship && (
        <span style={{ fontSize: 9.5, color: "var(--kl-text-muted)" }}>{relationship}</span>
      )}
    </div>
  );
}

// ── Dep edge ───────────────────────────────────────────────────────────────
function DepEdge({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, label, style, markerEnd }) {
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX, sourceY, sourcePosition,
    targetX, targetY, targetPosition,
    borderRadius: 6,
  });
  return (
    <>
      <BaseEdge id={id} path={edgePath} style={style} markerEnd={markerEnd} />
      {label && (
        <EdgeLabelRenderer>
          <div
            className="nodrag nopan"
            style={{
              position: "absolute",
              transform: `translate(-50%,-50%) translate(${labelX}px,${labelY}px)`,
              fontSize: 9,
              color: style?.stroke ?? "#94a3b8",
              background: "var(--kl-surface)",
              padding: "1px 4px",
              borderRadius: 3,
              pointerEvents: "none",
              whiteSpace: "nowrap",
            }}
          >
            {label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

const nodeTypes = { dep: DepNode };
const edgeTypes = { dep: DepEdge };

// ── Graph data builder ─────────────────────────────────────────────────────
function buildGraph(resourceType, resource, allData) {
  const meta   = resource?.metadata ?? {};
  const spec   = resource?.spec ?? {};
  const ns     = meta.namespace;
  const rname  = meta.name;

  const nodesMap = new Map();
  const edges    = [];
  const edgeSet  = new Set();

  const rootKind = resourceType.charAt(0).toUpperCase() + resourceType.slice(1);
  const rootId   = "root";
  nodesMap.set(rootId, { id: rootId, kind: rootKind, name: rname, namespace: ns, relationship: null, isRoot: true });

  const addNode = (kind, name, namespace, relationship) => {
    const id = `${kind}__${namespace ?? ""}__${name}`;
    if (!nodesMap.has(id)) {
      nodesMap.set(id, { id, kind, name, namespace, relationship, isRoot: false });
    }
    return id;
  };

  const addEdge = (source, target, label, color) => {
    if (!source || !target || source === target) return;
    const eid = `e__${source}__${target}`;
    if (edgeSet.has(eid)) return;
    edgeSet.add(eid);
    edges.push({
      id: eid, source, target, type: "dep", label,
      style: { stroke: color ?? "#64748b", strokeWidth: 1.5, opacity: 0.85 },
      markerEnd: { type: "arrowclosed", color: color ?? "#64748b", width: 12, height: 12 },
    });
  };

  // ── Kind-specific rules ────────────────────────────────────────────────
  switch (resourceType) {
    case "deployment":
    case "statefulset":
    case "daemonset": {
      const tSpec      = spec.template?.spec   ?? {};
      const tMeta      = spec.template?.metadata ?? {};
      const podLabels  = tMeta.labels ?? {};
      const matchLabels = spec.selector?.matchLabels ?? {};

      // Volumes → ConfigMap / Secret / PVC
      (tSpec.volumes ?? []).forEach((v) => {
        if (v.configMap?.name) {
          const id = addNode("ConfigMap", v.configMap.name, ns, "mounts");
          addEdge(id, rootId, "mounts", KIND_COLOR.ConfigMap);
        }
        if (v.secret?.secretName) {
          const id = addNode("Secret", v.secret.secretName, ns, "mounts");
          addEdge(id, rootId, "secret mount", KIND_COLOR.Secret);
        }
        if (v.persistentVolumeClaim?.claimName) {
          const id = addNode("PersistentVolumeClaim", v.persistentVolumeClaim.claimName, ns, "mounts");
          addEdge(id, rootId, "mounts", KIND_COLOR.PersistentVolumeClaim);
        }
      });

      // Env refs
      const containers = [...(tSpec.initContainers ?? []), ...(tSpec.containers ?? [])];
      const seen = new Set();
      containers.forEach((c) => {
        (c.envFrom ?? []).forEach((e) => {
          if (e.configMapRef?.name && !seen.has("cm:" + e.configMapRef.name)) {
            seen.add("cm:" + e.configMapRef.name);
            const id = addNode("ConfigMap", e.configMapRef.name, ns, "envFrom");
            addEdge(id, rootId, "envFrom", KIND_COLOR.ConfigMap);
          }
          if (e.secretRef?.name && !seen.has("sec:" + e.secretRef.name)) {
            seen.add("sec:" + e.secretRef.name);
            const id = addNode("Secret", e.secretRef.name, ns, "envFrom");
            addEdge(id, rootId, "envFrom", KIND_COLOR.Secret);
          }
        });
      });

      // ServiceAccount
      if (tSpec.serviceAccountName && tSpec.serviceAccountName !== "default") {
        const id = addNode("ServiceAccount", tSpec.serviceAccountName, ns, "uses");
        addEdge(id, rootId, "uses", KIND_COLOR.ServiceAccount ?? "#f97316");
      }

      // Downstream: ReplicaSets → Pods  (deployment only)
      if (resourceType === "deployment") {
        (allData.replicasets ?? []).forEach((rs) => {
          const owners = rs?.metadata?.ownerReferences ?? [];
          if (!owners.some((o) => o.kind === "Deployment" && o.name === rname)) return;
          const rsId = addNode("ReplicaSet", rs?.metadata?.name, ns, null);
          addEdge(rootId, rsId, "owns", KIND_COLOR.ReplicaSet);

          (allData.pods ?? []).forEach((pod) => {
            const podOwners = pod?.metadata?.ownerReferences ?? [];
            if (podOwners.some((o) => o.kind === "ReplicaSet" && o.name === rs?.metadata?.name)) {
              const podId = addNode("Pod", pod?.metadata?.name, ns, null);
              addEdge(rsId, podId, "owns", KIND_COLOR.Pod);
            }
          });
        });
      } else {
        // StatefulSet / DaemonSet → Pods directly
        const ownerKind = resourceType === "statefulset" ? "StatefulSet" : "DaemonSet";
        (allData.pods ?? []).forEach((pod) => {
          const podOwners = pod?.metadata?.ownerReferences ?? [];
          if (podOwners.some((o) => o.kind === ownerKind && o.name === rname)) {
            const podId = addNode("Pod", pod?.metadata?.name, ns, null);
            addEdge(rootId, podId, "owns", KIND_COLOR.Pod);
          }
        });
      }

      // Downstream: Services that select this workload
      (allData.services ?? []).forEach((svc) => {
        const svcSel = svc?.spec?.selector ?? {};
        if (Object.keys(svcSel).length === 0) return;
        if (Object.entries(svcSel).every(([k, v]) => podLabels[k] === v || matchLabels[k] === v)) {
          const svcId = addNode("Service", svc?.metadata?.name, svc?.metadata?.namespace ?? ns, null);
          addEdge(rootId, svcId, "exposes", KIND_COLOR.Service);
        }
      });

      // Downstream: HPAs
      (allData.hpas ?? []).forEach((hpa) => {
        const ref = hpa?.spec?.scaleTargetRef;
        if (ref?.name === rname) {
          const hpaId = addNode("HorizontalPodAutoscaler", hpa?.metadata?.name, hpa?.metadata?.namespace ?? ns, null);
          addEdge(rootId, hpaId, "scales", KIND_COLOR.HorizontalPodAutoscaler);
        }
      });

      break;
    }

    case "service": {
      const selector = spec.selector ?? {};
      (allData.pods ?? []).forEach((pod) => {
        const l = pod?.metadata?.labels ?? {};
        if (Object.keys(selector).length > 0 && Object.entries(selector).every(([k, v]) => l[k] === v)) {
          const id = addNode("Pod", pod?.metadata?.name, pod?.metadata?.namespace ?? ns, null);
          addEdge(rootId, id, "selects", KIND_COLOR.Pod);
        }
      });
      (allData.ingresses ?? []).forEach((ing) => {
        const refs = (ing?.spec?.rules ?? []).flatMap((r) => r?.http?.paths ?? []).map((p) => p?.backend?.service?.name);
        if (refs.includes(rname)) {
          const id = addNode("Ingress", ing?.metadata?.name, ing?.metadata?.namespace ?? ns, null);
          addEdge(id, rootId, "routes to", KIND_COLOR.Ingress);
        }
      });
      break;
    }

    case "ingress": {
      (spec.rules ?? []).forEach((rule) => {
        (rule?.http?.paths ?? []).forEach((p) => {
          const svcName = p?.backend?.service?.name;
          if (svcName) {
            const id = addNode("Service", svcName, ns, null);
            addEdge(rootId, id, "routes to", KIND_COLOR.Service);
          }
        });
      });
      break;
    }

    case "pod": {
      (spec.volumes ?? []).forEach((v) => {
        if (v.configMap?.name) {
          const id = addNode("ConfigMap", v.configMap.name, ns, "mounts");
          addEdge(id, rootId, "mounts", KIND_COLOR.ConfigMap);
        }
        if (v.secret?.secretName) {
          const id = addNode("Secret", v.secret.secretName, ns, "mounts");
          addEdge(id, rootId, "mounts", KIND_COLOR.Secret);
        }
        if (v.persistentVolumeClaim?.claimName) {
          const id = addNode("PersistentVolumeClaim", v.persistentVolumeClaim.claimName, ns, "mounts");
          addEdge(id, rootId, "mounts", KIND_COLOR.PersistentVolumeClaim);
        }
      });
      if (spec.serviceAccountName) {
        const id = addNode("ServiceAccount", spec.serviceAccountName, ns, "uses");
        addEdge(id, rootId, "uses", KIND_COLOR.ServiceAccount ?? "#f97316");
      }
      break;
    }

    default:
      break;
  }

  return { nodes: [...nodesMap.values()], edges };
}

// ── Dagre layout ───────────────────────────────────────────────────────────
function applyLayout(rawNodes, rawEdges) {
  if (rawNodes.length === 0) return { rfNodes: [], rfEdges: [] };

  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: "LR", ranksep: 80, nodesep: 36, marginx: 24, marginy: 24 });
  rawNodes.forEach((n) => g.setNode(n.id, { width: NODE_W, height: NODE_H }));
  rawEdges.forEach((e) => g.setEdge(e.source, e.target));
  dagre.layout(g);

  const rfNodes = rawNodes.map((n) => {
    const pos = g.node(n.id);
    return {
      id: n.id,
      type: "dep",
      position: { x: pos.x - NODE_W / 2, y: pos.y - NODE_H / 2 },
      data: n,
      width: NODE_W,
      height: NODE_H,
    };
  });

  return { rfNodes, rfEdges: rawEdges };
}

// ── Inner (needs useReactFlow) ─────────────────────────────────────────────
function DepGraphInner({ resourceType, resource, allData }) {
  const router = useRouter();
  const { fitView } = useReactFlow();

  const { nodes: rawNodes, edges: rawEdges } = React.useMemo(
    () => (resource ? buildGraph(resourceType, resource, allData) : { nodes: [], edges: [] }),
    [resourceType, resource, allData]
  );

  const { rfNodes, rfEdges } = React.useMemo(
    () => applyLayout(rawNodes, rawEdges),
    [rawNodes, rawEdges]
  );

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  React.useEffect(() => {
    setNodes(rfNodes);
    setEdges(rfEdges);
    if (rfNodes.length > 0) {
      setTimeout(() => fitView({ padding: 0.14, duration: 300 }), 60);
    }
  }, [rfNodes, rfEdges, setNodes, setEdges, fitView]);

  const handleNodeClick = React.useCallback((_, node) => {
    if (node.data?.isRoot) return;
    const { kind, name, namespace } = node.data;
    const route = kindRoute(kind, namespace, name);
    if (route) router.push(route);
  }, [router]);

  if (rawNodes.length <= 1) {
    return (
      <div style={{ padding: "60px 0", textAlign: "center", color: "var(--kl-text-muted)", fontSize: 13 }}>
        No dependencies found for this resource.
      </div>
    );
  }

  return (
    <div style={{ height: 460, borderRadius: 12, overflow: "hidden", border: "1px solid var(--kl-border)" }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodeClick={handleNodeClick}
        fitView
        fitViewOptions={{ padding: 0.14 }}
        minZoom={0.2}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
      >
        <Background color="var(--kl-border)" gap={20} size={1} />
        <Controls showInteractive={false} style={{ bottom: 12, left: 12 }} />
      </ReactFlow>
    </div>
  );
}

// ── Public component ───────────────────────────────────────────────────────
export function DependencyGraph({ resourceType, resource }) {
  const activeContext = useStore?.((s) => s.activeContext) ?? null;
  const namespace = resource?.metadata?.namespace;

  const opts = { namespace, context: activeContext };

  const { data: servicesData   } = useK8sResource("core",                        "services",                   opts);
  const { data: ingressesData  } = useK8sResource("networking",                  "ingresses",                  opts);
  const { data: podsData       } = useK8sResource("core",                        "pods",                       opts);
  const { data: replicasetsData} = useK8sResource("apps",                        "replicasets",                opts);
  const { data: hpasData       } = useK8sResource("autoscaling",                 "horizontalpodautoscalers",   opts);
  const { data: configmapsData } = useK8sResource("core",                        "configmaps",                 opts);
  const { data: secretsData    } = useK8sResource("core",                        "secrets",                    opts);

  const allData = React.useMemo(() => ({
    services:    servicesData?.items    ?? [],
    ingresses:   ingressesData?.items   ?? [],
    pods:        podsData?.items        ?? [],
    replicasets: replicasetsData?.items ?? [],
    hpas:        hpasData?.items        ?? [],
    configmaps:  configmapsData?.items  ?? [],
    secrets:     secretsData?.items     ?? [],
  }), [servicesData, ingressesData, podsData, replicasetsData, hpasData, configmapsData, secretsData]);

  if (!resource) return null;

  return (
    <ReactFlowProvider>
      <DepGraphInner resourceType={resourceType} resource={resource} allData={allData} />
    </ReactFlowProvider>
  );
}
