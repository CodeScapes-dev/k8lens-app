import { NextResponse } from "next/server";

import { extractK8sError, loadDefaultKubeConfig, serializeKubeConfig, validateConnection } from "@/lib/k8s/client";
import { storeCluster } from "@/lib/k8s/cluster-store";

export async function POST() {
  let kubeConfig;
  try {
    kubeConfig = loadDefaultKubeConfig();
  } catch {
    return NextResponse.json(
      { error: "No kubeconfig found. Set KUBECONFIG or create ~/.kube/config." },
      { status: 404 }
    );
  }

  const contexts = kubeConfig.getContexts();
  if (!contexts || contexts.length === 0) {
    return NextResponse.json({ error: "No contexts found in default kubeconfig." }, { status: 400 });
  }

  const clusters = await Promise.all(
    contexts.map(async (context) => {
      try {
        kubeConfig.setCurrentContext(context.name);
        const server = kubeConfig.getCurrentCluster()?.server ?? "";
        const result = await validateConnection(kubeConfig);
        const serialized = serializeKubeConfig(kubeConfig);
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
        const server = kubeConfig.getCurrentCluster()?.server ?? "";
        const unreachable = ["ECONNREFUSED", "ENOTFOUND", "ETIMEDOUT"].some(
          (code) => error?.code === code || error?.cause?.code === code
        );

        if (unreachable) {
          return {
            contextName: context.name,
            namespaces: [],
            server,
            status: "unreachable",
            warning: "Unreachable. Stay on /connect and retry when the API server is available.",
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
