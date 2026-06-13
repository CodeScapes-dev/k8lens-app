import { getAllClusters } from "@/lib/k8s/cluster-store";
import { createK8sClientForContext } from "@/lib/k8s/client";
import { detectClusterProvider } from "@/lib/k8s/cluster-info";
import { APP_VERSION } from "@/lib/data";

export async function collectPayload(installId, firstSeenAt) {
  const clusters = getAllClusters();
  const items = await Promise.all(
    clusters.map(async ({ contextName }) => {
      try {
        const kubeConfig = createK8sClientForContext(contextName);
        const k8s = await import("@kubernetes/client-node");
        const coreApi = kubeConfig.makeApiClient(k8s.CoreV1Api);
        const versionApi = kubeConfig.makeApiClient(k8s.VersionApi);

        const [nodesRes, namespacesRes, versionRes] = await Promise.allSettled([
          coreApi.listNode(),
          coreApi.listNamespace(),
          versionApi.getCode(),
        ]);

        const nodes = nodesRes.status === "fulfilled" ? nodesRes.value.items : [];
        const namespaceCount = namespacesRes.status === "fulfilled" ? namespacesRes.value.items.length : 0;
        const serverVersion = versionRes.status === "fulfilled"
          ? `v${versionRes.value.major}.${versionRes.value.minor}`
          : null;

        const { providerType } = detectClusterProvider(nodes);
        return { contextName, providerType, serverVersion, namespaceCount };
      } catch {
        return { contextName, providerType: "unknown", serverVersion: null, namespaceCount: 0 };
      }
    })
  );

  const totalNamespaces = items.reduce((s, c) => s + c.namespaceCount, 0);
  const uniqueProviders = [...new Set(items.map((c) => c.providerType))];

  const pingAt = new Date().toISOString();
  const meta = {
    schema: 1,
    appVersion: APP_VERSION,
    installId,
    firstSeenAt,
    pingAt,
    nodejsVersion: process.version,
    platform: process.platform,
  };

  const clusterData = { count: items.length, items, totalNamespaces, uniqueProviders };

  return { meta, clusters: clusterData };
}
