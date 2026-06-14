import { getAllClusters } from "@/lib/k8s/cluster-store";
import { createK8sClientForContext, loadDefaultKubeConfig } from "@/lib/k8s/client";
import { detectClusterProvider } from "@/lib/k8s/cluster-info";
import { APP_VERSION } from "@/lib/data";
import * as k8s from "@kubernetes/client-node";

function detectProviderFromServer(server = "", contextName = "") {
  const s = server.toLowerCase();
  const c = contextName.toLowerCase();
  if (/\.eks\.amazonaws\.com|\.elb\.amazonaws\.com/.test(s) || c.startsWith("eks")) return "eks";
  if (/\.gke\.io|container\.googleapis/.test(s) || c.startsWith("gke_")) return "gke";
  if (/\.azmk8s\.io/.test(s) || c.startsWith("aks-")) return "aks";
  if (c === "docker-desktop" || /docker\.internal/.test(s)) return "docker-desktop";
  if (c === "minikube" || c.startsWith("minikube")) return "minikube";
  if (c.startsWith("kind-")) return "kind";
  if (c.includes("k3s") || c.includes("k3d")) return "k3s";
  if (c.includes("rancher")) return "rancher";
  if (/127\.0\.0\.1|localhost|192\.168\./.test(s)) return "local";
  return "generic";
}

export async function collectPayload(installId, firstSeenAt, clusterHint = null) {
  const serverClusters = getAllClusters();

  // Use in-memory clusters if available (same session), otherwise fall back to
  // the lightweight hint sent by the browser (count + server URLs from localStorage)
  let items;
  if (serverClusters.length > 0) {
    items = await Promise.all(
      serverClusters.map(async ({ contextName, server }) => {
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

          const { providerType: rawProvider } = detectClusterProvider(nodes);
          const providerType = rawProvider === "unknown" || rawProvider === "generic"
            ? detectProviderFromServer(server ?? "", contextName)
            : rawProvider;
          return { contextName, providerType, serverVersion, namespaceCount };
        } catch {
          return { contextName, providerType: detectProviderFromServer(server ?? "", contextName), serverVersion: null, namespaceCount: 0 };
        }
      })
    );
  } else if (clusterHint?.length > 0) {
    // Query each hinted cluster live using the default kubeconfig (switched to contextName)
    items = await Promise.all(
      clusterHint.map(async ({ contextName, server }) => {
        try {
          const kubeConfig = loadDefaultKubeConfig();
          kubeConfig.setCurrentContext(contextName);
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
          // Fall back to URL/name heuristic if node labels give no signal
          const resolvedProvider = providerType === "unknown" || providerType === "generic"
            ? detectProviderFromServer(server, contextName)
            : providerType;
          return { contextName, providerType: resolvedProvider, serverVersion, namespaceCount };
        } catch {
          return {
            contextName,
            providerType: detectProviderFromServer(server, contextName),
            serverVersion: null,
            namespaceCount: 0,
          };
        }
      })
    );
  } else {
    items = [];
  }

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
