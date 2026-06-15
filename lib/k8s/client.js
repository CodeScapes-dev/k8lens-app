import { readFileSync } from "fs";
import * as k8s from "@kubernetes/client-node";

import { getCluster } from "./cluster-store";

const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);
const CLOUD_METADATA_HOSTS = new Set(["169.254.169.254", "fd00:ec2::254", "metadata.google.internal", "metadata.azure.internal", "100.100.100.200"]);

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

export function isCloudMetadata(hostname) {
  return CLOUD_METADATA_HOSTS.has(hostname);
}

export function isBlockedServerUrl(serverUrl) {
  let hostname;
  try {
    hostname = new URL(serverUrl).hostname;
  } catch {
    return true;
  }
  return isCloudMetadata(hostname);
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

// Creates an isolated single-context KubeConfig from a shared multi-context one.
// Prevents race conditions when processing multiple contexts in parallel — each
// Promise gets its own object so setCurrentContext mutations don't cross-contaminate.
export function isolateContext(sharedKubeConfig, contextName) {
  const ctxDef = sharedKubeConfig.getContexts().find((c) => c.name === contextName);
  if (!ctxDef) throw new Error(`Context "${contextName}" not found`);
  const clusterDef = sharedKubeConfig.getClusters().find((c) => c.name === ctxDef.cluster);
  const userDef = sharedKubeConfig.getUsers().find((u) => u.name === ctxDef.user);

  const isolated = new k8s.KubeConfig();
  isolated.loadFromOptions({
    clusters: clusterDef ? [clusterDef] : [],
    contexts: [ctxDef],
    currentContext: contextName,
    users: userDef ? [userDef] : [],
  });
  return isolated;
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

const SAFE_CERT_DIRS = [
  process.env.HOME + "/.kube/",
  "/etc/kubernetes/",
  "/var/lib/kubelet/",
];

function fileToBase64(filePath) {
  if (!filePath) return undefined;
  const resolved = filePath.replace(/\\/g, "/");
  const safe = SAFE_CERT_DIRS.some((dir) => resolved.startsWith(dir));
  if (!safe) return undefined;
  try {
    return readFileSync(resolved).toString("base64");
  } catch {
    return undefined;
  }
}

export async function serializeKubeConfig(kubeConfig) {
  const cluster = kubeConfig.getCurrentCluster();
  const user = kubeConfig.getCurrentUser();

  // Normalize file-based certs to inline base64 data. Kubeconfigs can reference
  // cert/CA via file paths (e.g. Docker Desktop uses caFile). Those paths won't
  // exist when headers are forwarded to API routes, so we inline them now.
  const caData = cluster?.caData || fileToBase64(cluster?.caFile);
  const certData = user?.certData || fileToBase64(user?.certFile);
  const keyData = user?.keyData || fileToBase64(user?.keyFile);

  let token = user?.token;

  // For exec-based auth (e.g. GKE's gke-gcloud-auth-plugin), the token isn't stored
  // statically on the user object — it's resolved at request time by running the exec
  // plugin. After validateConnection runs, the plugin result is cached internally.
  // We call applyToFetchOptions to extract the resolved Bearer token from that cache.
  if (!token && user?.exec) {
    try {
      const fetchOpts = await kubeConfig.applyToFetchOptions({});
      const authHeader = fetchOpts.headers?.get?.('Authorization') ?? '';
      if (authHeader.startsWith('Bearer ')) {
        token = authHeader.slice(7);
      }
    } catch {}
  }

  return {
    caData,
    certData,
    contextName: kubeConfig.currentContext,
    keyData,
    server: cluster?.server,
    skipTLSVerify: cluster?.skipTLSVerify ?? false,
    token,
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
  if (isBlockedServerUrl(server)) throw new Error("Blocked server URL.");

  const kubeConfig = buildManualKubeConfig({
    apiEndpoint: server,
    caData: h.get("x-cluster-ca-data") || undefined,
    certData: h.get("x-cluster-cert-data") || undefined,
    keyData: h.get("x-cluster-key-data") || undefined,
    skipTls: h.get("x-cluster-skip-tls") === "true",
    token: h.get("x-cluster-token") || undefined,
  });

  const core = kubeConfig.makeApiClient(k8s.CoreV1Api);
  return {
    apps: kubeConfig.makeApiClient(k8s.AppsV1Api),
    autoscaling: kubeConfig.makeApiClient(k8s.AutoscalingV2Api),
    batch: kubeConfig.makeApiClient(k8s.BatchV1Api),
    core,
    events: core,
    extensions: kubeConfig.makeApiClient(k8s.ApiextensionsV1Api),
    networking: kubeConfig.makeApiClient(k8s.NetworkingV1Api),
    rbac: kubeConfig.makeApiClient(k8s.RbacAuthorizationV1Api),
    storage: kubeConfig.makeApiClient(k8s.StorageV1Api),
    kubeConfig,
    version: kubeConfig.makeApiClient(k8s.VersionApi),
  };
}

export function extractK8sError(error) {
  // ApiException sometimes hands back the Kubernetes Status body as a raw JSON
  // *string* rather than a parsed object — without this, `.message` lookups
  // miss and we fall through to the library's "HTTP-Code: ... Body: {...}" dump.
  let body = error?.body ?? error?.response?.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = null; }
  }
  if (body?.message) return body.message;
  if (error?.message) return error.message;
  return "Connection failed.";
}
