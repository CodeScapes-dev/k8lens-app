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
      // ownerRef chain
      (meta.ownerReferences ?? []).forEach((o) => {
        const ownerKinds = ["ReplicaSet","Deployment","StatefulSet","DaemonSet","Job","CronJob","ReplicationController"];
        if (ownerKinds.includes(o.kind)) {
          const id = addNode(o.kind, o.name, ns, "owned by");
          addEdge(id, rootId, "owned by", KIND_COLOR[o.kind] ?? "#94a3b8");
        }
      });
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
      // env.valueFrom references
      const allContainers = [...(spec.initContainers ?? []), ...(spec.containers ?? [])];
      const seenEnv = new Set();
      allContainers.forEach((c) => {
        (c.envFrom ?? []).forEach((e) => {
          if (e.configMapRef?.name && !seenEnv.has("cm:" + e.configMapRef.name)) {
            seenEnv.add("cm:" + e.configMapRef.name);
            const id = addNode("ConfigMap", e.configMapRef.name, ns, "envFrom");
            addEdge(id, rootId, "envFrom", KIND_COLOR.ConfigMap);
          }
          if (e.secretRef?.name && !seenEnv.has("sec:" + e.secretRef.name)) {
            seenEnv.add("sec:" + e.secretRef.name);
            const id = addNode("Secret", e.secretRef.name, ns, "envFrom");
            addEdge(id, rootId, "envFrom", KIND_COLOR.Secret);
          }
        });
        (c.env ?? []).forEach((e) => {
          if (e.valueFrom?.configMapKeyRef?.name && !seenEnv.has("cm:" + e.valueFrom.configMapKeyRef.name)) {
            seenEnv.add("cm:" + e.valueFrom.configMapKeyRef.name);
            const id = addNode("ConfigMap", e.valueFrom.configMapKeyRef.name, ns, "env ref");
            addEdge(id, rootId, "env ref", KIND_COLOR.ConfigMap);
          }
          if (e.valueFrom?.secretKeyRef?.name && !seenEnv.has("sec:" + e.valueFrom.secretKeyRef.name)) {
            seenEnv.add("sec:" + e.valueFrom.secretKeyRef.name);
            const id = addNode("Secret", e.valueFrom.secretKeyRef.name, ns, "env ref");
            addEdge(id, rootId, "env ref", KIND_COLOR.Secret);
          }
        });
      });
      if (spec.serviceAccountName) {
        const id = addNode("ServiceAccount", spec.serviceAccountName, ns, "runs as");
        addEdge(id, rootId, "runs as", KIND_COLOR.ServiceAccount ?? "#f97316");
      }
      if (spec.nodeName) {
        const id = addNode("Node", spec.nodeName, null, "scheduled on");
        addEdge(id, rootId, "scheduled on", KIND_COLOR.Node);
      }
      // downstream: services selecting this pod
      const podLabels = meta.labels ?? {};
      (allData.services ?? []).forEach((svc) => {
        const sel = svc?.spec?.selector ?? {};
        if (Object.keys(sel).length > 0 && Object.entries(sel).every(([k, v]) => podLabels[k] === v)) {
          const id = addNode("Service", svc?.metadata?.name, svc?.metadata?.namespace ?? ns, null);
          addEdge(rootId, id, "selected by", KIND_COLOR.Service);
        }
      });
      break;
    }

    case "replicaset": {
      // upstream: owning Deployment
      (meta.ownerReferences ?? []).forEach((o) => {
        if (o.kind === "Deployment") {
          const id = addNode("Deployment", o.name, ns, "owned by");
          addEdge(id, rootId, "owned by", KIND_COLOR.Deployment);
        }
      });
      const tSpec2 = spec.template?.spec ?? {};
      if (tSpec2.serviceAccountName && tSpec2.serviceAccountName !== "default") {
        const id = addNode("ServiceAccount", tSpec2.serviceAccountName, ns, "runs as");
        addEdge(id, rootId, "runs as", KIND_COLOR.ServiceAccount);
      }
      (tSpec2.volumes ?? []).forEach((v) => {
        if (v.configMap?.name) { const id = addNode("ConfigMap", v.configMap.name, ns, "mounts"); addEdge(id, rootId, "mounts", KIND_COLOR.ConfigMap); }
        if (v.secret?.secretName) { const id = addNode("Secret", v.secret.secretName, ns, "mounts"); addEdge(id, rootId, "mounts", KIND_COLOR.Secret); }
      });
      // downstream: pods
      (allData.pods ?? []).forEach((pod) => {
        if ((pod?.metadata?.ownerReferences ?? []).some((o) => o.kind === "ReplicaSet" && o.name === rname)) {
          const id = addNode("Pod", pod?.metadata?.name, ns, null);
          addEdge(rootId, id, "owns", KIND_COLOR.Pod);
        }
      });
      break;
    }

    case "replicationcontroller": {
      const tSpec3 = spec.template?.spec ?? {};
      const tMeta3 = spec.template?.metadata ?? {};
      const podLabels3 = tMeta3.labels ?? {};
      if (tSpec3.serviceAccountName && tSpec3.serviceAccountName !== "default") {
        const id = addNode("ServiceAccount", tSpec3.serviceAccountName, ns, "runs as");
        addEdge(id, rootId, "runs as", KIND_COLOR.ServiceAccount);
      }
      (tSpec3.volumes ?? []).forEach((v) => {
        if (v.configMap?.name) { const id = addNode("ConfigMap", v.configMap.name, ns, "mounts"); addEdge(id, rootId, "mounts", KIND_COLOR.ConfigMap); }
        if (v.secret?.secretName) { const id = addNode("Secret", v.secret.secretName, ns, "mounts"); addEdge(id, rootId, "mounts", KIND_COLOR.Secret); }
      });
      (allData.pods ?? []).forEach((pod) => {
        if ((pod?.metadata?.ownerReferences ?? []).some((o) => o.kind === "ReplicationController" && o.name === rname)) {
          const id = addNode("Pod", pod?.metadata?.name, ns, null);
          addEdge(rootId, id, "owns", KIND_COLOR.Pod);
        }
      });
      (allData.services ?? []).forEach((svc) => {
        const sel = svc?.spec?.selector ?? {};
        if (Object.keys(sel).length > 0 && Object.entries(sel).every(([k, v]) => podLabels3[k] === v)) {
          const id = addNode("Service", svc?.metadata?.name, svc?.metadata?.namespace ?? ns, null);
          addEdge(rootId, id, "exposes", KIND_COLOR.Service);
        }
      });
      break;
    }

    case "job": {
      (meta.ownerReferences ?? []).forEach((o) => {
        if (o.kind === "CronJob") {
          const id = addNode("CronJob", o.name, ns, "owned by");
          addEdge(id, rootId, "owned by", KIND_COLOR.CronJob);
        }
      });
      const jobTSpec = spec.template?.spec ?? {};
      if (jobTSpec.serviceAccountName && jobTSpec.serviceAccountName !== "default") {
        const id = addNode("ServiceAccount", jobTSpec.serviceAccountName, ns, "runs as");
        addEdge(id, rootId, "runs as", KIND_COLOR.ServiceAccount);
      }
      (jobTSpec.volumes ?? []).forEach((v) => {
        if (v.configMap?.name) { const id = addNode("ConfigMap", v.configMap.name, ns, "mounts"); addEdge(id, rootId, "mounts", KIND_COLOR.ConfigMap); }
        if (v.secret?.secretName) { const id = addNode("Secret", v.secret.secretName, ns, "mounts"); addEdge(id, rootId, "mounts", KIND_COLOR.Secret); }
      });
      (allData.pods ?? []).forEach((pod) => {
        if ((pod?.metadata?.ownerReferences ?? []).some((o) => o.kind === "Job" && o.name === rname)) {
          const id = addNode("Pod", pod?.metadata?.name, ns, null);
          addEdge(rootId, id, "owns", KIND_COLOR.Pod);
        }
      });
      break;
    }

    case "cronjob": {
      const cjTSpec = spec.jobTemplate?.spec?.template?.spec ?? {};
      if (cjTSpec.serviceAccountName && cjTSpec.serviceAccountName !== "default") {
        const id = addNode("ServiceAccount", cjTSpec.serviceAccountName, ns, "runs as");
        addEdge(id, rootId, "runs as", KIND_COLOR.ServiceAccount);
      }
      (cjTSpec.volumes ?? []).forEach((v) => {
        if (v.configMap?.name) { const id = addNode("ConfigMap", v.configMap.name, ns, "mounts"); addEdge(id, rootId, "mounts", KIND_COLOR.ConfigMap); }
        if (v.secret?.secretName) { const id = addNode("Secret", v.secret.secretName, ns, "mounts"); addEdge(id, rootId, "mounts", KIND_COLOR.Secret); }
      });
      (allData.jobs ?? []).forEach((job) => {
        if ((job?.metadata?.ownerReferences ?? []).some((o) => o.kind === "CronJob" && o.name === rname)) {
          const jobId = addNode("Job", job?.metadata?.name, ns, null);
          addEdge(rootId, jobId, "spawns", KIND_COLOR.Job);
          (allData.pods ?? []).forEach((pod) => {
            if ((pod?.metadata?.ownerReferences ?? []).some((o) => o.kind === "Job" && o.name === job?.metadata?.name)) {
              const podId = addNode("Pod", pod?.metadata?.name, ns, null);
              addEdge(jobId, podId, "owns", KIND_COLOR.Pod);
            }
          });
        }
      });
      break;
    }

    case "configmap": {
      // downstream: pods, deployments, statefulsets, daemonsets, jobs that reference this configmap
      const cmName = rname;
      const refsConfigMap = (tSpec) => {
        const vols = (tSpec.volumes ?? []).some((v) => v.configMap?.name === cmName);
        const envs = [...(tSpec.initContainers ?? []), ...(tSpec.containers ?? [])].some((c) =>
          (c.envFrom ?? []).some((e) => e.configMapRef?.name === cmName) ||
          (c.env ?? []).some((e) => e.valueFrom?.configMapKeyRef?.name === cmName)
        );
        return vols || envs;
      };
      (allData.pods ?? []).forEach((pod) => {
        if (refsConfigMap(pod?.spec ?? {})) {
          const id = addNode("Pod", pod?.metadata?.name, pod?.metadata?.namespace ?? ns, "mounts");
          addEdge(rootId, id, "mounted by", KIND_COLOR.Pod);
        }
      });
      const workloads = [
        ...(allData.replicasets ?? []).map((r) => ({ kind: "ReplicaSet", r, tSpec: r?.spec?.template?.spec })),
        ...(allData.jobs ?? []).map((r) => ({ kind: "Job", r, tSpec: r?.spec?.template?.spec })),
      ];
      workloads.forEach(({ kind, r, tSpec }) => {
        if (tSpec && refsConfigMap(tSpec)) {
          const id = addNode(kind, r?.metadata?.name, r?.metadata?.namespace ?? ns, "references");
          addEdge(rootId, id, "referenced by", KIND_COLOR[kind]);
        }
      });
      break;
    }

    case "secret": {
      const secName = rname;
      const refsSecret = (tSpec) => {
        const vols = (tSpec.volumes ?? []).some((v) => v.secret?.secretName === secName);
        const envs = [...(tSpec.initContainers ?? []), ...(tSpec.containers ?? [])].some((c) =>
          (c.envFrom ?? []).some((e) => e.secretRef?.name === secName) ||
          (c.env ?? []).some((e) => e.valueFrom?.secretKeyRef?.name === secName)
        );
        return vols || envs;
      };
      (allData.pods ?? []).forEach((pod) => {
        if (refsSecret(pod?.spec ?? {})) {
          const id = addNode("Pod", pod?.metadata?.name, pod?.metadata?.namespace ?? ns, "mounts");
          addEdge(rootId, id, "mounted by", KIND_COLOR.Pod);
        }
      });
      const wls = [
        ...(allData.replicasets ?? []).map((r) => ({ kind: "ReplicaSet", r, tSpec: r?.spec?.template?.spec })),
        ...(allData.jobs ?? []).map((r) => ({ kind: "Job", r, tSpec: r?.spec?.template?.spec })),
      ];
      wls.forEach(({ kind, r, tSpec }) => {
        if (tSpec && refsSecret(tSpec)) {
          const id = addNode(kind, r?.metadata?.name, r?.metadata?.namespace ?? ns, "references");
          addEdge(rootId, id, "referenced by", KIND_COLOR[kind]);
        }
      });
      (allData.ingresses ?? []).forEach((ing) => {
        if ((ing?.spec?.tls ?? []).some((t) => t.secretName === secName)) {
          const id = addNode("Ingress", ing?.metadata?.name, ing?.metadata?.namespace ?? ns, "TLS cert");
          addEdge(rootId, id, "TLS cert for", KIND_COLOR.Ingress);
        }
      });
      break;
    }

    case "resourcequota":
    case "limitrange": {
      const nsNode = addNode("Namespace", ns, null, "applies to");
      addEdge(nsNode, rootId, "limits", KIND_COLOR.Namespace);
      break;
    }

    case "networkpolicy": {
      const nsNode2 = addNode("Namespace", ns, null, "applies in");
      addEdge(nsNode2, rootId, "governs", KIND_COLOR.Namespace);
      const podSelector = spec.podSelector?.matchLabels ?? {};
      if (Object.keys(podSelector).length > 0) {
        (allData.pods ?? []).forEach((pod) => {
          const l = pod?.metadata?.labels ?? {};
          if (Object.entries(podSelector).every(([k, v]) => l[k] === v)) {
            const id = addNode("Pod", pod?.metadata?.name, pod?.metadata?.namespace ?? ns, "governed");
            addEdge(id, rootId, "governs", KIND_COLOR.Pod);
          }
        });
      }
      break;
    }

    case "endpoints": {
      // upstream: the service with the same name
      const matchSvc = (allData.services ?? []).find((s) => s?.metadata?.name === rname && s?.metadata?.namespace === ns);
      if (matchSvc) {
        const id = addNode("Service", matchSvc.metadata.name, ns, "created for");
        addEdge(id, rootId, "created for", KIND_COLOR.Service);
      }
      // pods referenced in subsets
      (spec.subsets ?? []).forEach((sub) => {
        (sub.addresses ?? []).forEach((addr) => {
          const ref = addr.targetRef;
          if (ref?.kind === "Pod" && ref?.name) {
            const id = addNode("Pod", ref.name, ref.namespace ?? ns, "points to");
            addEdge(rootId, id, "points to", KIND_COLOR.Pod);
          }
        });
      });
      break;
    }

    case "ingressclass": {
      (allData.ingresses ?? []).forEach((ing) => {
        const cls = ing?.spec?.ingressClassName ?? ing?.metadata?.annotations?.["kubernetes.io/ingress.class"];
        if (cls === rname) {
          const id = addNode("Ingress", ing?.metadata?.name, ing?.metadata?.namespace ?? ns, "uses class");
          addEdge(rootId, id, "used by", KIND_COLOR.Ingress);
        }
      });
      break;
    }

    case "persistentvolume": {
      if (spec.storageClassName) {
        const id = addNode("StorageClass", spec.storageClassName, null, "provisioned by");
        addEdge(id, rootId, "provisioned by", KIND_COLOR.StorageClass);
      }
      const claimRef = spec.claimRef;
      if (claimRef?.name) {
        const id = addNode("PersistentVolumeClaim", claimRef.name, claimRef.namespace ?? ns, "bound to");
        addEdge(rootId, id, "bound to", KIND_COLOR.PersistentVolumeClaim);
      }
      break;
    }

    case "persistentvolumeclaim": {
      if (spec.volumeName) {
        const id = addNode("PersistentVolume", spec.volumeName, null, "bound to");
        addEdge(id, rootId, "bound to", KIND_COLOR.PersistentVolume);
      }
      if (spec.storageClassName) {
        const id = addNode("StorageClass", spec.storageClassName, null, "requested from");
        addEdge(id, rootId, "requested from", KIND_COLOR.StorageClass);
      }
      (allData.pods ?? []).forEach((pod) => {
        if ((pod?.spec?.volumes ?? []).some((v) => v.persistentVolumeClaim?.claimName === rname)) {
          const id = addNode("Pod", pod?.metadata?.name, pod?.metadata?.namespace ?? ns, "mounted by");
          addEdge(rootId, id, "mounted by", KIND_COLOR.Pod);
        }
      });
      break;
    }

    case "storageclass": {
      (allData.pvs ?? []).forEach((pv) => {
        if (pv?.spec?.storageClassName === rname) {
          const id = addNode("PersistentVolume", pv?.metadata?.name, null, "provisions");
          addEdge(rootId, id, "provisions", KIND_COLOR.PersistentVolume);
        }
      });
      (allData.pvcs ?? []).forEach((pvc) => {
        if (pvc?.spec?.storageClassName === rname) {
          const id = addNode("PersistentVolumeClaim", pvc?.metadata?.name, pvc?.metadata?.namespace ?? ns, "requested by");
          addEdge(rootId, id, "requested by", KIND_COLOR.PersistentVolumeClaim);
        }
      });
      break;
    }

    case "serviceaccount": {
      // upstream: secrets bound to this SA
      (resource?.secrets ?? []).forEach((s) => {
        if (s?.name) {
          const id = addNode("Secret", s.name, ns, "token secret");
          addEdge(id, rootId, "token secret", KIND_COLOR.Secret);
        }
      });
      // upstream: rolebindings / clusterrolebindings referencing this SA
      [...(allData.rolebindings ?? []), ...(allData.clusterrolebindings ?? [])].forEach((rb) => {
        const kind = rb?.kind ?? (rb?.metadata?.resourceVersion != null ? "RoleBinding" : "ClusterRoleBinding");
        if ((rb?.subjects ?? []).some((s) => s.kind === "ServiceAccount" && s.name === rname && (s.namespace === ns || !s.namespace))) {
          const rbKind = rb?.metadata?.namespace ? "RoleBinding" : "ClusterRoleBinding";
          const id = addNode(rbKind, rb?.metadata?.name, rb?.metadata?.namespace ?? null, "bound by");
          addEdge(id, rootId, "bound by", KIND_COLOR[rbKind]);
        }
      });
      // downstream: pods using this SA
      (allData.pods ?? []).forEach((pod) => {
        if (pod?.spec?.serviceAccountName === rname) {
          const id = addNode("Pod", pod?.metadata?.name, pod?.metadata?.namespace ?? ns, "uses");
          addEdge(rootId, id, "used by", KIND_COLOR.Pod);
        }
      });
      break;
    }

    case "role": {
      const nsNode3 = addNode("Namespace", ns, null, "lives in");
      addEdge(nsNode3, rootId, "contains", KIND_COLOR.Namespace);
      (allData.rolebindings ?? []).forEach((rb) => {
        if (rb?.roleRef?.name === rname && rb?.roleRef?.kind === "Role") {
          const id = addNode("RoleBinding", rb?.metadata?.name, rb?.metadata?.namespace ?? ns, "bound by");
          addEdge(rootId, id, "bound by", KIND_COLOR.RoleBinding);
        }
      });
      break;
    }

    case "rolebinding": {
      if (spec.roleRef?.name) {
        const kind = spec.roleRef.kind ?? "Role";
        const id = addNode(kind, spec.roleRef.name, kind === "ClusterRole" ? null : ns, "binds");
        addEdge(id, rootId, "binds", KIND_COLOR[kind]);
      }
      (spec.subjects ?? []).forEach((s) => {
        if (s.kind === "ServiceAccount" && s.name) {
          const id = addNode("ServiceAccount", s.name, s.namespace ?? ns, "subject");
          addEdge(id, rootId, "subject", KIND_COLOR.ServiceAccount);
        }
      });
      break;
    }

    case "clusterrole": {
      (allData.clusterrolebindings ?? []).forEach((crb) => {
        if (crb?.roleRef?.name === rname && crb?.roleRef?.kind === "ClusterRole") {
          const id = addNode("ClusterRoleBinding", crb?.metadata?.name, null, "bound by");
          addEdge(rootId, id, "bound by", KIND_COLOR.ClusterRoleBinding);
        }
      });
      (allData.rolebindings ?? []).forEach((rb) => {
        if (rb?.roleRef?.name === rname && rb?.roleRef?.kind === "ClusterRole") {
          const id = addNode("RoleBinding", rb?.metadata?.name, rb?.metadata?.namespace ?? ns, "bound by");
          addEdge(rootId, id, "bound by (ns)", KIND_COLOR.RoleBinding);
        }
      });
      break;
    }

    case "clusterrolebinding": {
      if (spec.roleRef?.name) {
        const id = addNode("ClusterRole", spec.roleRef.name, null, "binds");
        addEdge(id, rootId, "binds", KIND_COLOR.ClusterRole);
      }
      (spec.subjects ?? []).forEach((s) => {
        if (s.kind === "ServiceAccount" && s.name) {
          const id = addNode("ServiceAccount", s.name, s.namespace ?? null, "subject");
          addEdge(id, rootId, "subject", KIND_COLOR.ServiceAccount);
        }
      });
      break;
    }

    case "node": {
      const nodePods = (allData.allPods ?? []).filter((p) => p?.spec?.nodeName === rname);

      // collect owning workloads so we can group pods under them
      const ownerIds = new Map(); // "Kind/ns/name" -> graph node id

      const getOrAddOwner = (kind, name, podNs) => {
        const key = `${kind}/${podNs}/${name}`;
        if (ownerIds.has(key)) return ownerIds.get(key);
        const id = addNode(kind, name, podNs, null);
        addEdge(rootId, id, "hosts", KIND_COLOR[kind] ?? "#94a3b8");
        ownerIds.set(key, id);
        return id;
      };

      // build a quick lookup: rs name -> deployment name (for pod → deployment chain)
      const rsToDeployment = new Map();
      (allData.allReplicasets ?? []).forEach((rs) => {
        const owner = (rs?.metadata?.ownerReferences ?? []).find((o) => o.kind === "Deployment");
        if (owner) rsToDeployment.set(`${rs?.metadata?.namespace}/${rs?.metadata?.name}`, { name: owner.name, ns: rs?.metadata?.namespace });
      });

      nodePods.forEach((pod) => {
        const podNs   = pod?.metadata?.namespace ?? "";
        const podName = pod?.metadata?.name;
        const owners  = pod?.metadata?.ownerReferences ?? [];

        let parentId = null;

        if (owners.length > 0) {
          const owner = owners[0];
          if (owner.kind === "ReplicaSet") {
            const dep = rsToDeployment.get(`${podNs}/${owner.name}`);
            if (dep) {
              // pod → ReplicaSet → Deployment; show Deployment as direct child of node
              parentId = getOrAddOwner("Deployment", dep.name, podNs);
            } else {
              parentId = getOrAddOwner("ReplicaSet", owner.name, podNs);
            }
          } else if (["StatefulSet","DaemonSet","Job","ReplicationController"].includes(owner.kind)) {
            parentId = getOrAddOwner(owner.kind, owner.name, podNs);
          }
        }

        const podId = addNode("Pod", podName, podNs, null);
        addEdge(parentId ?? rootId, podId, "runs", KIND_COLOR.Pod);
      });
      break;
    }

    case "namespace": {
      const inNs = (item) => item?.metadata?.namespace === rname;

      // add workloads directly under namespace
      (allData.allDeployments ?? []).filter(inNs).forEach((d) => {
        const id = addNode("Deployment", d?.metadata?.name, rname, null);
        addEdge(rootId, id, "contains", KIND_COLOR.Deployment);
      });
      (allData.allStatefulsets ?? []).filter(inNs).forEach((s) => {
        const id = addNode("StatefulSet", s?.metadata?.name, rname, null);
        addEdge(rootId, id, "contains", KIND_COLOR.StatefulSet);
      });
      (allData.allDaemonsets ?? []).filter(inNs).forEach((d) => {
        const id = addNode("DaemonSet", d?.metadata?.name, rname, null);
        addEdge(rootId, id, "contains", KIND_COLOR.DaemonSet);
      });
      (allData.allJobs ?? []).filter(inNs).forEach((j) => {
        const id = addNode("Job", j?.metadata?.name, rname, null);
        addEdge(rootId, id, "contains", KIND_COLOR.Job);
      });

      // build rs → deployment lookup for this namespace
      const nsRsToDeployment = new Map();
      (allData.allReplicasets ?? []).filter(inNs).forEach((rs) => {
        const owner = (rs?.metadata?.ownerReferences ?? []).find((o) => o.kind === "Deployment");
        if (owner) nsRsToDeployment.set(rs?.metadata?.name, owner.name);
      });

      // connect pods to their owner workload, not directly to namespace
      (allData.allPods ?? []).filter(inNs).forEach((pod) => {
        const podId = addNode("Pod", pod?.metadata?.name, rname, null);
        const owners = pod?.metadata?.ownerReferences ?? [];
        let parentId = null;
        if (owners.length > 0) {
          const owner = owners[0];
          if (owner.kind === "ReplicaSet") {
            const depName = nsRsToDeployment.get(owner.name);
            const parentName = depName ?? owner.name;
            const parentKind = depName ? "Deployment" : "ReplicaSet";
            parentId = `${parentKind}__${rname}__${parentName}`;
          } else if (["StatefulSet","DaemonSet","Job","ReplicationController"].includes(owner.kind)) {
            parentId = `${owner.kind}__${rname}__${owner.name}`;
          }
        }
        // only wire to parent if that node is already in the graph
        addEdge(nodesMap.has(parentId) ? parentId : rootId, podId, "runs", KIND_COLOR.Pod);
      });
      break;
    }

    case "horizontalpodautoscaler": {
      const ref = spec.scaleTargetRef;
      if (ref?.name && ref?.kind) {
        const id = addNode(ref.kind, ref.name, ns, "scales");
        addEdge(id, rootId, "scaled by", KIND_COLOR[ref.kind] ?? "#94a3b8");
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

  const nsOpts      = { namespace, context: activeContext };
  const clusterOpts = { context: activeContext };

  const { data: servicesData         } = useK8sResource("core",       "services",                 nsOpts);
  const { data: ingressesData        } = useK8sResource("networking", "ingresses",                nsOpts);
  const { data: podsData             } = useK8sResource("core",       "pods",                     nsOpts);
  const bigOpts = { ...clusterOpts, listParams: { limit: 500 } };
  const { data: allPodsData          } = useK8sResource("core",       "pods",        bigOpts);
  const { data: allDeploymentsData   } = useK8sResource("apps",       "deployments", bigOpts);
  const { data: allStatefulsetsData  } = useK8sResource("apps",       "statefulsets",bigOpts);
  const { data: allDaemonsetsData    } = useK8sResource("apps",       "daemonsets",  bigOpts);
  const { data: allJobsData          } = useK8sResource("batch",      "jobs",        bigOpts);
  const { data: allReplicasetsData   } = useK8sResource("apps",       "replicasets", bigOpts);
  const { data: replicasetsData      } = useK8sResource("apps",       "replicasets",              nsOpts);
  const { data: hpasData             } = useK8sResource("autoscaling","horizontalpodautoscalers", nsOpts);
  const { data: configmapsData       } = useK8sResource("core",       "configmaps",               nsOpts);
  const { data: secretsData          } = useK8sResource("core",       "secrets",                  nsOpts);
  const { data: serviceaccountsData  } = useK8sResource("core",       "serviceaccounts",          nsOpts);
  const { data: jobsData             } = useK8sResource("batch",      "jobs",                     nsOpts);
  const { data: cronjobsData         } = useK8sResource("batch",      "cronjobs",                 nsOpts);
  const { data: rcData               } = useK8sResource("core",       "replicationcontrollers",   nsOpts);
  const { data: endpointsData        } = useK8sResource("core",       "endpoints",                nsOpts);
  const { data: networkpoliciesData  } = useK8sResource("networking", "networkpolicies",          nsOpts);
  const { data: pvcsData             } = useK8sResource("core",       "persistentvolumeclaims",   nsOpts);
  const { data: rolebindingsData     } = useK8sResource("rbac",       "rolebindings",             nsOpts);
  const { data: rolesData            } = useK8sResource("rbac",       "roles",                    nsOpts);
  const { data: pvsData              } = useK8sResource("core",       "persistentvolumes",        clusterOpts);
  const { data: storageclassesData   } = useK8sResource("storage",    "storageclasses",           clusterOpts);
  const { data: nodesData            } = useK8sResource("core",       "nodes",                    clusterOpts);
  const { data: clusterrolesData     } = useK8sResource("rbac",       "clusterroles",             clusterOpts);
  const { data: clusterrolebindingsData } = useK8sResource("rbac",    "clusterrolebindings",      clusterOpts);
  const { data: ingressclassesData   } = useK8sResource("networking", "ingressclasses",           clusterOpts);

  const norm = (d) => Array.isArray(d) ? d : (d?.data ?? d?.items ?? []);

  const allData = React.useMemo(() => ({
    services:            norm(servicesData),
    ingresses:           norm(ingressesData),
    pods:                norm(podsData),
    allPods:             norm(allPodsData),
    allDeployments:      norm(allDeploymentsData),
    allStatefulsets:     norm(allStatefulsetsData),
    allDaemonsets:       norm(allDaemonsetsData),
    allJobs:             norm(allJobsData),
    allReplicasets:      norm(allReplicasetsData),
    replicasets:         norm(replicasetsData),
    hpas:                norm(hpasData),
    configmaps:          norm(configmapsData),
    secrets:             norm(secretsData),
    serviceaccounts:     norm(serviceaccountsData),
    jobs:                norm(jobsData),
    cronjobs:            norm(cronjobsData),
    replicationcontrollers: norm(rcData),
    endpoints:           norm(endpointsData),
    networkpolicies:     norm(networkpoliciesData),
    pvcs:                norm(pvcsData),
    pvs:                 norm(pvsData),
    storageclasses:      norm(storageclassesData),
    nodes:               norm(nodesData),
    roles:               norm(rolesData),
    rolebindings:        norm(rolebindingsData),
    clusterroles:        norm(clusterrolesData),
    clusterrolebindings: norm(clusterrolebindingsData),
    ingressclasses:      norm(ingressclassesData),
  }), [
    servicesData, ingressesData, podsData, allPodsData, replicasetsData, hpasData,
    allDeploymentsData, allStatefulsetsData, allDaemonsetsData, allJobsData, allReplicasetsData,
    configmapsData, secretsData, serviceaccountsData, jobsData, cronjobsData,
    rcData, endpointsData, networkpoliciesData, pvcsData, pvsData,
    storageclassesData, nodesData, rolesData, rolebindingsData,
    clusterrolesData, clusterrolebindingsData, ingressclassesData,
  ]);

  if (!resource) return null;

  return (
    <ReactFlowProvider>
      <DepGraphInner resourceType={resourceType} resource={resource} allData={allData} />
    </ReactFlowProvider>
  );
}
