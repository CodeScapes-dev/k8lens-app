// Where each detail-page `type` should send you back to once its object is gone. Hand-verified
// against the app/ directory tree (one entry per real page under app/**/page.jsx), not derived —
// resource URL segments don't follow a single predictable rule across sections. "priorityclass"
// and "csr" have detail-route handlers but no actual page anywhere in the app, so they're not
// listed here; "helm" has a detail page but uses useK8sResource, not useK8sDetail, so it isn't
// part of this mechanism (see components/detail/ResourceDeletedDialog.jsx's comment).
export const DETAIL_TYPE_TO_LIST = {
  pod: { href: "/workloads/pods", label: "Pods" },
  deployment: { href: "/workloads/deployments", label: "Deployments" },
  statefulset: { href: "/workloads/statefulsets", label: "StatefulSets" },
  daemonset: { href: "/workloads/daemonsets", label: "DaemonSets" },
  replicaset: { href: "/workloads/replicasets", label: "ReplicaSets" },
  replicationcontroller: { href: "/workloads/replicationcontrollers", label: "Replication Controllers" },
  job: { href: "/workloads/jobs", label: "Jobs" },
  cronjob: { href: "/workloads/cronjobs", label: "CronJobs" },
  configmap: { href: "/configuration/configmaps", label: "ConfigMaps" },
  secret: { href: "/configuration/secrets", label: "Secrets" },
  resourcequota: { href: "/configuration/resourcequotas", label: "Resource Quotas" },
  limitrange: { href: "/configuration/limitranges", label: "Limit Ranges" },
  service: { href: "/network/services", label: "Services" },
  endpoints: { href: "/network/endpoints", label: "Endpoints" },
  ingress: { href: "/network/ingresses", label: "Ingresses" },
  ingressclass: { href: "/network/ingressclasses", label: "Ingress Classes" },
  networkpolicy: { href: "/network/networkpolicies", label: "Network Policies" },
  pv: { href: "/storage/persistentvolumes", label: "Persistent Volumes" },
  pvc: { href: "/storage/persistentvolumeclaims", label: "Persistent Volume Claims" },
  storageclass: { href: "/storage/storageclasses", label: "Storage Classes" },
  serviceaccount: { href: "/access-control/serviceaccounts", label: "Service Accounts" },
  role: { href: "/access-control/roles", label: "Roles" },
  rolebinding: { href: "/access-control/rolebindings", label: "Role Bindings" },
  clusterrole: { href: "/access-control/clusterroles", label: "Cluster Roles" },
  clusterrolebinding: { href: "/access-control/clusterrolebindings", label: "Cluster Role Bindings" },
  node: { href: "/cluster/nodes", label: "Nodes" },
  namespace: { href: "/cluster/namespaces", label: "Namespaces" },
  hpa: { href: "/advanced/hpa", label: "Autoscalers" },
  crd: { href: "/advanced/customresourcedefinitions", label: "Custom Resource Definitions" },
};
