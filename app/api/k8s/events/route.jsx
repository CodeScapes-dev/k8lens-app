import { NextResponse } from "next/server";
import { getClientsFromRequest } from "@/lib/k8s/client";
import { serializeK8sObjects, extractItems, extractK8sError } from "@/lib/k8s/utils";
import { parseListParams, applyListPipeline } from "@/lib/k8s/list-pipeline";
import { getCachedList } from "@/lib/k8s/watch-manager";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const namespace = searchParams.get("namespace");
  const context = searchParams.get("context");

  if (!context) {
    return NextResponse.json({ error: "Missing required param: context" }, { status: 400 });
  }

  try {
    const clients = getClientsFromRequest(request);
    const params = parseListParams(request);
    const cached = getCachedList(clients.connectionParams, "events");
    let items;
    if (cached) {
      items = namespace ? cached.items.filter((o) => o.metadata?.namespace === namespace) : cached.items;
    } else if (namespace) {
      items = extractItems(await clients.events.listNamespacedEvent({ namespace }));
    } else {
      items = extractItems(await clients.events.listEventForAllNamespaces());
    }
    return NextResponse.json(serializeK8sObjects(applyListPipeline(items, params)));
  } catch (err) {
    return NextResponse.json({ error: extractK8sError(err, "Failed to fetch events") }, { status: 500 });
  }
}
