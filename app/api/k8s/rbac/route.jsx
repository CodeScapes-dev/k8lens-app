import { NextResponse } from "next/server";
import { getClientsFromRequest } from "@/lib/k8s/client";
import { serializeK8sObjects, extractBody, extractItems, extractK8sError } from "@/lib/k8s/utils";
import { parseListParams, applyListPipeline } from "@/lib/k8s/list-pipeline";

const resourceMap = {
  clusterroles: {
    scope: "cluster",
    list: (c) => c.rbac.listClusterRole(),
    get: (c, _ns, name) => c.rbac.readClusterRole({ name }),
  },
  clusterrolebindings: {
    scope: "cluster",
    list: (c) => c.rbac.listClusterRoleBinding(),
    get: (c, _ns, name) => c.rbac.readClusterRoleBinding({ name }),
  },
  roles: {
    scope: "namespaced",
    listNamespaced: (c, ns) => c.rbac.listNamespacedRole({ namespace: ns }),
    listAll: (c) => c.rbac.listRoleForAllNamespaces(),
    get: (c, ns, name) => c.rbac.readNamespacedRole({ namespace: ns, name }),
  },
  rolebindings: {
    scope: "namespaced",
    listNamespaced: (c, ns) => c.rbac.listNamespacedRoleBinding({ namespace: ns }),
    listAll: (c) => c.rbac.listRoleBindingForAllNamespaces(),
    get: (c, ns, name) => c.rbac.readNamespacedRoleBinding({ namespace: ns, name }),
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
