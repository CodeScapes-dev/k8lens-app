"use client";

import React from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  ReactFlowProvider,
  useNodesState,
  useEdgesState,
  useReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { useTopology } from "@/hooks/use-topology";
import { useDagreLayout } from "./use-dagre-layout";
import { ResourceNode } from "./nodes/ResourceNode";
import { NamespaceGroupNode, ClusterGroupNode } from "./nodes/NamespaceGroupNode";
import { TopologyEdge } from "./edges/TopologyEdge";
import { TopologyToolbar, ALL_KINDS } from "./TopologyToolbar";
import { NodeDetailDrawer } from "./NodeDetailDrawer";
import { KIND_COLOR } from "@/lib/k8s/kind-config";

const SYSTEM_NAMESPACES = new Set([
  "kube-system",
  "kube-public",
  "kube-node-lease",
  "local-path-storage",
  "cert-manager",
  "ingress-nginx",
]);

const nodeTypes = {
  resource: ResourceNode,
  namespaceGroup: NamespaceGroupNode,
  clusterGroup: ClusterGroupNode,
};

const edgeTypes = {
  topology: TopologyEdge,
};

// Build node id the same way topology-transformer does.
function nodeId(kind, namespace, name) {
  return namespace ? `${kind}-${namespace}-${name}` : `${kind}-${name}`;
}

/**
 * Filters the raw topology graph data by:
 *  1. Single namespace selection
 *  2. Selected resource kinds (plus their parent owners for context)
 *  3. Connected cluster-scoped resources only (when enabled)
 *  4. Text search
 */
function filterGraphData(rawData, selectedNamespace, selectedKinds, showConnectedCluster, search) {
  if (!rawData) return null;

  // 1. Namespace group IDs that are active
  const activeNsIds = new Set(
    (rawData.groups ?? [])
      .filter((g) => g.type !== "namespace" || !selectedNamespace || g.label === selectedNamespace)
      .map((g) => g.id)
  );

  // 2. All namespace-scoped nodes for the selected namespace
  const allNsNodes = rawData.nodes.filter(
    (n) => n.scope === "namespaced" && activeNsIds.has(n.groupId)
  );
  const allNsById = new Map(allNsNodes.map((n) => [n.id, n]));

  // 3. Kind filter — empty selectedKinds means show nothing (user deselected all)
  let visibleNsNodes;
  if (selectedKinds.size === 0) {
    visibleNsNodes = [];
  } else {
    const primary = allNsNodes.filter((n) => selectedKinds.has(n.kind));
    const primaryIds = new Set(primary.map((n) => n.id));

    // Auto-include direct owner (parent) resources for context so edges are meaningful.
    // E.g. if only Pods selected, pull in their owning ReplicaSets/Deployments.
    const parentIds = new Set();
    primary.forEach((n) => {
      (n.ownerRefs ?? []).forEach((ref) => {
        const oid = nodeId(ref.kind, n.namespace, ref.name);
        if (allNsById.has(oid) && !primaryIds.has(oid)) parentIds.add(oid);
      });
    });
    const parents = [...parentIds].map((id) => allNsById.get(id)).filter(Boolean);

    visibleNsNodes = [...primary, ...parents];
  }

  const nsNodeIds = new Set(visibleNsNodes.map((n) => n.id));

  // 4. Cluster-scoped: only show those connected to a visible namespace node
  let clusterNodes = [];
  if (showConnectedCluster) {
    const reachable = new Set();
    rawData.edges.forEach((e) => {
      if (nsNodeIds.has(e.source)) reachable.add(e.target);
      if (nsNodeIds.has(e.target)) reachable.add(e.source);
    });
    clusterNodes = rawData.nodes.filter(
      (n) => n.scope === "cluster" && reachable.has(n.id)
    );
  }

  // 5. Combine + text search
  let filteredNodes = [...visibleNsNodes, ...clusterNodes];
  if (search) {
    const q = search.toLowerCase();
    filteredNodes = filteredNodes.filter(
      (n) =>
        n.name?.toLowerCase().includes(q) ||
        n.kind?.toLowerCase().includes(q) ||
        n.namespace?.toLowerCase().includes(q)
    );
  }

  const filteredIds = new Set(filteredNodes.map((n) => n.id));
  const filteredEdges = rawData.edges.filter(
    (e) => filteredIds.has(e.source) && filteredIds.has(e.target)
  );
  const usedGroupIds = new Set(filteredNodes.map((n) => n.groupId));
  const filteredGroups = rawData.groups.filter((g) => usedGroupIds.has(g.id));

  return { ...rawData, groups: filteredGroups, nodes: filteredNodes, edges: filteredEdges };
}

function TopologyGraphInner() {
  const { data, loading, error, refresh } = useTopology();
  const { fitView } = useReactFlow();

  const [search, setSearch] = React.useState("");
  const [selectedNamespace, setSelectedNamespace] = React.useState(null);
  const [selectedKinds, setSelectedKinds] = React.useState(new Set(ALL_KINDS));
  const [showConnectedCluster, setShowConnectedCluster] = React.useState(false);
  const [initialised, setInitialised] = React.useState(false);
  const [selectedNode, setSelectedNode] = React.useState(null);
  const [drawerOpen, setDrawerOpen] = React.useState(false);

  // Default to first non-system namespace on load
  React.useEffect(() => {
    if (!data || initialised) return;
    const nsLabels = (data.groups ?? [])
      .filter((g) => g.type === "namespace")
      .map((g) => g.label);
    const userNs = nsLabels.filter((n) => !SYSTEM_NAMESPACES.has(n));
    React.startTransition(() => {
      setSelectedNamespace((userNs[0] ?? nsLabels[0]) ?? null);
      setInitialised(true);
    });
  }, [data, initialised]);

  const allNamespaces = React.useMemo(
    () => (data?.groups ?? []).filter((g) => g.type === "namespace").map((g) => g.label),
    [data]
  );

  const toggleKind = React.useCallback((kind) => {
    setSelectedKinds((prev) => {
      const next = new Set(prev);
      if (next.has(kind)) next.delete(kind);
      else next.add(kind);
      return next;
    });
  }, []);

  const selectAllKinds = React.useCallback(() => setSelectedKinds(new Set(ALL_KINDS)), []);
  const clearAllKinds = React.useCallback(() => setSelectedKinds(new Set()), []);

  const filteredData = React.useMemo(
    () => filterGraphData(data, selectedNamespace, selectedKinds, showConnectedCluster, search),
    [data, selectedNamespace, selectedKinds, showConnectedCluster, search]
  );

  const { rfNodes: layoutNodes, rfEdges: layoutEdges } = useDagreLayout(filteredData);

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  React.useEffect(() => {
    setNodes(layoutNodes);
    setEdges(layoutEdges);
    if (layoutNodes.length > 0) {
      setTimeout(() => fitView({ padding: 0.06, duration: 400 }), 80);
    }
  }, [layoutNodes, layoutEdges, setNodes, setEdges, fitView]);

  const handleNodeClick = React.useCallback((_, node) => {
    if (node.data?.node) {
      setSelectedNode(node.data.node);
      setDrawerOpen(true);
    }
  }, []);

  const visibleResourceCount = filteredData?.nodes?.length ?? 0;
  const visibleEdgeCount = filteredData?.edges?.length ?? 0;

  if (error) {
    return (
      <div style={{ padding: 40, textAlign: "center" }}>
        <div style={{ fontSize: 14, color: "var(--kl-text-muted)", marginBottom: 8 }}>
          Failed to load topology
        </div>
        <div style={{ fontSize: 12, fontFamily: "monospace", color: "#ef4444" }}>{error}</div>
      </div>
    );
  }

  return (
    <div style={{ width: "100%", height: "calc(100vh - 60px)", display: "flex", flexDirection: "column", position: "relative" }}>
      <div style={{ flexShrink: 0, borderBottom: "1px solid var(--kl-border)" }}>
        <TopologyToolbar
          search={search}
          onSearch={setSearch}
          namespaces={allNamespaces}
          selectedNamespace={selectedNamespace}
          onSelectNamespace={setSelectedNamespace}
          selectedKinds={selectedKinds}
          onToggleKind={toggleKind}
          onSelectAllKinds={selectAllKinds}
          onClearAllKinds={clearAllKinds}
          showConnectedCluster={showConnectedCluster}
          onToggleConnectedCluster={() => setShowConnectedCluster((s) => !s)}
          nodeCount={visibleResourceCount}
          edgeCount={visibleEdgeCount}
          onRefresh={refresh}
          loading={loading}
        />
      </div>

      <div style={{ flex: 1, position: "relative" }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onNodeClick={handleNodeClick}
          minZoom={0.04}
          maxZoom={2}
          proOptions={{ hideAttribution: true }}
        >
          <Background color="var(--kl-border)" gap={20} size={1} />
          <Controls style={{ bottom: 16, left: 16 }} />
          <MiniMap
            pannable
            zoomable
            style={{
              bottom: 16,
              right: 16,
              background: "var(--kl-surface-2)",
              border: "1px solid var(--kl-border)",
              borderRadius: 8,
            }}
            nodeColor={(n) => {
              const nd = n.data?.node;
              if (!nd) return "var(--kl-border)";
              return KIND_COLOR[nd.kind] ?? "#64748b";
            }}
            maskColor="rgba(0,0,0,0.08)"
          />
        </ReactFlow>

        {loading && nodes.length === 0 && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "var(--kl-surface)",
              zIndex: 20,
              fontSize: 13,
              color: "var(--kl-text-muted)",
            }}
          >
            Building topology graph…
          </div>
        )}

        {!loading && visibleResourceCount === 0 && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
              pointerEvents: "none",
              zIndex: 10,
            }}
          >
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" style={{ opacity: 0.25 }}>
              <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.8" />
              <path d="M16.5 16.5 L21 21" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              <path d="M8 11 h6 M11 8 v6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
            </svg>
            <div style={{ fontSize: 13, color: "var(--kl-text-muted)", fontWeight: 500 }}>
              {selectedKinds.size === 0
                ? "No resource types selected"
                : `No resources in ${selectedNamespace ?? "this namespace"} for the current filter`}
            </div>
            <div style={{ fontSize: 11, color: "var(--kl-text-muted)", opacity: 0.7 }}>
              {selectedKinds.size === 0
                ? 'Use the "show:" dropdown to select resource types'
                : "Try a different namespace or add more resource types"}
            </div>
          </div>
        )}
      </div>

      <NodeDetailDrawer
        node={selectedNode}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      />
    </div>
  );
}

export function TopologyGraph() {
  return (
    <ReactFlowProvider>
      <TopologyGraphInner />
    </ReactFlowProvider>
  );
}
