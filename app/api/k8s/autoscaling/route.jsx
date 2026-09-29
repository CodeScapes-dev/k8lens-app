import { NextResponse } from "next/server";
import { getClientsFromRequest } from "@/lib/k8s/client";
import { serializeK8sObjects, extractBody, extractItems, extractK8sError } from "@/lib/k8s/utils";
import { parseListParams, applyListPipeline } from "@/lib/k8s/list-pipeline";
import { getCachedList } from "@/lib/k8s/watch-manager";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const namespace = searchParams.get("namespace");
  const name = searchParams.get("name");
  const context = searchParams.get("context");

  if (!context) {
    return NextResponse.json({ error: "Missing required param: context" }, { status: 400 });
  }

  try {
    const clients = getClientsFromRequest(request);
    const params = parseListParams(request);
    let result;
    if (name) {
      const res = await clients.autoscaling.readNamespacedHorizontalPodAutoscaler({ namespace, name });
      result = { item: extractBody(res) };
    } else {
      const cached = getCachedList(clients.connectionParams, "horizontalpodautoscalers");
      let items;
      if (cached) {
        items = namespace ? cached.items.filter((o) => o.metadata?.namespace === namespace) : cached.items;
      } else if (namespace) {
        items = extractItems(await clients.autoscaling.listNamespacedHorizontalPodAutoscaler({ namespace }));
      } else {
        items = extractItems(await clients.autoscaling.listHorizontalPodAutoscalerForAllNamespaces());
      }
      result = applyListPipeline(items, params);
    }
    return NextResponse.json(serializeK8sObjects(result));
  } catch (err) {
    return NextResponse.json({ error: extractK8sError(err, "Failed to fetch HPAs") }, { status: 500 });
  }
}
