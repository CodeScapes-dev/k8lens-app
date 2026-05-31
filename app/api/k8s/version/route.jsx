import { NextResponse } from "next/server";
import { getClientsFromRequest } from "@/lib/k8s/client";
import { extractK8sError } from "@/lib/k8s/utils";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const context = searchParams.get("context");

  if (!context) {
    return NextResponse.json({ error: "Missing required param: context" }, { status: 400 });
  }

  try {
    const clients = getClientsFromRequest(request);
    const res = await clients.version.getCode();
    const versionInfo = res?.body ?? res;
    return NextResponse.json({
      connected: true,
      clusterVersion: versionInfo?.gitVersion?.replace(/^v/, "") || "Unknown",
      fullVersion: versionInfo,
    });
  } catch (err) {
    return NextResponse.json({ error: extractK8sError(err, "Failed to fetch version") }, { status: 500 });
  }
}
