"use client";

import React from "react";
import { useRouter } from "next/navigation";
import {
  ReactFlow, ReactFlowProvider, Background, Controls,
  useNodesState, useEdgesState, useReactFlow,
  Handle, Position, BaseEdge, getSmoothStepPath,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import dagre from "dagre";
import { KIND_COLOR, kindRoute } from "@/lib/k8s/kind-config";
import { calculateAge } from "@/lib/k8s/utils";
import { parseAllocCpu, parseAllocMem, fmtCores, fmtGB } from "@/lib/k8s/metrics-utils";

const SANS  = "var(--font-sans), ui-sans-serif, system-ui, sans-serif";
const MONO  = "var(--font-mono), ui-monospace, monospace";

const NODE_W  = 210;
const NS_W    = 150;
const NS_H    = 50;

// ── Helpers ────────────────────────────────────────────────────────────────

function Field({ label, value }) {
  if (!value && value !== 0) return null;
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: 8.5, fontFamily: SANS, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--kl-text-faint)", marginBottom: 1 }}>{label}</div>
      <div style={{ fontSize: 11, fontFamily: MONO, color: "var(--kl-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{value}</div>
    </div>
  );
}

function getExtraFields(r, kind) {
  const age = r.metadata?.creationTimestamp ? calculateAge(r.metadata.creationTimestamp) : null;
  const images = [
    ...(r.spec?.template?.spec?.containers ?? r.spec?.containers ?? []).map((c) => c.image?.split("/").pop() ?? c.image),
  ].slice(0, 2);
  const imageStr = images.length ? images.join(", ") : null;

  switch (kind) {
    case "Deployment":
    case "StatefulSet":
    case "ReplicaSet":
    case "ReplicationController": {
      const ready   = r.status?.readyReplicas ?? 0;
      const desired = r.spec?.replicas ?? 0;
      return [
        { label: "Ready", value: `${ready} / ${desired}` },
        { label: "Strategy", value: r.spec?.strategy?.type ?? null },
        { label: "Image", value: imageStr },
        { label: "Age", value: age },
      ];
    }
    case "DaemonSet": {
      const ready   = r.status?.numberReady ?? 0;
      const desired = r.status?.desiredNumberScheduled ?? 0;
      return [
        { label: "Ready", value: `${ready} / ${desired}` },
        { label: "Image", value: imageStr },
        { label: "Age", value: age },
      ];
    }
    case "Pod": {
      const containers = r.spec?.containers?.length ?? 0;
      return [
        { label: "Status", value: r.status?.phase },
        { label: "Node", value: r.spec?.nodeName },
        { label: "Containers", value: String(containers) },
        { label: "Age", value: age },
      ];
    }
    case "Job":
    case "CronJob": {
      const active    = r.status?.active ?? 0;
      const succeeded = r.status?.succeeded ?? 0;
      const schedule  = r.spec?.schedule ?? null;
      return [
        { label: "Active", value: String(active) },
        { label: "Succeeded", value: String(succeeded) },
        ...(schedule ? [{ label: "Schedule", value: schedule }] : []),
        { label: "Age", value: age },
      ];
    }
    case "Service": {
      const ports = (r.spec?.ports ?? []).map((p) => `${p.port}${p.protocol !== "TCP" ? `/${p.protocol}` : ""}`).join(", ");
      return [
        { label: "Type", value: r.spec?.type },
        { label: "Cluster IP", value: r.spec?.clusterIP !== "None" ? r.spec?.clusterIP : "Headless" },
        { label: "Ports", value: ports || null },
        { label: "Age", value: age },
      ];
    }
    case "Ingress": {
      const rules = (r.spec?.rules ?? []).map((r) => r.host).filter(Boolean).join(", ");
      return [
        { label: "Hosts", value: rules || "*" },
        { label: "Class", value: r.spec?.ingressClassName },
        { label: "Age", value: age },
      ];
    }
    case "ConfigMap":
    case "Secret": {
      const count = Object.keys(r.data ?? {}).length;
      return [
        { label: "Keys", value: String(count) },
        { label: "Age", value: age },
      ];
    }
    case "PersistentVolumeClaim": {
      return [
        { label: "Status", value: r.status?.phase },
        { label: "Storage", value: r.spec?.resources?.requests?.storage },
        { label: "Class", value: r.spec?.storageClassName },
        { label: "Age", value: age },
      ];
    }
    case "Node": {
      const ready    = r.status?.conditions?.find((c) => c.type === "Ready")?.status === "True";
      const rawCpu   = r.status?.allocatable?.cpu;
      const rawMem   = r.status?.allocatable?.memory;
      const cpu      = rawCpu  ? fmtCores(parseAllocCpu(rawCpu))  : null;
      const mem      = rawMem  ? fmtGB(parseAllocMem(rawMem))     : null;
      return [
        { label: "Status", value: ready ? "Ready" : "NotReady" },
        { label: "CPU", value: cpu },
        { label: "Memory", value: mem },
        { label: "Age", value: age },
      ];
    }
    case "ServiceAccount": {
      const secrets = r.secrets?.length ?? 0;
      return [
        { label: "Secrets", value: String(secrets) },
        { label: "Age", value: age },
      ];
    }
    case "Role":
    case "ClusterRole": {
      const rules = r.rules?.length ?? 0;
      return [
        { label: "Rules", value: String(rules) },
        { label: "Age", value: age },
      ];
    }
    case "HorizontalPodAutoscaler": {
      const minR = r.spec?.minReplicas ?? 1;
      const maxR = r.spec?.maxReplicas;
      const curr = r.status?.currentReplicas;
      return [
        { label: "Target", value: r.spec?.scaleTargetRef?.name },
        { label: "Min / Max", value: `${minR} / ${maxR}` },
        { label: "Current", value: curr != null ? String(curr) : null },
        { label: "Age", value: age },
      ];
    }
    default:
      return [{ label: "Age", value: age }];
  }
}

// ── Namespace node ─────────────────────────────────────────────────────────

function NsNode({ data }) {
  const color = KIND_COLOR.Namespace ?? "#334155";
  return (
    <div style={{
      background: `${color}10`,
      border: `1px solid ${color}40`,
      borderLeft: `3px solid ${color}`,
      borderRadius: 8,
      width: NS_W,
      height: NS_H,
      display: "flex",
      flexDirection: "column",
      justifyContent: "center",
      padding: "6px 11px",
      fontFamily: SANS,
    }}>
      <Handle type="source" position={Position.Bottom} style={{ background: color, width: 6, height: 6, bottom: -4 }} />
      <span style={{ fontSize: 8.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color, marginBottom: 3 }}>Namespace</span>
      <span style={{ fontSize: 12, fontWeight: 600, fontFamily: MONO, color: "var(--kl-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {data.name}
      </span>
    </div>
  );
}

// ── Resource node ──────────────────────────────────────────────────────────

function ResourceNode({ data, selected }) {
  const { kind, name, fields = [] } = data;
  const color = KIND_COLOR[kind] ?? "#94a3b8";
  const visibleFields = fields.filter((f) => f.value != null && f.value !== "");

  return (
    <div style={{
      background: "var(--kl-surface)",
      borderTop:    `1px solid ${selected ? color : "var(--kl-border)"}`,
      borderRight:  `1px solid ${selected ? color : "var(--kl-border)"}`,
      borderBottom: `1px solid ${selected ? color : "var(--kl-border)"}`,
      borderLeft:   `3px solid ${color}`,
      borderRadius: 8,
      padding: "9px 11px 9px 9px",
      width: NODE_W,
      cursor: "pointer",
      display: "flex",
      flexDirection: "column",
      gap: 7,
      fontFamily: SANS,
      transition: "background 0.12s",
    }}>
      <Handle type="target" position={Position.Top} style={{ background: color, width: 6, height: 6, top: -4 }} />

      {/* Header */}
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <span style={{ fontSize: 8.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color }}>{kind}</span>
        <span title={name} style={{ fontSize: 12.5, fontWeight: 600, fontFamily: MONO, color: "var(--kl-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {name}
        </span>
      </div>

      {/* Fields */}
      {visibleFields.length > 0 && (
        <>
          <div style={{ height: 1, background: "var(--kl-border)" }} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "5px 10px" }}>
            {visibleFields.map((f) => <Field key={f.label} label={f.label} value={f.value} />)}
          </div>
        </>
      )}
    </div>
  );
}

// ── Edge ───────────────────────────────────────────────────────────────────

function ListEdge({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, style, markerEnd }) {
  const [edgePath] = getSmoothStepPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition, borderRadius: 6 });
  return <BaseEdge id={id} path={edgePath} style={style} markerEnd={markerEnd} />;
}

const nodeTypes = { ns: NsNode, resource: ResourceNode };
const edgeTypes = { list: ListEdge };

// ── Layout ─────────────────────────────────────────────────────────────────

const FIELD_H  = 30;
const HEAD_H   = 52;
const DIV_H    = 9;

function estimateNodeH(fields) {
  const visible = fields.filter((f) => f.value != null && f.value !== "");
  if (visible.length === 0) return HEAD_H;
  const rows = Math.ceil(visible.length / 2);
  return HEAD_H + DIV_H + rows * FIELD_H;
}

function buildAndLayout(data, kind) {
  if (!data || data.length === 0) return { rfNodes: [], rfEdges: [] };

  const nsSet = new Set();
  data.forEach((r) => { if (r.metadata?.namespace) nsSet.add(r.metadata.namespace); });
  const namespaces = [...nsSet].sort();

  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: "TB", ranksep: 70, nodesep: 20, marginx: 32, marginy: 32 });

  const rawNodes = [];
  const rawEdges = [];

  namespaces.forEach((ns) => {
    const id = `ns__${ns}`;
    g.setNode(id, { width: NS_W, height: NS_H });
    rawNodes.push({ id, type: "ns", data: { name: ns } });
  });

  data.forEach((r, i) => {
    const name   = r.metadata?.name ?? `item-${i}`;
    const ns     = r.metadata?.namespace ?? null;
    const id     = `res__${ns ?? ""}__${name}`;
    const fields = getExtraFields(r, kind);
    const h      = estimateNodeH(fields);

    g.setNode(id, { width: NODE_W, height: h });
    rawNodes.push({ id, type: "resource", data: { kind, name, namespace: ns, fields, resource: r } });

    if (ns) {
      const nsId = `ns__${ns}`;
      g.setEdge(nsId, id);
      rawEdges.push({
        id: `e__${nsId}__${id}`,
        source: nsId, target: id, type: "list",
        style: { stroke: "var(--kl-border-strong)", strokeWidth: 1.2, opacity: 0.6 },
        markerEnd: { type: "arrowclosed", color: "var(--kl-border-strong)", width: 10, height: 10 },
      });
    }
  });

  dagre.layout(g);

  const rfNodes = rawNodes.map((n) => {
    const pos = g.node(n.id);
    const w = n.type === "ns" ? NS_W : NODE_W;
    const h = n.type === "ns" ? NS_H : estimateNodeH(n.data.fields ?? []);
    return { ...n, position: { x: pos.x - w / 2, y: pos.y - h / 2 }, width: w, height: h };
  });

  return { rfNodes, rfEdges: rawEdges };
}

// ── Inner ──────────────────────────────────────────────────────────────────

function GraphViewInner({ data, resourceKind, loading }) {
  const router = useRouter();
  const { fitView } = useReactFlow();

  const { rfNodes, rfEdges } = React.useMemo(
    () => buildAndLayout(data, resourceKind),
    [data, resourceKind],
  );

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  React.useEffect(() => {
    setNodes(rfNodes);
    setEdges(rfEdges);
    if (rfNodes.length > 0) setTimeout(() => fitView({ padding: 0.12, duration: 300 }), 60);
  }, [rfNodes, rfEdges, setNodes, setEdges, fitView]);

  const handleNodeClick = React.useCallback((_, node) => {
    if (node.type !== "resource") return;
    const { kind, name, namespace } = node.data;
    const route = kindRoute(kind, namespace, name);
    if (route) router.push(route);
  }, [router]);

  if (loading) {
    return (
      <div style={{ height: 500, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--kl-text-muted)", fontSize: 13, fontFamily: SANS, border: "1px solid var(--kl-border)", borderRadius: 12 }}>
        Loading…
      </div>
    );
  }

  if (rfNodes.length === 0) {
    return (
      <div style={{ height: 500, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--kl-text-muted)", fontSize: 13, fontFamily: SANS, border: "1px solid var(--kl-border)", borderRadius: 12 }}>
        No resources found
      </div>
    );
  }

  return (
    <div style={{ height: 500, borderRadius: 12, overflow: "hidden", border: "1px solid var(--kl-border)" }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodeClick={handleNodeClick}
        fitView
        fitViewOptions={{ padding: 0.12 }}
        minZoom={0.15}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
      >
        <Background color="var(--kl-border)" gap={20} size={1} />
        <Controls showInteractive={false} style={{ bottom: 12, left: 12 }} />
      </ReactFlow>
    </div>
  );
}

// ── Public ─────────────────────────────────────────────────────────────────

export function GraphView({ data, resourceKind, loading }) {
  return (
    <ReactFlowProvider>
      <GraphViewInner data={data} resourceKind={resourceKind} loading={loading} />
    </ReactFlowProvider>
  );
}
