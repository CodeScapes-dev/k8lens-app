import { KIND_COLOR, EDGE_STYLE } from "./kind-config";

// Derives a simple health status string from a raw K8s object.
function deriveStatus(kind, obj) {
  const status = obj?.status ?? {};
  const spec = obj?.spec ?? {};

  switch (kind) {
    case "Pod":
      return status.phase ?? "Unknown";
    case "Node": {
      const ready = (status.conditions ?? []).find((c) => c.type === "Ready");
      return ready?.status === "True" ? "Ready" : "NotReady";
    }
    case "Deployment":
    case "StatefulSet":
    case "DaemonSet": {
      const desired = spec.replicas ?? 1;
      const avail = status.availableReplicas ?? status.numberAvailable ?? 0;
      return avail >= desired ? "Healthy" : "Degraded";
    }
    case "ReplicaSet": {
      const desired = spec.replicas ?? 0;
      const ready = status.readyReplicas ?? 0;
      return desired === 0 ? "Idle" : ready >= desired ? "Healthy" : "Degraded";
    }
    case "Job": {
      if (status.completionTime) return "Completed";
      if (status.failed > 0) return "Failed";
      return "Running";
    }
    case "CronJob":
      return "Scheduled";
    case "Service":
      return "Active";
    case "Ingress":
      return "Active";
    case "PersistentVolumeClaim":
      return status.phase ?? "Unknown";
    case "PersistentVolume":
      return status.phase ?? "Unknown";
    default:
      return "Available";
  }
}

function makeNodeId(kind, namespace, name) {
  return namespace ? `${kind}-${namespace}-${name}` : `${kind}-${name}`;
}

function nodeUi(kind) {
  return {
    icon: kind.toLowerCase(),
    color: KIND_COLOR[kind] ?? "#94a3b8",
    width: 180,
    height: 72,
    collapsed: false,
  };
}

// Checks if label selector matches a pod's labels.
function selectorMatches(selector, podLabels) {
  if (!selector || Object.keys(selector).length === 0) return false;
  return Object.entries(selector).every(([k, v]) => podLabels[k] === v);
}

/**
 * Converts raw Kubernetes API objects into a normalized topology graph.
 *
 * @param {object} rawData - keyed collections of raw K8s objects
 * @param {object} options
 * @param {string} options.clusterName
 * @param {string} options.clusterId
 * @param {boolean} options.includeClusterScoped
 * @param {string|null} options.namespaceFilter  - only include this namespace (null = all)
 * @returns {{ version, cluster, groups, nodes, edges, view }}
 */
export function buildTopologyGraph(rawData, options = {}) {
  const {
    clusterName = "cluster",
    clusterId = "cluster-1",
    includeClusterScoped = true,
    namespaceFilter = null,
  } = options;

  const groups = [];
  const nodes = [];
  const edges = [];
  const edgeSet = new Set(); // dedup edge ids

  const addEdge = (source, target, type, label) => {
    if (!source || !target || source === target) return;
    const id = `e-${type}-${source}-${target}`;
    if (edgeSet.has(id)) return;
    edgeSet.add(id);
    const ui = EDGE_STYLE[type] ?? EDGE_STYLE.references;
    edges.push({ id, source, target, type, label, ui });
  };

  // --- Groups ---
  if (includeClusterScoped) {
    groups.push({ id: "group-cluster-scoped", type: "cluster-scope", label: "Cluster Scoped Resources" });
  }

  const namespaceNames = (rawData.namespaces ?? []).map((ns) => ns?.metadata?.name).filter(Boolean);
  const filteredNs = namespaceFilter ? namespaceNames.filter((n) => n === namespaceFilter) : namespaceNames;

  filteredNs.forEach((ns) => {
    groups.push({ id: `ns-${ns}`, type: "namespace", label: ns, namespace: ns });
  });

  // --- Helper: add a resource node ---
  const nodeMap = new Map(); // id → node (for edge resolution)

  const addNode = (kind, obj, groupId) => {
    const meta = obj?.metadata ?? {};
    const spec = obj?.spec ?? {};
    const status = obj?.status ?? {};
    const name = meta.name;
    if (!name) return null;

    const ns = meta.namespace ?? null;
    const id = makeNodeId(kind, ns, name);

    const node = {
      id,
      kind,
      name,
      namespace: ns,
      scope: ns ? "namespaced" : "cluster",
      groupId,
      status: deriveStatus(kind, obj),
      ready: true,
      replicas: spec.replicas ?? status.readyReplicas ?? null,
      labels: meta.labels ?? {},
      ownerRefs: (meta.ownerReferences ?? []).map((r) => ({
        kind: r.kind,
        name: r.name,
        uid: r.uid,
      })),
      ui: nodeUi(kind),
    };
    nodes.push(node);
    nodeMap.set(id, node);
    return id;
  };

  // --- Namespaced workloads ---
  const nsSet = new Set(filteredNs);

  const shouldIncludeNs = (ns) => !namespaceFilter || ns === namespaceFilter;

  (rawData.deployments ?? []).forEach((obj) => {
    const ns = obj?.metadata?.namespace;
    if (!shouldIncludeNs(ns)) return;
    addNode("Deployment", obj, `ns-${ns}`);
  });

  (rawData.replicasets ?? []).forEach((obj) => {
    const ns = obj?.metadata?.namespace;
    if (!shouldIncludeNs(ns)) return;
    addNode("ReplicaSet", obj, `ns-${ns}`);
  });

  (rawData.statefulsets ?? []).forEach((obj) => {
    const ns = obj?.metadata?.namespace;
    if (!shouldIncludeNs(ns)) return;
    addNode("StatefulSet", obj, `ns-${ns}`);
  });

  (rawData.daemonsets ?? []).forEach((obj) => {
    const ns = obj?.metadata?.namespace;
    if (!shouldIncludeNs(ns)) return;
    addNode("DaemonSet", obj, `ns-${ns}`);
  });

  (rawData.jobs ?? []).forEach((obj) => {
    const ns = obj?.metadata?.namespace;
    if (!shouldIncludeNs(ns)) return;
    addNode("Job", obj, `ns-${ns}`);
  });

  (rawData.cronjobs ?? []).forEach((obj) => {
    const ns = obj?.metadata?.namespace;
    if (!shouldIncludeNs(ns)) return;
    addNode("CronJob", obj, `ns-${ns}`);
  });

  (rawData.pods ?? []).forEach((obj) => {
    const ns = obj?.metadata?.namespace;
    if (!shouldIncludeNs(ns)) return;
    addNode("Pod", obj, `ns-${ns}`);
  });

  (rawData.services ?? []).forEach((obj) => {
    const ns = obj?.metadata?.namespace;
    if (!shouldIncludeNs(ns)) return;
    addNode("Service", obj, `ns-${ns}`);
  });

  (rawData.ingresses ?? []).forEach((obj) => {
    const ns = obj?.metadata?.namespace;
    if (!shouldIncludeNs(ns)) return;
    addNode("Ingress", obj, `ns-${ns}`);
  });

  (rawData.configmaps ?? []).forEach((obj) => {
    const ns = obj?.metadata?.namespace;
    if (!shouldIncludeNs(ns)) return;
    // Skip system configmaps
    if (obj?.metadata?.name === "kube-root-ca.crt") return;
    addNode("ConfigMap", obj, `ns-${ns}`);
  });

  (rawData.secrets ?? []).forEach((obj) => {
    const ns = obj?.metadata?.namespace;
    if (!shouldIncludeNs(ns)) return;
    // Skip system token secrets
    const type = obj?.type ?? "";
    if (type.startsWith("kubernetes.io/service-account-token")) return;
    addNode("Secret", obj, `ns-${ns}`);
  });

  (rawData.pvcs ?? []).forEach((obj) => {
    const ns = obj?.metadata?.namespace;
    if (!shouldIncludeNs(ns)) return;
    addNode("PersistentVolumeClaim", obj, `ns-${ns}`);
  });

  (rawData.hpas ?? []).forEach((obj) => {
    const ns = obj?.metadata?.namespace;
    if (!shouldIncludeNs(ns)) return;
    addNode("HorizontalPodAutoscaler", obj, `ns-${ns}`);
  });

  // --- Cluster-scoped resources ---
  if (includeClusterScoped) {
    (rawData.nodes ?? []).forEach((obj) => addNode("Node", obj, "group-cluster-scoped"));
    (rawData.pvs ?? []).forEach((obj) => addNode("PersistentVolume", obj, "group-cluster-scoped"));
    (rawData.storageclasses ?? []).forEach((obj) => addNode("StorageClass", obj, "group-cluster-scoped"));
    (rawData.clusterroles ?? []).forEach((obj) => addNode("ClusterRole", obj, "group-cluster-scoped"));
    (rawData.clusterrolebindings ?? []).forEach((obj) => addNode("ClusterRoleBinding", obj, "group-cluster-scoped"));
    (rawData.ingressclasses ?? []).forEach((obj) => addNode("IngressClass", obj, "group-cluster-scoped"));
  }

  // --- Edges ---

  // ownerRef edges (Pod/RS → parent)
  const allWorkloads = [
    ...(rawData.pods ?? []),
    ...(rawData.replicasets ?? []),
    ...(rawData.jobs ?? []),
  ];
  allWorkloads.forEach((obj) => {
    const ns = obj?.metadata?.namespace;
    const name = obj?.metadata?.name;
    const kind = obj?.kind ?? (rawData.pods?.includes(obj) ? "Pod" : rawData.replicasets?.includes(obj) ? "ReplicaSet" : "Job");
    if (!shouldIncludeNs(ns)) return;
    (obj?.metadata?.ownerReferences ?? []).forEach((ref) => {
      const srcId = makeNodeId(ref.kind, ns, ref.name);
      const tgtId = makeNodeId(kind, ns, name);
      if (nodeMap.has(srcId) && nodeMap.has(tgtId)) {
        addEdge(srcId, tgtId, "owns", "ownerRef");
      }
    });
  });

  // Service → Pod (selects)
  (rawData.services ?? []).forEach((svc) => {
    const ns = svc?.metadata?.namespace;
    if (!shouldIncludeNs(ns)) return;
    const selector = svc?.spec?.selector ?? {};
    if (Object.keys(selector).length === 0) return;
    const svcId = makeNodeId("Service", ns, svc?.metadata?.name);
    (rawData.pods ?? []).filter((p) => p?.metadata?.namespace === ns).forEach((pod) => {
      if (selectorMatches(selector, pod?.metadata?.labels ?? {})) {
        const podId = makeNodeId("Pod", ns, pod?.metadata?.name);
        if (nodeMap.has(svcId) && nodeMap.has(podId)) {
          addEdge(svcId, podId, "selects", "selector match");
        }
      }
    });
  });

  // Ingress → Service (routes_to)
  (rawData.ingresses ?? []).forEach((ing) => {
    const ns = ing?.metadata?.namespace;
    if (!shouldIncludeNs(ns)) return;
    const ingId = makeNodeId("Ingress", ns, ing?.metadata?.name);
    (ing?.spec?.rules ?? []).forEach((rule) => {
      (rule?.http?.paths ?? []).forEach((path) => {
        const svcName = path?.backend?.service?.name;
        if (svcName) {
          const svcId = makeNodeId("Service", ns, svcName);
          if (nodeMap.has(ingId) && nodeMap.has(svcId)) {
            addEdge(ingId, svcId, "routes_to", "HTTP route");
          }
        }
      });
    });
  });

  // Deployment/SS/DS → ConfigMap, Secret, PVC (references/mounts)
  const workloadKinds = [
    { list: rawData.deployments ?? [], kind: "Deployment" },
    { list: rawData.statefulsets ?? [], kind: "StatefulSet" },
    { list: rawData.daemonsets ?? [], kind: "DaemonSet" },
  ];
  workloadKinds.forEach(({ list, kind }) => {
    list.forEach((obj) => {
      const ns = obj?.metadata?.namespace;
      if (!shouldIncludeNs(ns)) return;
      const wId = makeNodeId(kind, ns, obj?.metadata?.name);
      const podSpec = obj?.spec?.template?.spec ?? {};

      (podSpec.volumes ?? []).forEach((v) => {
        if (v.configMap?.name) {
          const cmId = makeNodeId("ConfigMap", ns, v.configMap.name);
          if (nodeMap.has(wId) && nodeMap.has(cmId)) addEdge(wId, cmId, "references", "volume mount");
        }
        if (v.secret?.secretName) {
          const secId = makeNodeId("Secret", ns, v.secret.secretName);
          if (nodeMap.has(wId) && nodeMap.has(secId)) addEdge(wId, secId, "references", "secret mount");
        }
        if (v.persistentVolumeClaim?.claimName) {
          const pvcId = makeNodeId("PersistentVolumeClaim", ns, v.persistentVolumeClaim.claimName);
          if (nodeMap.has(wId) && nodeMap.has(pvcId)) addEdge(wId, pvcId, "mounts", "PVC");
        }
      });

      const containers = [...(podSpec.initContainers ?? []), ...(podSpec.containers ?? [])];
      containers.forEach((c) => {
        (c.envFrom ?? []).forEach((e) => {
          if (e.configMapRef?.name) {
            const cmId = makeNodeId("ConfigMap", ns, e.configMapRef.name);
            if (nodeMap.has(wId) && nodeMap.has(cmId)) addEdge(wId, cmId, "references", "envFrom");
          }
          if (e.secretRef?.name) {
            const secId = makeNodeId("Secret", ns, e.secretRef.name);
            if (nodeMap.has(wId) && nodeMap.has(secId)) addEdge(wId, secId, "references", "envFrom");
          }
        });
        (c.env ?? []).forEach((e) => {
          if (e.valueFrom?.configMapKeyRef?.name) {
            const cmId = makeNodeId("ConfigMap", ns, e.valueFrom.configMapKeyRef.name);
            if (nodeMap.has(wId) && nodeMap.has(cmId)) addEdge(wId, cmId, "references", "env ref");
          }
          if (e.valueFrom?.secretKeyRef?.name) {
            const secId = makeNodeId("Secret", ns, e.valueFrom.secretKeyRef.name);
            if (nodeMap.has(wId) && nodeMap.has(secId)) addEdge(wId, secId, "references", "env ref");
          }
        });
      });
    });
  });

  // PVC → PV (storage)
  (rawData.pvcs ?? []).forEach((pvc) => {
    const ns = pvc?.metadata?.namespace;
    if (!shouldIncludeNs(ns)) return;
    const volName = pvc?.spec?.volumeName;
    if (volName && includeClusterScoped) {
      const pvcId = makeNodeId("PersistentVolumeClaim", ns, pvc?.metadata?.name);
      const pvId = makeNodeId("PersistentVolume", null, volName);
      if (nodeMap.has(pvcId) && nodeMap.has(pvId)) addEdge(pvcId, pvId, "storage", "bound to");
    }
  });

  // Pod → Node (scheduled_on)
  if (includeClusterScoped) {
    (rawData.pods ?? []).forEach((pod) => {
      const ns = pod?.metadata?.namespace;
      if (!shouldIncludeNs(ns)) return;
      const nodeName = pod?.spec?.nodeName;
      if (nodeName) {
        const podId = makeNodeId("Pod", ns, pod?.metadata?.name);
        const nodeId = makeNodeId("Node", null, nodeName);
        if (nodeMap.has(podId) && nodeMap.has(nodeId)) addEdge(podId, nodeId, "scheduled_on", "scheduled on");
      }
    });
  }

  // HPA → Deployment/StatefulSet (scales)
  (rawData.hpas ?? []).forEach((hpa) => {
    const ns = hpa?.metadata?.namespace;
    if (!shouldIncludeNs(ns)) return;
    const ref = hpa?.spec?.scaleTargetRef;
    if (ref?.name && ref?.kind) {
      const hpaId = makeNodeId("HorizontalPodAutoscaler", ns, hpa?.metadata?.name);
      const targetId = makeNodeId(ref.kind, ns, ref.name);
      if (nodeMap.has(hpaId) && nodeMap.has(targetId)) addEdge(hpaId, targetId, "scales", "scales");
    }
  });

  // Remove namespace groups that have no nodes
  const usedGroups = new Set(nodes.map((n) => n.groupId));
  const filteredGroups = groups.filter((g) => usedGroups.has(g.id));

  return {
    version: "1.0",
    cluster: { id: clusterId, name: clusterName, generatedAt: new Date().toISOString() },
    groups: filteredGroups,
    nodes,
    edges,
    view: {
      defaultLayout: "dagre",
      direction: "LR",
      collapseByDefault: false,
      showClusterScopedLane: includeClusterScoped,
      grouping: "namespace-first",
      filters: { kind: [], namespace: [], status: [] },
    },
  };
}
