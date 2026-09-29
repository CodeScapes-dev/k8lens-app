import { NextResponse } from "next/server";
import { getClientsFromRequest } from "@/lib/k8s/client";
import { serializeK8sObjects, extractBody, extractItems, extractK8sError } from "@/lib/k8s/utils";
import { parseListParams, applyListPipeline } from "@/lib/k8s/list-pipeline";
import { getCachedList } from "@/lib/k8s/watch-manager";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
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
      const res = await clients.scheduling.readPriorityClass({ name });
      result = { item: extractBody(res) };
    } else {
      const cached = getCachedList(clients.connectionParams, "priorityclasses");
      const items = cached ? cached.items : extractItems(await clients.scheduling.listPriorityClass());
      result = applyListPipeline(items, params);
    }
    return NextResponse.json(serializeK8sObjects(result));
  } catch (err) {
    return NextResponse.json({ error: extractK8sError(err, "Failed to fetch priority classes") }, { status: 500 });
  }
}
