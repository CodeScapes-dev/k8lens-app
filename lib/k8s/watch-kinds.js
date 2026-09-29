// Pure data, no server-only imports (no crypto, no @kubernetes/client-node) — safe to import from
// both server code (lib/k8s/watch-manager.js) and client components/hooks. Single source of truth
// for "which kind names are watchable"; lib/k8s/watch-manager.js separately defines each kind's
// REST path and list function (those need real API client calls, which belong server-side only).
// watch-manager.test.js asserts these two lists stay in sync.
//
// `apiGroup` matches the first argument callers pass to useK8sResource(apiGroup, resource, ...),
// i.e. the app/api/k8s/<apiGroup>/route.jsx that serves it.
export const WATCH_KINDS = {
  // core
  pods: { apiGroup: "core", scope: "namespaced" },
  services: { apiGroup: "core", scope: "namespaced" },
  configmaps: { apiGroup: "core", scope: "namespaced" },
  secrets: { apiGroup: "core", scope: "namespaced" },
  persistentvolumeclaims: { apiGroup: "core", scope: "namespaced" },
  replicationcontrollers: { apiGroup: "core", scope: "namespaced" },
  resourcequotas: { apiGroup: "core", scope: "namespaced" },
  limitranges: { apiGroup: "core", scope: "namespaced" },
  endpoints: { apiGroup: "core", scope: "namespaced" },
  serviceaccounts: { apiGroup: "core", scope: "namespaced" },
  namespaces: { apiGroup: "core", scope: "cluster" },
  nodes: { apiGroup: "core", scope: "cluster" },
  persistentvolumes: { apiGroup: "core", scope: "cluster" },
  // events (its own route, apiGroup "events")
  events: { apiGroup: "events", scope: "namespaced" },
  // apps
  deployments: { apiGroup: "apps", scope: "namespaced" },
  statefulsets: { apiGroup: "apps", scope: "namespaced" },
  daemonsets: { apiGroup: "apps", scope: "namespaced" },
  replicasets: { apiGroup: "apps", scope: "namespaced" },
  // batch
  jobs: { apiGroup: "batch", scope: "namespaced" },
  cronjobs: { apiGroup: "batch", scope: "namespaced" },
  // networking
  ingresses: { apiGroup: "networking", scope: "namespaced" },
  ingressclasses: { apiGroup: "networking", scope: "cluster" },
  networkpolicies: { apiGroup: "networking", scope: "namespaced" },
  // rbac
  clusterroles: { apiGroup: "rbac", scope: "cluster" },
  clusterrolebindings: { apiGroup: "rbac", scope: "cluster" },
  roles: { apiGroup: "rbac", scope: "namespaced" },
  rolebindings: { apiGroup: "rbac", scope: "namespaced" },
  // scheduling (its own route, apiGroup "scheduling", no resource param)
  priorityclasses: { apiGroup: "scheduling", scope: "cluster" },
  // storage
  storageclasses: { apiGroup: "storage", scope: "cluster" },
  volumeattachments: { apiGroup: "storage", scope: "cluster" },
  csidrivers: { apiGroup: "storage", scope: "cluster" },
  csinodes: { apiGroup: "storage", scope: "cluster" },
  // autoscaling (its own route, apiGroup "autoscaling", no resource param)
  horizontalpodautoscalers: { apiGroup: "autoscaling", scope: "namespaced" },
  // apiextensions (its own route, apiGroup "crds", no resource param)
  customresourcedefinitions: { apiGroup: "crds", scope: "cluster" },
};

// Detail route `type` param (singular, e.g. "pod") -> WATCH_KINDS key (plural, e.g. "pods").
// Deliberately excludes "csr": app/api/k8s/detail/route.jsx's csr handler uses
// clients.certificates, which getClientsFromRequest doesn't currently construct — a pre-existing
// gap unrelated to this migration, left untouched.
export const DETAIL_TYPE_TO_KIND = {
  pod: "pods",
  deployment: "deployments",
  statefulset: "statefulsets",
  daemonset: "daemonsets",
  replicaset: "replicasets",
  replicationcontroller: "replicationcontrollers",
  job: "jobs",
  cronjob: "cronjobs",
  node: "nodes",
  namespace: "namespaces",
  configmap: "configmaps",
  secret: "secrets",
  resourcequota: "resourcequotas",
  limitrange: "limitranges",
  service: "services",
  endpoints: "endpoints",
  ingress: "ingresses",
  ingressclass: "ingressclasses",
  networkpolicy: "networkpolicies",
  pv: "persistentvolumes",
  pvc: "persistentvolumeclaims",
  storageclass: "storageclasses",
  role: "roles",
  rolebinding: "rolebindings",
  clusterrole: "clusterroles",
  clusterrolebinding: "clusterrolebindings",
  serviceaccount: "serviceaccounts",
  hpa: "horizontalpodautoscalers",
  priorityclass: "priorityclasses",
  crd: "customresourcedefinitions",
};
