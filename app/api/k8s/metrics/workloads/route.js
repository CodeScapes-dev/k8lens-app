import { NextResponse } from "next/server";
import { getClientsFromRequest } from "@/lib/k8s/client";
import { detectMetricsServer, fetchAllPodMetrics } from "@/lib/k8s/metrics-client";
import { extractItems } from "@/lib/k8s/utils";

const KIND_MAP = {
  deployments: "Deployment",
  daemonsets: "DaemonSet",
  statefulsets: "StatefulSet",
  replicasets: "ReplicaSet",
  jobs: "Job",
  replicationcontrollers: "ReplicationController",
};

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const kind = searchParams.get("kind");
  const namespace = searchParams.get("namespace") || undefined;
  const ownerKind = KIND_MAP[kind];
  if (!ownerKind) return NextResponse.json({ available: false, data: null }, { status: 400 });

  try {
    const { kubeConfig, core: coreApi, apps: appsApi } = getClientsFromRequest(request);
    const { available } = await detectMetricsServer(kubeConfig);
    if (!available) return NextResponse.json({ available: false, data: null });

    const [podMetrics, podsRes] = await Promise.all([
      fetchAllPodMetrics(kubeConfig, namespace),
      namespace
        ? coreApi.listNamespacedPod({ namespace })
        : coreApi.listPodForAllNamespaces(),
    ]);

    const pods = extractItems(podsRes);
    const metricsMap = {};
    for (const pm of podMetrics) metricsMap[`${pm.namespace}/${pm.name}`] = pm;

    // For deployments: build ReplicaSet → Deployment mapping
    let rsToDeployment = null;
    if (kind === "deployments") {
      const rsRes = namespace
        ? await appsApi.listNamespacedReplicaSet({ namespace })
        : await appsApi.listReplicaSetForAllNamespaces();
      rsToDeployment = {};
      for (const rs of extractItems(rsRes)) {
        const depOwner = (rs.metadata?.ownerReferences ?? []).find((o) => o.kind === "Deployment");
        if (depOwner) {
          rsToDeployment[`${rs.metadata.namespace}/${rs.metadata.name}`] = {
            name: depOwner.name,
            namespace: rs.metadata.namespace,
          };
        }
      }
    }

    const aggregated = {};
    for (const pod of pods) {
      const podNs = pod.metadata?.namespace;
      const podName = pod.metadata?.name;
      const m = metricsMap[`${podNs}/${podName}`];
      if (!m) continue;

      let ownerName, ownerNs;
      if (kind === "deployments") {
        const rsOwner = (pod.metadata?.ownerReferences ?? []).find((o) => o.kind === "ReplicaSet");
        if (!rsOwner) continue;
        const dep = rsToDeployment[`${podNs}/${rsOwner.name}`];
        if (!dep) continue;
        ownerName = dep.name;
        ownerNs = dep.namespace;
      } else {
        const owner = (pod.metadata?.ownerReferences ?? []).find((o) => o.kind === ownerKind);
        if (!owner) continue;
        ownerName = owner.name;
        ownerNs = podNs;
      }

      const key = `${ownerNs}/${ownerName}`;
      if (!aggregated[key]) aggregated[key] = { name: ownerName, namespace: ownerNs, cpu: 0, memory: 0 };
      aggregated[key].cpu += m.cpu;
      aggregated[key].memory += m.memory;
    }

    return NextResponse.json({ available: true, data: Object.values(aggregated) });
  } catch {
    return NextResponse.json({ available: false, data: null });
  }
}
