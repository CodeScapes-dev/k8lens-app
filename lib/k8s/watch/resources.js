// Registry of the built-in resources the watch cache knows how to mirror.
//
// `key` is the plural the app already uses in `/api/k8s/<group>?resource=<key>`.
// `api` + `kind` let the cached-client facade map typed client-node method names
// (listNamespacedPod, readIngressClass, ...) onto the right cache entry.

const RESOURCES = [
  // core/v1
  { key: "namespaces", api: "core", group: "", version: "v1", kind: "Namespace", namespaced: false },
  { key: "nodes", api: "core", group: "", version: "v1", kind: "Node", namespaced: false },
  { key: "persistentvolumes", api: "core", group: "", version: "v1", kind: "PersistentVolume", namespaced: false },
  { key: "pods", api: "core", group: "", version: "v1", kind: "Pod", namespaced: true },
  { key: "services", api: "core", group: "", version: "v1", kind: "Service", namespaced: true },
  { key: "endpoints", api: "core", group: "", version: "v1", kind: "Endpoints", plural: "endpoints", namespaced: true },
  { key: "configmaps", api: "core", group: "", version: "v1", kind: "ConfigMap", namespaced: true },
  // Secret values never enter the cache; single-object reads go straight to the API server.
  { key: "secrets", api: "core", group: "", version: "v1", kind: "Secret", namespaced: true, stripSecretData: true, cacheReads: false },
  { key: "persistentvolumeclaims", api: "core", group: "", version: "v1", kind: "PersistentVolumeClaim", namespaced: true },
  { key: "replicationcontrollers", api: "core", group: "", version: "v1", kind: "ReplicationController", namespaced: true },
  { key: "resourcequotas", api: "core", group: "", version: "v1", kind: "ResourceQuota", namespaced: true },
  { key: "limitranges", api: "core", group: "", version: "v1", kind: "LimitRange", namespaced: true },
  { key: "serviceaccounts", api: "core", group: "", version: "v1", kind: "ServiceAccount", namespaced: true },
  { key: "events", api: "core", group: "", version: "v1", kind: "Event", namespaced: true },

  // apps/v1
  { key: "deployments", api: "apps", group: "apps", version: "v1", kind: "Deployment", namespaced: true },
  { key: "statefulsets", api: "apps", group: "apps", version: "v1", kind: "StatefulSet", namespaced: true },
  { key: "daemonsets", api: "apps", group: "apps", version: "v1", kind: "DaemonSet", namespaced: true },
  { key: "replicasets", api: "apps", group: "apps", version: "v1", kind: "ReplicaSet", namespaced: true },

  // batch/v1
  { key: "jobs", api: "batch", group: "batch", version: "v1", kind: "Job", namespaced: true },
  { key: "cronjobs", api: "batch", group: "batch", version: "v1", kind: "CronJob", namespaced: true },

  // networking.k8s.io/v1
  { key: "ingresses", api: "networking", group: "networking.k8s.io", version: "v1", kind: "Ingress", plural: "ingresses", namespaced: true },
  { key: "ingressclasses", api: "networking", group: "networking.k8s.io", version: "v1", kind: "IngressClass", plural: "ingressclasses", namespaced: false },
  { key: "networkpolicies", api: "networking", group: "networking.k8s.io", version: "v1", kind: "NetworkPolicy", plural: "networkpolicies", namespaced: true },

  // storage.k8s.io/v1
  { key: "storageclasses", api: "storage", group: "storage.k8s.io", version: "v1", kind: "StorageClass", plural: "storageclasses", namespaced: false },
  { key: "volumeattachments", api: "storage", group: "storage.k8s.io", version: "v1", kind: "VolumeAttachment", namespaced: false },
  { key: "csidrivers", api: "storage", group: "storage.k8s.io", version: "v1", kind: "CSIDriver", namespaced: false },
  { key: "csinodes", api: "storage", group: "storage.k8s.io", version: "v1", kind: "CSINode", namespaced: false },

  // rbac.authorization.k8s.io/v1
  { key: "roles", api: "rbac", group: "rbac.authorization.k8s.io", version: "v1", kind: "Role", namespaced: true },
  { key: "rolebindings", api: "rbac", group: "rbac.authorization.k8s.io", version: "v1", kind: "RoleBinding", namespaced: true },
  { key: "clusterroles", api: "rbac", group: "rbac.authorization.k8s.io", version: "v1", kind: "ClusterRole", namespaced: false },
  { key: "clusterrolebindings", api: "rbac", group: "rbac.authorization.k8s.io", version: "v1", kind: "ClusterRoleBinding", namespaced: false },

  // autoscaling/v2
  { key: "horizontalpodautoscalers", api: "autoscaling", group: "autoscaling", version: "v2", kind: "HorizontalPodAutoscaler", namespaced: true },

  // scheduling.k8s.io/v1
  { key: "priorityclasses", api: "scheduling", group: "scheduling.k8s.io", version: "v1", kind: "PriorityClass", plural: "priorityclasses", namespaced: false },

  // apiextensions.k8s.io/v1
  { key: "customresourcedefinitions", api: "extensions", group: "apiextensions.k8s.io", version: "v1", kind: "CustomResourceDefinition", namespaced: false },
];

export const RESOURCE_BY_KEY = new Map(RESOURCES.map((r) => [r.key, r]));

const BY_API_KIND = new Map(RESOURCES.map((r) => [`${r.api}/${r.kind}`, r]));

export function getResource(key) {
  return RESOURCE_BY_KEY.get(key) ?? null;
}

export function getResourceByApiKind(api, kind) {
  return BY_API_KIND.get(`${api}/${kind}`) ?? null;
}

export function listResourceKeys() {
  return RESOURCES.map((r) => r.key);
}

export function plural(resource) {
  return resource.plural ?? resource.key;
}

// Collection path for LIST/WATCH. `namespace` narrows a namespaced resource to one namespace.
export function collectionPath(resource, namespace) {
  const base = resource.group ? `/apis/${resource.group}/${resource.version}` : `/api/${resource.version}`;
  if (resource.namespaced && namespace) return `${base}/namespaces/${encodeURIComponent(namespace)}/${plural(resource)}`;
  return `${base}/${plural(resource)}`;
}

export function apiVersionOf(resource) {
  return resource.group ? `${resource.group}/${resource.version}` : resource.version;
}

const LAST_APPLIED = "kubectl.kubernetes.io/last-applied-configuration";

// Trims what the UI never reads before an object enters the cache. managedFields is
// routinely the largest part of an object; last-applied duplicates the spec.
export function makeTransform(resource) {
  return (obj) => {
    if (!obj || typeof obj !== "object") return obj;
    const metadata = { ...obj.metadata };
    delete metadata.managedFields;
    if (metadata.annotations?.[LAST_APPLIED]) {
      const { [LAST_APPLIED]: _omit, ...rest } = metadata.annotations;
      metadata.annotations = rest;
    }
    // Watch events carry apiVersion/kind but LIST items don't; store neither so cached
    // lists look exactly like API-server lists (cached reads add them back).
    const { apiVersion: _v, kind: _k, ...rest } = obj;
    const out = { ...rest, metadata };
    if (resource.stripSecretData) {
      if (obj.data) out.data = Object.fromEntries(Object.keys(obj.data).map((k) => [k, ""]));
      if (obj.stringData) delete out.stringData;
    }
    return deepFreeze(out);
  };
}

// Cached objects are shared by every request that reads them, so they are frozen:
// an accidental in-place mutation throws instead of silently corrupting the cache.
export function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}
