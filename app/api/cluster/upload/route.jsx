import { NextResponse } from "next/server";

import { extractK8sError, isBlockedServerUrl, isolateContext, parseKubeconfigString, serializeKubeConfig, validateConnection } from "@/lib/k8s/client";
import { storeCluster } from "@/lib/k8s/cluster-store";

export async function POST(request) {
  let formData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart/form-data." }, { status: 400 });
  }

  const file = formData.get("kubeconfig");
  if (!file || typeof file.text !== "function") {
    return NextResponse.json({ error: "kubeconfig file is required." }, { status: 400 });
  }

  const content = await file.text();
  if (!content.trim()) return NextResponse.json({ error: "Kubeconfig file is empty." }, { status: 400 });
  if (content.length > 256 * 1024) {
    return NextResponse.json({ error: "Kubeconfig file is too large (max 256 KB)." }, { status: 413 });
  }

  let kubeConfig;
  try {
    kubeConfig = parseKubeconfigString(content);
  } catch (error) {
    return NextResponse.json({ error: "Failed to parse kubeconfig: " + error.message }, { status: 400 });
  }

  const contexts = kubeConfig.getContexts();
  if (!contexts || contexts.length === 0) {
    return NextResponse.json({ error: "No contexts found in kubeconfig." }, { status: 400 });
  }

  const clusters = await Promise.all(
    contexts.map(async (context) => {
      const ctx = isolateContext(kubeConfig, context.name);
      const server = ctx.getCurrentCluster()?.server ?? "";
      if (isBlockedServerUrl(server)) {
        return { contextName: context.name, error: "Blocked server URL.", server, status: "error" };
      }
      try {
        const result = await validateConnection(ctx);
        const serialized = await serializeKubeConfig(ctx);
        storeCluster(context.name, serialized);

        return {
          caData: serialized.caData,
          certData: serialized.certData,
          contextName: context.name,
          keyData: serialized.keyData,
          namespaces: result.namespaces,
          probe: result.probe ?? null,
          server,
          skipTLSVerify: serialized.skipTLSVerify,
          status: "connected",
          token: serialized.token,
        };
      } catch (error) {
        const unreachable = ["ECONNREFUSED", "ENOTFOUND", "ETIMEDOUT"].some(
          (code) => error?.code === code || error?.cause?.code === code
        );

        if (unreachable) {
          return {
            contextName: context.name,
            namespaces: [],
            server,
            status: "unreachable",
            warning: "Unreachable from server. Stay on /connect and retry when the API server is available.",
          };
        }

        return { contextName: context.name, error: extractK8sError(error), server, status: "error" };
      }
    })
  );

  if (!clusters.some((cluster) => cluster.status === "connected")) {
    return NextResponse.json(
      {
        clusters,
        error: "No reachable Kubernetes contexts were found.",
        success: false,
      },
      { status: 502 }
    );
  }

  return NextResponse.json({ clusters, success: true });
}
