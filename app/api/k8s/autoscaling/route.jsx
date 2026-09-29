import { NextResponse } from "next/server";
import { getRequestClients, withWatchHeaders } from "@/lib/k8s/watch/cached-clients";
import { serializeK8sObjects, extractBody, extractItems, extractK8sError } from "@/lib/k8s/utils";
import { parseListParams, applyListPipeline } from "@/lib/k8s/list-pipeline";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const namespace = searchParams.get("namespace");
  const name = searchParams.get("name");
  const context = searchParams.get("context");

  if (!context) {
    return NextResponse.json({ error: "Missing required param: context" }, { status: 400 });
  }

  try {
    const clients = getRequestClients(request);
    const params = parseListParams(request);
    let result;
    if (name) {
      const res = await clients.autoscaling.readNamespacedHorizontalPodAutoscaler({ namespace, name });
      result = { item: extractBody(res) };
    } else if (namespace) {
      const res = await clients.autoscaling.listNamespacedHorizontalPodAutoscaler({ namespace });
      result = applyListPipeline(extractItems(res), params);
    } else {
      const res = await clients.autoscaling.listHorizontalPodAutoscalerForAllNamespaces();
      result = applyListPipeline(extractItems(res), params);
    }
    return withWatchHeaders(NextResponse.json(serializeK8sObjects(result)), clients);
  } catch (err) {
    return NextResponse.json({ error: extractK8sError(err, "Failed to fetch HPAs") }, { status: 500 });
  }
}
