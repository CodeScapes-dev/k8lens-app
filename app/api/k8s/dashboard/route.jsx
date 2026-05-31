import { NextResponse } from "next/server";
import { getClientsFromRequest } from "@/lib/k8s/client";
import { serializeK8sObjects, extractItems, extractK8sError } from "@/lib/k8s/utils";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const context = searchParams.get("context");

  if (!context) {
    return NextResponse.json({ error: "Missing required param: context" }, { status: 400 });
  }

  try {
    const clients = getClientsFromRequest(request);

    const [
      nodesRes, podsRes, namespacesRes, servicesRes, endpointsRes,
      eventsRes, resourceQuotasRes, limitRangesRes,
      deploymentsRes, statefulSetsRes, daemonSetsRes,
      jobsRes, cronJobsRes, ingressesRes,
    ] = await Promise.allSettled([
      clients.core.listNode(),
      clients.core.listPodForAllNamespaces(),
      clients.core.listNamespace(),
      clients.core.listServiceForAllNamespaces(),
      clients.core.listEndpointsForAllNamespaces(),
      clients.events.listEventForAllNamespaces(),
      clients.core.listResourceQuotaForAllNamespaces(),
      clients.core.listLimitRangeForAllNamespaces(),
      clients.apps.listDeploymentForAllNamespaces(),
      clients.apps.listStatefulSetForAllNamespaces(),
      clients.apps.listDaemonSetForAllNamespaces(),
      clients.batch.listJobForAllNamespaces(),
      clients.batch.listCronJobForAllNamespaces(),
      clients.networking.listIngressForAllNamespaces(),
    ]);

    const safe = (res) => (res.status === "fulfilled" ? extractItems(res.value) : []);

    return NextResponse.json(serializeK8sObjects({
      nodes: safe(nodesRes),
      pods: safe(podsRes),
      namespaces: safe(namespacesRes),
      services: safe(servicesRes),
      endpoints: safe(endpointsRes),
      events: safe(eventsRes),
      resourceQuotas: safe(resourceQuotasRes),
      limitRanges: safe(limitRangesRes),
      deployments: safe(deploymentsRes),
      statefulSets: safe(statefulSetsRes),
      daemonSets: safe(daemonSetsRes),
      jobs: safe(jobsRes),
      cronJobs: safe(cronJobsRes),
      ingresses: safe(ingressesRes),
    }));
  } catch (err) {
    return NextResponse.json({ error: extractK8sError(err, "Failed to fetch dashboard data") }, { status: 500 });
  }
}
