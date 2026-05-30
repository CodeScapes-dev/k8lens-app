import { NextResponse } from "next/server";
import { getClientsFromRequest } from "@/lib/k8s/client";
import { serializeK8sObjects, extractBody, extractItems, extractK8sError } from "@/lib/k8s/utils";
import { parseListParams, applyListPipeline } from "@/lib/k8s/list-pipeline";

const resourceMap = {
  jobs: {
    scope: "namespaced",
    listNamespaced: (c, ns) => c.batch.listNamespacedJob({ namespace: ns }),
    listAll: (c) => c.batch.listJobForAllNamespaces(),
    get: (c, ns, name) => c.batch.readNamespacedJob({ namespace: ns, name }),
  },
  cronjobs: {
    scope: "namespaced",
    listNamespaced: (c, ns) => c.batch.listNamespacedCronJob({ namespace: ns }),
    listAll: (c) => c.batch.listCronJobForAllNamespaces(),
    get: (c, ns, name) => c.batch.readNamespacedCronJob({ namespace: ns, name }),
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
    let result;
    const params = parseListParams(request);
    if (name) {
      const res = await entry.get(clients, namespace, name);
      result = { item: extractBody(res) };
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
