import { NextResponse } from "next/server";
import { getClientsFromRequest } from "@/lib/k8s/client";
import { detectMetricsServer } from "@/lib/k8s/metrics-client";

export async function GET(request) {
  try {
    const { kubeConfig } = getClientsFromRequest(request);
    const result = await detectMetricsServer(kubeConfig);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ available: false, error: err.message }, { status: 200 });
  }
}
