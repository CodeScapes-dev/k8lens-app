import React from "react";
import dagre from "dagre";

const NODE_W = 180;
const NODE_H = 72;
const GROUP_PAD = 48;
const GROUP_HEADER = 40;
const GROUP_GAP = 32;
const CLUSTER_ROW_GAP = 12;

/**
 * Lays out the already-filtered topology graph data.
 * Cluster-scoped resources → horizontal row at top.
 * Namespace groups → TB dagre per group, arranged side-by-side below.
 *
 * Group nodes use React Flow's `parentId` so resource nodes are proper children
 * of their group. This ensures edges render above the group background.
 */
export function useDagreLayout(filteredData) {
  return React.useMemo(() => {
    if (!filteredData) return { rfNodes: [], rfEdges: [] };

    const { groups = [], nodes = [], edges = [] } = filteredData;

    const rfNodes = [];
    const rfEdges = [];

    const clusterGroup = groups.find((g) => g.type === "cluster-scope");
    const nsGroups = groups.filter((g) => g.type === "namespace");

    // --- Cluster-scoped: horizontal row ---
    const clusterNodes = nodes.filter((n) => n.scope === "cluster");
    let clusterGroupH = 0;
    let clusterGroupW = 0;

    if (clusterGroup && clusterNodes.length > 0) {
      clusterGroupW =
        clusterNodes.length * NODE_W +
        (clusterNodes.length - 1) * CLUSTER_ROW_GAP +
        GROUP_PAD * 2;
      clusterGroupH = NODE_H + GROUP_PAD + GROUP_HEADER;

      rfNodes.push({
        id: clusterGroup.id,
        type: "clusterGroup",
        position: { x: 0, y: 0 },
        data: { label: clusterGroup.label, group: clusterGroup },
        width: clusterGroupW,
        height: clusterGroupH,
        style: { width: clusterGroupW, height: clusterGroupH },
        draggable: false,
        selectable: false,
        zIndex: 0,
      });

      // Child nodes: positions relative to the cluster group
      clusterNodes.forEach((n, i) => {
        rfNodes.push({
          id: n.id,
          type: "resource",
          parentId: clusterGroup.id,
          position: {
            x: GROUP_PAD + i * (NODE_W + CLUSTER_ROW_GAP),
            y: GROUP_HEADER + GROUP_PAD / 2,
          },
          data: { node: n },
          width: NODE_W,
          height: NODE_H,
          zIndex: 2,
        });
      });
    }

    const nsOffsetY = clusterGroupH > 0 ? clusterGroupH + GROUP_GAP : 0;

    // --- Per-namespace: TB dagre ---
    let cursorX = 0;

    nsGroups.forEach((group) => {
      const groupNodes = nodes.filter((n) => n.groupId === group.id);
      if (groupNodes.length === 0) return;

      const g = new dagre.graphlib.Graph();
      g.setDefaultEdgeLabel(() => ({}));
      g.setGraph({
        rankdir: "TB",
        ranksep: 36,
        nodesep: 24,
        marginx: 0,
        marginy: 0,
      });

      groupNodes.forEach((n) => g.setNode(n.id, { width: NODE_W, height: NODE_H }));

      const groupNodeIds = new Set(groupNodes.map((n) => n.id));
      edges.forEach((e) => {
        if (
          groupNodeIds.has(e.source) &&
          groupNodeIds.has(e.target) &&
          e.type !== "selects" // skip service→pod for layout (too many lines)
        ) {
          g.setEdge(e.source, e.target);
        }
      });

      dagre.layout(g);

      const gGraph = g.graph();
      const innerW = gGraph.width ?? NODE_W;
      const innerH = gGraph.height ?? NODE_H;
      const groupW = innerW + GROUP_PAD * 2;
      const groupH = innerH + GROUP_PAD * 2 + GROUP_HEADER;

      rfNodes.push({
        id: group.id,
        type: "namespaceGroup",
        position: { x: cursorX, y: nsOffsetY },
        data: { label: group.label, group },
        width: groupW,
        height: groupH,
        style: { width: groupW, height: groupH },
        draggable: false,
        selectable: false,
        zIndex: 0,
      });

      // Child nodes: positions relative to the namespace group parent.
      // React Flow renders children above the parent background, making edges visible.
      groupNodes.forEach((n) => {
        const pos = g.node(n.id);
        rfNodes.push({
          id: n.id,
          type: "resource",
          parentId: group.id,
          position: {
            x: GROUP_PAD + pos.x - NODE_W / 2,
            y: GROUP_HEADER + GROUP_PAD + pos.y - NODE_H / 2,
          },
          data: { node: n },
          width: NODE_W,
          height: NODE_H,
          zIndex: 2,
        });
      });

      cursorX += groupW + GROUP_GAP;
    });

    // Center cluster group above namespace lane.
    // Only move the group itself — children move with it automatically.
    if (clusterGroup && clusterNodes.length > 0 && cursorX > 0) {
      const totalNsW = cursorX - GROUP_GAP;
      const clusterX = Math.max(0, (totalNsW - clusterGroupW) / 2);
      const clusterNode = rfNodes.find((n) => n.id === clusterGroup.id);
      if (clusterNode) clusterNode.position.x = clusterX;
    }

    // --- Edges ---
    edges.forEach((e) => {
      const srcNode = rfNodes.find((n) => n.id === e.source);
      const tgtNode = rfNodes.find((n) => n.id === e.target);
      if (!srcNode || !tgtNode) return;

      rfEdges.push({
        id: e.id,
        source: e.source,
        target: e.target,
        type: "topology",
        label: e.label,
        data: { edge: e },
        animated: e.ui?.animated ?? false,
        zIndex: 1,
        style: {
          stroke: e.ui?.color ?? "#94a3b8",
          strokeWidth: 1.5,
          strokeDasharray:
            e.ui?.style === "dashed"
              ? "6,3"
              : e.ui?.style === "dotted"
              ? "2,4"
              : undefined,
        },
        markerEnd: {
          type: "arrowclosed",
          color: e.ui?.color ?? "#94a3b8",
          width: 14,
          height: 14,
        },
      });
    });

    return { rfNodes, rfEdges };
  }, [filteredData]);
}
