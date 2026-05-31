export const KIND_COLOR = {
  Pod: "#6366f1",
  Deployment: "#3b82f6",
  ReplicaSet: "#60a5fa",
  StatefulSet: "#8b5cf6",
  DaemonSet: "#06b6d4",
  Job: "#0ea5e9",
  CronJob: "#38bdf8",
  ReplicationController: "#7dd3fc",
  Service: "#10b981",
  Ingress: "#22c55e",
  IngressClass: "#4ade80",
  Endpoints: "#86efac",
  NetworkPolicy: "#34d399",
  ConfigMap: "#f59e0b",
  Secret: "#a855f7",
  ServiceAccount: "#f97316",
  PersistentVolumeClaim: "#c084fc",
  PersistentVolume: "#7c3aed",
  StorageClass: "#64748b",
  HorizontalPodAutoscaler: "#ec4899",
  Role: "#f43f5e",
  ClusterRole: "#dc2626",
  RoleBinding: "#fb7185",
  ClusterRoleBinding: "#f87171",
  Node: "#94a3b8",
  Namespace: "#334155",
};

export const KIND_BG = Object.fromEntries(
  Object.entries(KIND_COLOR).map(([k, v]) => [k, v + "18"])
);

export function kindRoute(kind, namespace, name) {
  const routeMap = {
    Pod: `/workloads/pods/${namespace}/${name}`,
    Deployment: `/workloads/deployments/${namespace}/${name}`,
    ReplicaSet: `/workloads/replicasets/${namespace}/${name}`,
    StatefulSet: `/workloads/statefulsets/${namespace}/${name}`,
    DaemonSet: `/workloads/daemonsets/${namespace}/${name}`,
    Job: `/workloads/jobs/${namespace}/${name}`,
    CronJob: `/workloads/cronjobs/${namespace}/${name}`,
    Service: `/network/services/${namespace}/${name}`,
    Ingress: `/network/ingresses/${namespace}/${name}`,
    ConfigMap: `/configuration/configmaps/${namespace}/${name}`,
    Secret: `/configuration/secrets/${namespace}/${name}`,
    ServiceAccount: `/access-control/serviceaccounts/${namespace}/${name}`,
    Role: `/access-control/roles/${namespace}/${name}`,
    ClusterRole: `/access-control/clusterroles/${name}`,
    ClusterRoleBinding: `/access-control/clusterrolebindings/${name}`,
    HorizontalPodAutoscaler: `/advanced/hpa/${namespace}/${name}`,
    PersistentVolumeClaim: `/storage/persistentvolumeclaims/${namespace}/${name}`,
    PersistentVolume: `/storage/persistentvolumes/${name}`,
    StorageClass: `/storage/storageclasses/${name}`,
    Node: `/cluster/nodes/${name}`,
    Namespace: `/cluster/namespaces/${name}`,
  };
  return routeMap[kind] ?? null;
}

export const EDGE_STYLE = {
  owns: { style: "solid", color: "#64748b", animated: false },
  selects: { style: "dashed", color: "#10b981", animated: true },
  routes_to: { style: "solid", color: "#22c55e", animated: false },
  references: { style: "dotted", color: "#f59e0b", animated: false },
  mounts: { style: "dotted", color: "#a855f7", animated: false },
  storage: { style: "solid", color: "#7c3aed", animated: false },
  scheduled_on: { style: "dotted", color: "#94a3b8", animated: false },
  scales: { style: "dashed", color: "#ec4899", animated: false },
};
