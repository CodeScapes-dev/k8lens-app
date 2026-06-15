import { NextResponse } from "next/server";

import { buildManualKubeConfig, extractK8sError, isBlockedServerUrl, serializeKubeConfig, validateConnection } from "@/lib/k8s/client";
import { storeCluster } from "@/lib/k8s/cluster-store";

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { apiEndpoint, caData, skipTls, token } = body;
  if (!apiEndpoint?.trim()) return NextResponse.json({ error: "apiEndpoint is required." }, { status: 400 });
  if (isBlockedServerUrl(apiEndpoint.trim())) return NextResponse.json({ error: "Invalid API endpoint." }, { status: 400 });
  if (!token?.trim()) return NextResponse.json({ error: "token is required." }, { status: 400 });

  const kubeConfig = buildManualKubeConfig({
    apiEndpoint: apiEndpoint.trim(),
    caData: caData?.trim() || undefined,
    skipTls: skipTls === true,
    token: token.trim(),
  });

  try {
    const result = await validateConnection(kubeConfig);
    const serialized = await serializeKubeConfig(kubeConfig);
    storeCluster("manual-context", serialized);

    return NextResponse.json({
      caData: serialized.caData,
      contextName: result.contextName,
      namespaces: result.namespaces,
      probe: result.probe,
      server: serialized.server,
      skipTLSVerify: serialized.skipTLSVerify,
      success: true,
      token: serialized.token,
    });
  } catch (error) {
    return NextResponse.json({ error: extractK8sError(error) }, { status: 502 });
  }
}
