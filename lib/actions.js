function getClusterInfo() {
  if (typeof window === "undefined") return { context: null, cluster: null };
  try {
    const stored = JSON.parse(localStorage.getItem("K8Lens-clusters") || "{}");
    const { clusters = [], activeContext } = stored.state || {};
    const cluster = clusters.find((c) => c.contextName === activeContext) ?? null;
    return { context: activeContext, cluster };
  } catch {
    return { context: null, cluster: null };
  }
}

function clusterHeaders(cluster) {
  const h = {};
  if (cluster?.server) h["x-cluster-server"] = cluster.server;
  if (cluster?.token) h["x-cluster-token"] = cluster.token;
  if (cluster?.caData) h["x-cluster-ca-data"] = cluster.caData;
  if (cluster?.certData) h["x-cluster-cert-data"] = cluster.certData;
  if (cluster?.keyData) h["x-cluster-key-data"] = cluster.keyData;
  if (cluster?.skipTLSVerify !== undefined)
    h["x-cluster-skip-tls"] = String(cluster.skipTLSVerify);
  return h;
}

async function k8sFetch(path, extraParams = {}) {
  const { context, cluster } = getClusterInfo();
  const params = new URLSearchParams({ context: context || "", ...extraParams });
  const res = await fetch(`/api/k8s/${path}?${params}`, {
    headers: clusterHeaders(cluster),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request to /api/k8s/${path} failed (${res.status})`);
  }
  return res.json();
}

export async function getAppsResource({ resource, namespace } = {}) {
  const p = { resource };
  if (namespace) p.namespace = namespace;
  return k8sFetch("apps", p);
}

export async function getBatchResource({ resource, namespace } = {}) {
  const p = { resource };
  if (namespace) p.namespace = namespace;
  return k8sFetch("batch", p);
}

export async function getCoreResource({ resource, namespace } = {}) {
  const p = { resource };
  if (namespace) p.namespace = namespace;
  return k8sFetch("core", p);
}

export async function getNetworkingResource({ resource, namespace } = {}) {
  const p = { resource };
  if (namespace) p.namespace = namespace;
  return k8sFetch("networking", p);
}

export async function getStorageResource({ resource, namespace } = {}) {
  const p = { resource };
  if (namespace) p.namespace = namespace;
  return k8sFetch("storage", p);
}

export async function getRbacResource({ resource, namespace } = {}) {
  const p = { resource };
  if (namespace) p.namespace = namespace;
  return k8sFetch("rbac", p);
}

export async function getAutoscalingResource({ resource, namespace } = {}) {
  const p = { resource };
  if (namespace) p.namespace = namespace;
  return k8sFetch("autoscaling", p);
}

export async function getSchedulingResource({ resource } = {}) {
  return k8sFetch("scheduling", { resource });
}

export async function getCertificatesResource({ resource } = {}) {
  return k8sFetch("certificates", { resource });
}

export async function getEventsResource({ namespace } = {}) {
  const p = {};
  if (namespace) p.namespace = namespace;
  return k8sFetch("events", p);
}

export async function getCRDsResource() {
  return k8sFetch("crds");
}

export async function getLogsResource({
  namespace, pod, container, tailLines = 100, timestamps = false,
} = {}) {
  const p = {};
  if (namespace) p.namespace = namespace;
  if (pod) p.pod = pod;
  if (container) p.container = container;
  if (tailLines) p.tailLines = tailLines;
  if (timestamps) p.timestamps = "true";
  return k8sFetch("logs", p);
}

async function getDetail(type, params) {
  return k8sFetch("detail", { type, ...params });
}

export async function getPodDetail(namespace, name) { return getDetail("pod", { namespace, name }); }
export async function getDeploymentDetail(namespace, name) { return getDetail("deployment", { namespace, name }); }
export async function getStatefulSetDetail(namespace, name) { return getDetail("statefulset", { namespace, name }); }
export async function getDaemonSetDetail(namespace, name) { return getDetail("daemonset", { namespace, name }); }
export async function getReplicaSetDetail(namespace, name) { return getDetail("replicaset", { namespace, name }); }
export async function getReplicationControllerDetail(namespace, name) { return getDetail("replicationcontroller", { namespace, name }); }
export async function getJobDetail(namespace, name) { return getDetail("job", { namespace, name }); }
export async function getCronJobDetail(namespace, name) { return getDetail("cronjob", { namespace, name }); }
export async function getNodeDetail(name) { return getDetail("node", { name }); }
export async function getNamespaceDetail(name) { return getDetail("namespace", { name }); }
export async function getServiceDetail(namespace, name) { return getDetail("service", { namespace, name }); }
export async function getEndpointsDetail(namespace, name) { return getDetail("endpoints", { namespace, name }); }
export async function getIngressDetail(namespace, name) { return getDetail("ingress", { namespace, name }); }
export async function getIngressClassDetail(name) { return getDetail("ingressclass", { name }); }
export async function getNetworkPolicyDetail(namespace, name) { return getDetail("networkpolicy", { namespace, name }); }
export async function getPVDetail(name) { return getDetail("pv", { name }); }
export async function getPVCDetail(namespace, name) { return getDetail("pvc", { namespace, name }); }
export async function getStorageClassDetail(name) { return getDetail("storageclass", { name }); }
export async function getConfigMapDetail(namespace, name) { return getDetail("configmap", { namespace, name }); }
export async function getSecretDetail(namespace, name) { return getDetail("secret", { namespace, name }); }
export async function getResourceQuotaDetail(namespace, name) { return getDetail("resourcequota", { namespace, name }); }
export async function getLimitRangeDetail(namespace, name) { return getDetail("limitrange", { namespace, name }); }
export async function getRoleDetail(namespace, name) { return getDetail("role", { namespace, name }); }
export async function getRoleBindingDetail(namespace, name) { return getDetail("rolebinding", { namespace, name }); }
export async function getClusterRoleDetail(name) { return getDetail("clusterrole", { name }); }
export async function getClusterRoleBindingDetail(name) { return getDetail("clusterrolebinding", { name }); }
export async function getServiceAccountDetail(namespace, name) { return getDetail("serviceaccount", { namespace, name }); }
export async function getHPADetail(namespace, name) { return getDetail("hpa", { namespace, name }); }
export async function getCRDDetail(name) { return getDetail("crd", { name }); }
export async function getPriorityClassDetail(name) { return getDetail("priorityclass", { name }); }
export async function getCSRDetail(name) { return getDetail("csr", { name }); }

export async function getNamespacesWithDetails() {
  return k8sFetch("namespaces-detail");
}

export async function getRolesWithMetrics() {
  const [rolesRes, bindingsRes] = await Promise.all([
    k8sFetch("rbac", { resource: "roles" }),
    k8sFetch("rbac", { resource: "rolebindings" }),
  ]);
  const roles = rolesRes?.items || [];
  const bindings = bindingsRes?.items || [];
  return {
    items: roles.map((role) => {
      const ns = role?.metadata?.namespace;
      const name = role?.metadata?.name;
      const bindingCount = bindings.filter(
        (rb) => rb?.roleRef?.name === name && rb?.metadata?.namespace === ns,
      ).length;
      return {
        name,
        namespace: ns,
        createdAt: role?.metadata?.creationTimestamp,
        ruleCount: role?.rules?.length ?? 0,
        bindingCount,
      };
    }),
  };
}

export async function getServiceAccountsWithMetrics() {
  const [saRes, bindingsRes, podsRes] = await Promise.all([
    k8sFetch("rbac", { resource: "serviceaccounts" }),
    k8sFetch("rbac", { resource: "rolebindings" }),
    k8sFetch("core", { resource: "pods" }),
  ]);
  const sas = saRes?.items || [];
  const bindings = bindingsRes?.items || [];
  const pods = podsRes?.items || [];
  return {
    items: sas.map((sa) => {
      const ns = sa?.metadata?.namespace;
      const name = sa?.metadata?.name;
      const bindingCount = bindings.filter((rb) =>
        rb?.subjects?.some(
          (s) => s.kind === "ServiceAccount" && s.name === name && s.namespace === ns,
        ),
      ).length;
      const podCount = pods.filter(
        (p) => p?.spec?.serviceAccountName === name && p?.metadata?.namespace === ns,
      ).length;
      return {
        name,
        namespace: ns,
        createdAt: sa?.metadata?.creationTimestamp,
        bindingCount,
        podCount,
        secrets: sa?.secrets?.length ?? 0,
      };
    }),
  };
}
