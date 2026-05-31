import { NextResponse } from "next/server";
import { getClientsFromRequest } from "@/lib/k8s/client";
import { extractItems, extractK8sError } from "@/lib/k8s/utils";
import { buildTopologyGraph } from "@/lib/k8s/topology-transformer";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const context = searchParams.get("context");
  const namespace = searchParams.get("namespace") || null;
  const includeClusterScoped = searchParams.get("includeClusterScoped") !== "false";

  if (!context) {
    return NextResponse.json({ error: "Missing required param: context" }, { status: 400 });
  }

  try {
    const clients = getClientsFromRequest(request);

    const [
      nodesRes, podsRes, namespacesRes, servicesRes,
      configmapsRes, secretsRes, pvcsRes, pvsRes,
      deploymentsRes, replicasetsRes, statefulSetsRes, daemonSetsRes,
      jobsRes, cronJobsRes, ingressesRes, ingressClassesRes,
      hpasRes, storageClassesRes, clusterRolesRes, clusterRoleBindingsRes,
    ] = await Promise.allSettled([
      clients.core.listNode(),
      clients.core.listPodForAllNamespaces(),
      clients.core.listNamespace(),
      clients.core.listServiceForAllNamespaces(),
      clients.core.listConfigMapForAllNamespaces(),
      clients.core.listSecretForAllNamespaces(),
      clients.core.listPersistentVolumeClaimForAllNamespaces(),
      clients.core.listPersistentVolume(),
      clients.apps.listDeploymentForAllNamespaces(),
      clients.apps.listReplicaSetForAllNamespaces(),
      clients.apps.listStatefulSetForAllNamespaces(),
      clients.apps.listDaemonSetForAllNamespaces(),
      clients.batch.listJobForAllNamespaces(),
      clients.batch.listCronJobForAllNamespaces(),
      clients.networking.listIngressForAllNamespaces(),
      clients.networking.listIngressClass(),
      clients.autoscaling.listHorizontalPodAutoscalerForAllNamespaces(),
      clients.storage.listStorageClass(),
      clients.rbac.listClusterRole(),
      clients.rbac.listClusterRoleBinding(),
    ]);

    const safe = (res) => (res.status === "fulfilled" ? extractItems(res.value) : []);

    const rawData = {
      nodes: safe(nodesRes),
      pods: safe(podsRes),
      namespaces: safe(namespacesRes),
      services: safe(servicesRes),
      configmaps: safe(configmapsRes),
      secrets: safe(secretsRes),
      pvcs: safe(pvcsRes),
      pvs: safe(pvsRes),
      deployments: safe(deploymentsRes),
      replicasets: safe(replicasetsRes),
      statefulsets: safe(statefulSetsRes),
      daemonsets: safe(daemonSetsRes),
      jobs: safe(jobsRes),
      cronjobs: safe(cronJobsRes),
      ingresses: safe(ingressesRes),
      ingressclasses: safe(ingressClassesRes),
      hpas: safe(hpasRes),
      storageclasses: safe(storageClassesRes),
      clusterroles: safe(clusterRolesRes),
      clusterrolebindings: safe(clusterRoleBindingsRes),
    };

    const graph = buildTopologyGraph(rawData, {
      clusterName: context,
      clusterId: context,
      includeClusterScoped,
      namespaceFilter: namespace,
    });

    return NextResponse.json(graph);
  } catch (err) {
    return NextResponse.json(
      { error: extractK8sError(err, "Failed to build topology graph") },
      { status: 500 }
    );
  }
}
