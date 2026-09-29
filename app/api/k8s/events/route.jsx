import { NextResponse } from "next/server";
import { getRequestClients, withWatchHeaders } from "@/lib/k8s/watch/cached-clients";
import { serializeK8sObjects, extractItems, extractK8sError } from "@/lib/k8s/utils";
import { parseListParams, applyListPipeline } from "@/lib/k8s/list-pipeline";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const namespace = searchParams.get("namespace");
  const context = searchParams.get("context");

  if (!context) {
    return NextResponse.json({ error: "Missing required param: context" }, { status: 400 });
  }

  try {
    const clients = getRequestClients(request);
    const params = parseListParams(request);
    let res;
    if (namespace) {
      res = await clients.events.listNamespacedEvent({ namespace });
    } else {
      res = await clients.events.listEventForAllNamespaces();
    }
    return withWatchHeaders(NextResponse.json(serializeK8sObjects(applyListPipeline(extractItems(res), params))), clients);
  } catch (err) {
    return NextResponse.json({ error: extractK8sError(err, "Failed to fetch events") }, { status: 500 });
  }
}
