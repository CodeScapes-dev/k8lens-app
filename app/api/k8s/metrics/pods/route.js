import { NextResponse } from "next/server";
import { getClientsFromRequest } from "@/lib/k8s/client";
import { detectMetricsServer, fetchAllPodMetrics } from "@/lib/k8s/metrics-client";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const namespace = searchParams.get("namespace") || undefined;
  try {
    const { kubeConfig } = getClientsFromRequest(request);
    const { available } = await detectMetricsServer(kubeConfig);
    if (!available) return NextResponse.json({ available: false, data: null });
    const data = await fetchAllPodMetrics(kubeConfig, namespace);
    return NextResponse.json({ available: true, data });
  } catch {
    return NextResponse.json({ available: false, data: null });
  }
}
