import { NextResponse } from "next/server";
import { getClientsFromRequest } from "@/lib/k8s/client";
import { serializeK8sObjects, extractBody, extractItems, extractK8sError } from "@/lib/k8s/utils";
import { parseListParams, applyListPipeline } from "@/lib/k8s/list-pipeline";

const resourceMap = {
  storageclasses: {
    scope: "cluster",
    list: (c) => c.storage.listStorageClass(),
    get: (c, _ns, name) => c.storage.readStorageClass({ name }),
  },
  volumeattachments: {
    scope: "cluster",
    list: (c) => c.storage.listVolumeAttachment(),
    get: (c, _ns, name) => c.storage.readVolumeAttachment({ name }),
  },
  csidrivers: {
    scope: "cluster",
    list: (c) => c.storage.listCSIDriver(),
    get: (c, _ns, name) => c.storage.readCSIDriver({ name }),
  },
  csinodes: {
    scope: "cluster",
    list: (c) => c.storage.listCSINode(),
    get: (c, _ns, name) => c.storage.readCSINode({ name }),
  },
};

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const resource = searchParams.get("resource");
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
      const res = await entry.get(clients, null, name);
      result = { item: extractBody(res) };
    } else {
      const res = await entry.list(clients);
      result = applyListPipeline(extractItems(res), params);
    }
    return NextResponse.json(serializeK8sObjects(result));
  } catch (err) {
    return NextResponse.json({ error: extractK8sError(err, "Failed to fetch resource") }, { status: 500 });
  }
}
