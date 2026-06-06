import { NextResponse } from "next/server";
import { getClientsFromRequest } from "@/lib/k8s/client";
import { detectMetricsServer, fetchAllNodeMetrics } from "@/lib/k8s/metrics-client";

export async function GET(request) {
  try {
    const { kubeConfig } = getClientsFromRequest(request);
    const { available } = await detectMetricsServer(kubeConfig);
    if (!available) return NextResponse.json({ available: false, data: null });
    const data = await fetchAllNodeMetrics(kubeConfig);
    return NextResponse.json({ available: true, data });
  } catch {
    return NextResponse.json({ available: false, data: null });
  }
}
