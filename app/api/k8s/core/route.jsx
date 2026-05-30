import { NextResponse } from "next/server";
import { getClientsFromRequest } from "@/lib/k8s/client";
import { serializeK8sObjects, extractBody, extractItems, extractK8sError } from "@/lib/k8s/utils";
import { parseListParams, applyListPipeline } from "@/lib/k8s/list-pipeline";

const resourceMap = {
  namespaces: {
    scope: "cluster",
    list: (c) => c.core.listNamespace(),
    get: (c, _ns, name) => c.core.readNamespace({ name }),
  },
  nodes: {
    scope: "cluster",
    list: (c) => c.core.listNode(),
    get: (c, _ns, name) => c.core.readNode({ name }),
  },
  persistentvolumes: {
    scope: "cluster",
    list: (c) => c.core.listPersistentVolume(),
    get: (c, _ns, name) => c.core.readPersistentVolume({ name }),
  },
  pods: {
    scope: "namespaced",
    listNamespaced: (c, ns) => c.core.listNamespacedPod({ namespace: ns }),
    listAll: (c) => c.core.listPodForAllNamespaces(),
    get: (c, ns, name) => c.core.readNamespacedPod({ namespace: ns, name }),
  },
  services: {
    scope: "namespaced",
    listNamespaced: (c, ns) => c.core.listNamespacedService({ namespace: ns }),
    listAll: (c) => c.core.listServiceForAllNamespaces(),
    get: (c, ns, name) => c.core.readNamespacedService({ namespace: ns, name }),
  },
  configmaps: {
    scope: "namespaced",
    listNamespaced: (c, ns) => c.core.listNamespacedConfigMap({ namespace: ns }),
    listAll: (c) => c.core.listConfigMapForAllNamespaces(),
    get: (c, ns, name) => c.core.readNamespacedConfigMap({ namespace: ns, name }),
  },
  secrets: {
    scope: "namespaced",
    listNamespaced: (c, ns) => c.core.listNamespacedSecret({ namespace: ns }),
    listAll: (c) => c.core.listSecretForAllNamespaces(),
    get: (c, ns, name) => c.core.readNamespacedSecret({ namespace: ns, name }),
  },
  persistentvolumeclaims: {
    scope: "namespaced",
    listNamespaced: (c, ns) => c.core.listNamespacedPersistentVolumeClaim({ namespace: ns }),
    listAll: (c) => c.core.listPersistentVolumeClaimForAllNamespaces(),
    get: (c, ns, name) => c.core.readNamespacedPersistentVolumeClaim({ namespace: ns, name }),
  },
  replicationcontrollers: {
    scope: "namespaced",
    listNamespaced: (c, ns) => c.core.listNamespacedReplicationController({ namespace: ns }),
    listAll: (c) => c.core.listReplicationControllerForAllNamespaces(),
    get: (c, ns, name) => c.core.readNamespacedReplicationController({ namespace: ns, name }),
  },
  resourcequotas: {
    scope: "namespaced",
    listNamespaced: (c, ns) => c.core.listNamespacedResourceQuota({ namespace: ns }),
    listAll: (c) => c.core.listResourceQuotaForAllNamespaces(),
    get: (c, ns, name) => c.core.readNamespacedResourceQuota({ namespace: ns, name }),
  },
  limitranges: {
    scope: "namespaced",
    listNamespaced: (c, ns) => c.core.listNamespacedLimitRange({ namespace: ns }),
    listAll: (c) => c.core.listLimitRangeForAllNamespaces(),
    get: (c, ns, name) => c.core.readNamespacedLimitRange({ namespace: ns, name }),
  },
  endpoints: {
    scope: "namespaced",
    listNamespaced: (c, ns) => c.core.listNamespacedEndpoints({ namespace: ns }),
    listAll: (c) => c.core.listEndpointsForAllNamespaces(),
    get: (c, ns, name) => c.core.readNamespacedEndpoints({ namespace: ns, name }),
  },
  serviceaccounts: {
    scope: "namespaced",
    listNamespaced: (c, ns) => c.core.listNamespacedServiceAccount({ namespace: ns }),
    listAll: (c) => c.core.listServiceAccountForAllNamespaces(),
    get: (c, ns, name) => c.core.readNamespacedServiceAccount({ namespace: ns, name }),
  },
};

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const resource = searchParams.get("resource");
  const namespace = searchParams.get("namespace");
  const name = searchParams.get("name");
  const context = searchParams.get("context");

  if (!resource || !context) {
    return NextResponse.json({ error: "Missing required params: resource, context" }, { status: 400 });
  }

  const entry = resourceMap[resource.toLowerCase()];
  if (!entry) {
    return NextResponse.json({ error: `Unknown resource: ${resource}` }, { status: 400 });
  }

  try {
    const clients = getClientsFromRequest(request);
    const params = parseListParams(request);
    let result;
    if (name) {
      const res = await entry.get(clients, namespace, name);
      result = { item: extractBody(res) };
    } else if (entry.scope === "cluster") {
      const res = await entry.list(clients);
      result = applyListPipeline(extractItems(res), params);
    } else if (namespace) {
      const res = await entry.listNamespaced(clients, namespace);
      result = applyListPipeline(extractItems(res), params);
    } else {
      const res = await entry.listAll(clients);
      result = applyListPipeline(extractItems(res), params);
    }
    return NextResponse.json(serializeK8sObjects(result));
  } catch (err) {
    return NextResponse.json({ error: extractK8sError(err, "Failed to fetch resource") }, { status: 500 });
  }
}
