import * as k8s from "@kubernetes/client-node";

import { getCluster } from "./cluster-store";

const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

export function isLocalAddress(serverUrl) {
  let hostname;
  try {
    hostname = new URL(serverUrl).hostname;
  } catch {
    return false;
  }

  if (LOCAL_HOSTNAMES.has(hostname)) return true;
  return /^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.)/.test(hostname);
}

export function parseKubeconfigString(content) {
  const kubeConfig = new k8s.KubeConfig();
  kubeConfig.loadFromString(content);
  return kubeConfig;
}

export function loadDefaultKubeConfig() {
  const kubeConfig = new k8s.KubeConfig();
  kubeConfig.loadFromDefault();
  return kubeConfig;
}

export function buildManualKubeConfig({ apiEndpoint, caData, certData, keyData, skipTls, token }) {
  const kubeConfig = new k8s.KubeConfig();
  kubeConfig.loadFromOptions({
    clusters: [
      {
        caData: caData || undefined,
        name: "manual-cluster",
        server: apiEndpoint,
        skipTLSVerify: skipTls === true,
      },
    ],
    contexts: [{ cluster: "manual-cluster", name: "manual-context", user: "manual-user" }],
    currentContext: "manual-context",
    users: [
      {
        certData: certData || undefined,
        keyData: keyData || undefined,
        name: "manual-user",
        token: token || undefined,
      },
    ],
  });
  return kubeConfig;
}

export async function validateConnection(kubeConfig) {
  const startedAt = Date.now();
  const coreApi = kubeConfig.makeApiClient(k8s.CoreV1Api);
  const namespaceResponse = await coreApi.listNamespace();
  const latencyMs = Date.now() - startedAt;
  const namespaces = namespaceResponse.items.map((namespace) => namespace.metadata.name);
  const cluster = kubeConfig.getCurrentCluster();
  const contexts = kubeConfig.getContexts?.() ?? [];
  const users = kubeConfig.getUsers?.() ?? [];
  const clusters = kubeConfig.getClusters?.() ?? [];
  const server = cluster?.server ?? "";

  let serverVersion = "";
  try {
    const versionApi = kubeConfig.makeApiClient(k8s.VersionApi);
    const version = await versionApi.getCode();
    serverVersion = `v${version.major}.${version.minor}`;
  } catch {}

  let crdCount = 0;
  try {
    const extensionsApi = kubeConfig.makeApiClient(k8s.ApiextensionsV1Api);
    const crds = await extensionsApi.listCustomResourceDefinition();
    crdCount = crds.items.length;
  } catch {}

  return {
    contextName: kubeConfig.currentContext,
    namespaces,
    probe: {
      clusterCount: clusters.length,
      contextCount: contexts.length,
      crdCount,
      latencyMs,
      localAddressWarning: isLocalAddress(server)
        ? "This cluster uses a local address. If the port changes, you will need to reconnect."
        : undefined,
      namespaceCount: namespaces.length,
      namespaces,
      server,
      serverVersion,
      skipTls: cluster?.skipTLSVerify ?? false,
      userCount: users.length,
    },
    success: true,
  };
}

export function serializeKubeConfig(kubeConfig) {
  const cluster = kubeConfig.getCurrentCluster();
  const user = kubeConfig.getCurrentUser();

  return {
    caData: cluster?.caData,
    certData: user?.certData,
    contextName: kubeConfig.currentContext,
    keyData: user?.keyData,
    server: cluster?.server,
    skipTLSVerify: cluster?.skipTLSVerify ?? false,
    token: user?.token,
  };
}

export function createK8sClientForContext(contextName) {
  const cluster = getCluster(contextName);
  if (!cluster) throw new Error(`Cluster "${contextName}" not found in store`);

  const kubeConfig = buildManualKubeConfig({
    apiEndpoint: cluster.server,
    caData: cluster.caData,
    certData: cluster.certData,
    keyData: cluster.keyData,
    skipTls: cluster.skipTLSVerify,
    token: cluster.token,
  });

  return {
    apps: kubeConfig.makeApiClient(k8s.AppsV1Api),
    core: kubeConfig.makeApiClient(k8s.CoreV1Api),
    kubeConfig,
    version: kubeConfig.makeApiClient(k8s.VersionApi),
  };
}

export function getClientsFromRequest(request) {
  const h = request.headers;
  const server = h.get("x-cluster-server");
  if (!server) throw new Error("Missing x-cluster-server header");

  const kubeConfig = buildManualKubeConfig({
    apiEndpoint: server,
    caData: h.get("x-cluster-ca-data") || undefined,
    certData: h.get("x-cluster-cert-data") || undefined,
    keyData: h.get("x-cluster-key-data") || undefined,
    skipTls: h.get("x-cluster-skip-tls") === "true",
    token: h.get("x-cluster-token") || undefined,
  });

  return {
    apps: kubeConfig.makeApiClient(k8s.AppsV1Api),
    batch: kubeConfig.makeApiClient(k8s.BatchV1Api),
    core: kubeConfig.makeApiClient(k8s.CoreV1Api),
    extensions: kubeConfig.makeApiClient(k8s.ApiextensionsV1Api),
    networking: kubeConfig.makeApiClient(k8s.NetworkingV1Api),
    rbac: kubeConfig.makeApiClient(k8s.RbacAuthorizationV1Api),
    storage: kubeConfig.makeApiClient(k8s.StorageV1Api),
    autoscaling: kubeConfig.makeApiClient(k8s.AutoscalingV2Api),
    kubeConfig,
    version: kubeConfig.makeApiClient(k8s.VersionApi),
  };
}

export function extractK8sError(error) {
  if (error?.response?.body?.message) return error.response.body.message;
  if (error?.message) return error.message;
  return "Connection failed.";
}
