/**
 * Navigation structure for the K8Lens sidebar.
 * `icon` values are lucide-react component names resolved in nav-drawer.jsx.
 */
export const navigation = [
  {
    label: "Workloads",
    icon: "Boxes",
    href: "/workloads",
    items: [
      { href: "/workloads/pods", label: "Pods", icon: "Box" },
      { href: "/workloads/deployments", label: "Deployments", icon: "Layers" },
      { href: "/workloads/statefulsets", label: "StatefulSets", icon: "Database" },
      { href: "/workloads/daemonsets", label: "DaemonSets", icon: "Cpu" },
      { href: "/workloads/replicasets", label: "ReplicaSets", icon: "GitBranch" },
      { href: "/workloads/replicationcontrollers", label: "Replication Controllers", icon: "Repeat" },
      { href: "/workloads/jobs", label: "Jobs", icon: "Zap" },
      { href: "/workloads/cronjobs", label: "CronJobs", icon: "Clock" },
    ],
  },
  {
    label: "Configuration",
    icon: "Settings",
    href: "/configuration",
    items: [
      { href: "/configuration/configmaps", label: "ConfigMaps", icon: "FileText" },
      { href: "/configuration/secrets", label: "Secrets", icon: "Key" },
      { href: "/configuration/resourcequotas", label: "Resource Quotas", icon: "Gauge" },
      { href: "/configuration/limitranges", label: "Limit Ranges", icon: "SlidersHorizontal" },
    ],
  },
  {
    label: "Network",
    icon: "Network",
    href: "/network",
    items: [
      { href: "/network/services", label: "Services", icon: "Server" },
      { href: "/network/ingresses", label: "Ingresses", icon: "Globe" },
      { href: "/network/ingressclasses", label: "Ingress Classes", icon: "GlobeLock" },
      { href: "/network/networkpolicies", label: "Network Policies", icon: "ShieldCheck" },
      { href: "/network/endpoints", label: "Endpoints", icon: "Plug" },
    ],
  },
  {
    label: "Storage",
    icon: "HardDrive",
    href: "/storage",
    items: [
      { href: "/storage/persistentvolumes", label: "Persistent Volumes", icon: "Database" },
      { href: "/storage/persistentvolumeclaims", label: "PV Claims", icon: "HardDrive" },
      { href: "/storage/storageclasses", label: "Storage Classes", icon: "FolderTree" },
    ],
  },
  {
    label: "Access Control",
    icon: "Lock",
    href: "/access-control",
    items: [
      { href: "/access-control/serviceaccounts", label: "Service Accounts", icon: "Users" },
      { href: "/access-control/roles", label: "Roles", icon: "Shield" },
      { href: "/access-control/rolebindings", label: "Role Bindings", icon: "Link2" },
      { href: "/access-control/clusterroles", label: "Cluster Roles", icon: "ShieldCheck" },
      { href: "/access-control/clusterrolebindings", label: "Cluster Role Bindings", icon: "Link" },
    ],
  },
  {
    label: "Cluster",
    icon: "Cloud",
    href: "/cluster",
    items: [
      { href: "/cluster/nodes", label: "Nodes", icon: "Server" },
      { href: "/cluster/namespaces", label: "Namespaces", icon: "FolderTree" },
      { href: "/cluster/events", label: "Events", icon: "Activity" },
    ],
  },
  {
    label: "Advanced",
    icon: "Workflow",
    href: "/advanced",
    items: [
      { href: "/advanced/hpa", label: "Autoscalers (HPA)", icon: "Gauge" },
      { href: "/advanced/customresourcedefinitions", label: "Custom Resource Definitions", icon: "Boxes" },
      { href: "/advanced/relationships", label: "Resource Graph", icon: "Workflow" },
    ],
  },
];
