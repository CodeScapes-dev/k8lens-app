/**
 * Per-resource K8s descriptions, metadata, and page context.
 * Keyed by the resource kind (lowercase, plural) matching page context.
 */
export const RESOURCE_INFO = {
  statefulsets: {
    kind: "StatefulSet",
    shortName: "sts",
    apiVersion: "apps/v1",
    scope: "Namespaced",
    description:
      "A StatefulSet manages the deployment and scaling of a set of Pods with guaranteed ordering, stable network identities, and persistent storage. Each Pod gets a persistent hostname (e.g. web-0, web-1) that survives rescheduling — making StatefulSets ideal for workloads that require durable state.",
    details: [
      { label: "API Version", value: "apps/v1" },
      { label: "Kind", value: "StatefulSet" },
      { label: "Short name", value: "sts" },
      { label: "Scope", value: "Namespaced" },
      { label: "Update strategy", value: "RollingUpdate / OnDelete" },
    ],
    useCases: [
      "Databases — MySQL, PostgreSQL, MongoDB",
      "Distributed systems — Kafka, ZooKeeper, etcd",
      "Apps needing stable DNS hostnames",
    ],
    pageContext:
      "This listing page shows all StatefulSet resources across your cluster. Each row represents one StatefulSet — you can filter by namespace, sort by name or age, and click any row to drill into replica status, pod health, volume claims, and rollout history.",
    docsUrl: "https://kubernetes.io/docs/concepts/workloads/controllers/statefulset/",
  },

  deployments: {
    kind: "Deployment",
    shortName: "deploy",
    apiVersion: "apps/v1",
    scope: "Namespaced",
    description:
      "A Deployment provides declarative updates for Pods and ReplicaSets. You describe a desired state and the Deployment controller changes the actual state toward that desired state at a controlled rate. Deployments support rolling updates, rollbacks, and scaling.",
    details: [
      { label: "API Version", value: "apps/v1" },
      { label: "Kind", value: "Deployment" },
      { label: "Short name", value: "deploy" },
      { label: "Scope", value: "Namespaced" },
      { label: "Update strategy", value: "RollingUpdate / Recreate" },
    ],
    useCases: [
      "Stateless web servers and APIs",
      "Background workers and microservices",
      "Any workload that can tolerate Pod rescheduling",
    ],
    pageContext:
      "This listing page shows all Deployment resources. Each row reflects the desired vs. ready replica count. Click any Deployment to inspect its ReplicaSets, Pod health, resource usage, rollout history, and blast radius.",
    docsUrl: "https://kubernetes.io/docs/concepts/workloads/controllers/deployment/",
  },

  daemonsets: {
    kind: "DaemonSet",
    shortName: "ds",
    apiVersion: "apps/v1",
    scope: "Namespaced",
    description:
      "A DaemonSet ensures that a copy of a Pod runs on every (or selected) node in the cluster. As nodes are added, Pods are added automatically; as nodes are removed, those Pods are garbage collected.",
    details: [
      { label: "API Version", value: "apps/v1" },
      { label: "Kind", value: "DaemonSet" },
      { label: "Short name", value: "ds" },
      { label: "Scope", value: "Namespaced" },
      { label: "Update strategy", value: "RollingUpdate / OnDelete" },
    ],
    useCases: [
      "Node monitoring agents (Prometheus node-exporter)",
      "Log collectors (Fluentd, Filebeat)",
      "Network plugins (Calico, Cilium)",
    ],
    pageContext:
      "This listing page shows all DaemonSet resources. The desired, ready, and available counts reflect per-node Pod scheduling status. Click any row to see which nodes are running the Pods and inspect container specs.",
    docsUrl: "https://kubernetes.io/docs/concepts/workloads/controllers/daemonset/",
  },

  replicasets: {
    kind: "ReplicaSet",
    shortName: "rs",
    apiVersion: "apps/v1",
    scope: "Namespaced",
    description:
      "A ReplicaSet maintains a stable set of replica Pods running at any given time. It is most commonly used by Deployments as a mechanism to orchestrate rolling updates. You rarely create ReplicaSets directly — Deployments manage them for you.",
    details: [
      { label: "API Version", value: "apps/v1" },
      { label: "Kind", value: "ReplicaSet" },
      { label: "Short name", value: "rs" },
      { label: "Scope", value: "Namespaced" },
    ],
    useCases: [
      "Managed automatically by Deployments",
      "Rollout history — each revision is a ReplicaSet",
      "Custom controllers that need replica guarantees",
    ],
    pageContext:
      "This listing page shows all ReplicaSet resources, including those owned by Deployments. Most rows will have an owner reference pointing to a parent Deployment. Click any row to inspect pods, owner chain, and container specs.",
    docsUrl: "https://kubernetes.io/docs/concepts/workloads/controllers/replicaset/",
  },

  pods: {
    kind: "Pod",
    shortName: "po",
    apiVersion: "v1",
    scope: "Namespaced",
    description:
      "A Pod is the smallest deployable unit in Kubernetes — a group of one or more containers that share storage, network, and a specification for how to run. Pods are ephemeral: they are created, scheduled to a node, and replaced when they fail.",
    details: [
      { label: "API Version", value: "v1" },
      { label: "Kind", value: "Pod" },
      { label: "Short name", value: "po" },
      { label: "Scope", value: "Namespaced" },
    ],
    useCases: [
      "Running container workloads on a node",
      "Short-lived tasks (Jobs, CronJobs)",
      "Sidecar patterns — logging, proxies",
    ],
    pageContext:
      "This listing page shows all Pod resources. Pods are usually managed by a higher-level controller (Deployment, StatefulSet, Job). You can filter by namespace, inspect restart counts, and click any Pod to view logs, container status, and resource metrics.",
    docsUrl: "https://kubernetes.io/docs/concepts/workloads/pods/",
  },

  jobs: {
    kind: "Job",
    shortName: "job",
    apiVersion: "batch/v1",
    scope: "Namespaced",
    description:
      "A Job creates one or more Pods and retries execution until a specified number of them successfully terminate. Jobs track successful completions and can run Pods in parallel.",
    details: [
      { label: "API Version", value: "batch/v1" },
      { label: "Kind", value: "Job" },
      { label: "Short name", value: "job" },
      { label: "Scope", value: "Namespaced" },
    ],
    useCases: [
      "One-time data migrations",
      "Batch processing pipelines",
      "Database seeding and cleanup tasks",
    ],
    pageContext:
      "This listing page shows all Job resources. Each row shows completion status and duration. Click any Job to see its Pods, execution timeline, and owner (CronJob, if any).",
    docsUrl: "https://kubernetes.io/docs/concepts/workloads/controllers/job/",
  },

  cronjobs: {
    kind: "CronJob",
    shortName: "cj",
    apiVersion: "batch/v1",
    scope: "Namespaced",
    description:
      "A CronJob creates Jobs on a repeating schedule using a cron expression. It is useful for periodic and recurring tasks — backups, report generation, or routine cleanup.",
    details: [
      { label: "API Version", value: "batch/v1" },
      { label: "Kind", value: "CronJob" },
      { label: "Short name", value: "cj" },
      { label: "Scope", value: "Namespaced" },
    ],
    useCases: [
      "Scheduled database backups",
      "Periodic report generation",
      "Cache invalidation and cleanup",
    ],
    pageContext:
      "This listing page shows all CronJob resources with their schedule expression and suspension status. Click any row to inspect the job history and container template.",
    docsUrl: "https://kubernetes.io/docs/concepts/workloads/controllers/cron-jobs/",
  },

  services: {
    kind: "Service",
    shortName: "svc",
    apiVersion: "v1",
    scope: "Namespaced",
    description:
      "A Service is an abstraction that exposes a set of Pods as a stable network endpoint. Services provide load balancing and service discovery, decoupling consumers from the actual Pods running a workload.",
    details: [
      { label: "API Version", value: "v1" },
      { label: "Kind", value: "Service" },
      { label: "Short name", value: "svc" },
      { label: "Scope", value: "Namespaced" },
      { label: "Types", value: "ClusterIP, NodePort, LoadBalancer, ExternalName" },
    ],
    useCases: [
      "Internal cluster-DNS routing (ClusterIP)",
      "External load balancers (LoadBalancer)",
      "Node-level port exposure (NodePort)",
    ],
    pageContext:
      "This listing page shows all Service resources. The type and port columns summarise how traffic reaches each service. Click any row to inspect selectors, endpoints, and ingress routes.",
    docsUrl: "https://kubernetes.io/docs/concepts/services-networking/service/",
  },

  configmaps: {
    kind: "ConfigMap",
    shortName: "cm",
    apiVersion: "v1",
    scope: "Namespaced",
    description:
      "A ConfigMap stores non-confidential configuration data as key-value pairs. Pods can consume ConfigMaps as environment variables, command-line arguments, or configuration files in a volume.",
    details: [
      { label: "API Version", value: "v1" },
      { label: "Kind", value: "ConfigMap" },
      { label: "Short name", value: "cm" },
      { label: "Scope", value: "Namespaced" },
    ],
    useCases: [
      "Application configuration (env vars, config files)",
      "Nginx / app server config injection",
      "Feature flags and environment-specific settings",
    ],
    pageContext:
      "This listing page shows all ConfigMap resources. The keys column reflects how many data entries each ConfigMap holds. Click any row to inspect individual keys and their values.",
    docsUrl: "https://kubernetes.io/docs/concepts/configuration/configmap/",
  },

  secrets: {
    kind: "Secret",
    shortName: "secret",
    apiVersion: "v1",
    scope: "Namespaced",
    description:
      "A Secret stores sensitive data such as passwords, tokens, and TLS certificates. Like ConfigMaps, Secrets can be mounted as volumes or exposed as environment variables — but their values are base64-encoded and access can be restricted via RBAC.",
    details: [
      { label: "API Version", value: "v1" },
      { label: "Kind", value: "Secret" },
      { label: "Short name", value: "—" },
      { label: "Scope", value: "Namespaced" },
      { label: "Types", value: "Opaque, TLS, docker-registry, …" },
    ],
    useCases: [
      "Database credentials and API keys",
      "TLS certificates for ingress",
      "Image pull secrets for private registries",
    ],
    pageContext:
      "This listing page shows all Secret resources. Values are not displayed — click any row to see metadata, keys (not values), and which workloads reference the Secret.",
    docsUrl: "https://kubernetes.io/docs/concepts/configuration/secret/",
  },

  nodes: {
    kind: "Node",
    shortName: "no",
    apiVersion: "v1",
    scope: "Cluster-scoped",
    description:
      "A Node is a worker machine in Kubernetes — either a VM or a physical machine. Each Node runs Pods and is managed by the control plane. Nodes contain the kubelet, container runtime, and kube-proxy.",
    details: [
      { label: "API Version", value: "v1" },
      { label: "Kind", value: "Node" },
      { label: "Short name", value: "no" },
      { label: "Scope", value: "Cluster-scoped" },
    ],
    useCases: [
      "Scheduling workloads across the cluster",
      "Node-level resource capacity planning",
      "Taints and tolerations for workload isolation",
    ],
    pageContext:
      "This listing page shows all Node resources in the cluster. You can inspect each node's OS, architecture, Kubernetes version, and ready status. Click any row to see running Pods, resource utilisation, and conditions.",
    docsUrl: "https://kubernetes.io/docs/concepts/architecture/nodes/",
  },

  namespaces: {
    kind: "Namespace",
    shortName: "ns",
    apiVersion: "v1",
    scope: "Cluster-scoped",
    description:
      "Namespaces provide a mechanism to isolate groups of resources within a single cluster. Names of resources must be unique within a namespace, but not across namespaces. They are useful in environments with many users spread across multiple teams or projects.",
    details: [
      { label: "API Version", value: "v1" },
      { label: "Kind", value: "Namespace" },
      { label: "Short name", value: "ns" },
      { label: "Scope", value: "Cluster-scoped" },
    ],
    useCases: [
      "Isolating environments (dev, staging, prod)",
      "Multi-tenant cluster resource separation",
      "Scoping RBAC and network policies",
    ],
    pageContext:
      "This listing page shows all Namespace resources in the cluster. Click any row to see the workloads, services, and config objects living inside that namespace.",
    docsUrl: "https://kubernetes.io/docs/concepts/overview/working-with-objects/namespaces/",
  },

  persistentvolumes: {
    kind: "PersistentVolume",
    shortName: "pv",
    apiVersion: "v1",
    scope: "Cluster-scoped",
    description:
      "A PersistentVolume (PV) is a piece of storage in the cluster provisioned by an administrator or dynamically by a StorageClass. PVs have a lifecycle independent of any individual Pod that uses them.",
    details: [
      { label: "API Version", value: "v1" },
      { label: "Kind", value: "PersistentVolume" },
      { label: "Short name", value: "pv" },
      { label: "Scope", value: "Cluster-scoped" },
    ],
    useCases: [
      "Durable block storage for stateful workloads",
      "Shared file system volumes (NFS, EFS)",
      "Database data directories",
    ],
    pageContext:
      "This listing page shows all PersistentVolume resources. Capacity, access mode, reclaim policy, and binding status are shown per volume. Click any row to see the bound PVC and storage source.",
    docsUrl: "https://kubernetes.io/docs/concepts/storage/persistent-volumes/",
  },

  persistentvolumeclaims: {
    kind: "PersistentVolumeClaim",
    shortName: "pvc",
    apiVersion: "v1",
    scope: "Namespaced",
    description:
      "A PersistentVolumeClaim (PVC) is a request for storage by a user. It is similar to a Pod — Pods consume node resources, PVCs consume PV resources. PVCs can request specific size and access modes.",
    details: [
      { label: "API Version", value: "v1" },
      { label: "Kind", value: "PersistentVolumeClaim" },
      { label: "Short name", value: "pvc" },
      { label: "Scope", value: "Namespaced" },
    ],
    useCases: [
      "Requesting storage for StatefulSet Pods",
      "Provisioning volumes dynamically via StorageClass",
      "Sharing volumes between containers in a Pod",
    ],
    pageContext:
      "This listing page shows all PersistentVolumeClaim resources. Bound status means a matching PV has been found. Click any row to see which Pods are mounting the claim.",
    docsUrl: "https://kubernetes.io/docs/concepts/storage/persistent-volumes/#persistentvolumeclaims",
  },

  ingresses: {
    kind: "Ingress",
    shortName: "ing",
    apiVersion: "networking.k8s.io/v1",
    scope: "Namespaced",
    description:
      "An Ingress manages external HTTP/HTTPS access to Services in a cluster. It provides load balancing, SSL termination, and name-based virtual hosting. Requires an Ingress controller to be running.",
    details: [
      { label: "API Version", value: "networking.k8s.io/v1" },
      { label: "Kind", value: "Ingress" },
      { label: "Short name", value: "ing" },
      { label: "Scope", value: "Namespaced" },
    ],
    useCases: [
      "Exposing HTTP services with custom domains",
      "TLS termination and certificate management",
      "Path-based routing to multiple services",
    ],
    pageContext:
      "This listing page shows all Ingress resources. Click any row to inspect routing rules, TLS configuration, and backend services.",
    docsUrl: "https://kubernetes.io/docs/concepts/services-networking/ingress/",
  },

  endpoints: {
    kind: "Endpoints",
    shortName: "ep",
    apiVersion: "v1",
    scope: "Namespaced",
    description:
      "Endpoints expose the IP addresses and ports of Pods that back a Service. They are automatically managed by Kubernetes when a Service selector matches running Pods.",
    details: [
      { label: "API Version", value: "v1" },
      { label: "Kind", value: "Endpoints" },
      { label: "Short name", value: "ep" },
      { label: "Scope", value: "Namespaced" },
    ],
    useCases: [
      "Inspecting which Pod IPs back a Service",
      "Debugging connectivity and selector mismatches",
      "Custom endpoint slices for external services",
    ],
    pageContext:
      "This listing page shows all Endpoints objects. Each Endpoints object is named after its parent Service and lists the ready Pod IPs. Click any row to see the backing addresses and ports.",
    docsUrl: "https://kubernetes.io/docs/concepts/services-networking/service/#endpoints",
  },

  networkpolicies: {
    kind: "NetworkPolicy",
    shortName: "netpol",
    apiVersion: "networking.k8s.io/v1",
    scope: "Namespaced",
    description:
      "A NetworkPolicy specifies how groups of Pods are allowed to communicate with each other and with external endpoints. By default, Pods are non-isolated and accept all traffic. Requires a network plugin that supports NetworkPolicy (e.g. Calico, Cilium).",
    details: [
      { label: "API Version", value: "networking.k8s.io/v1" },
      { label: "Kind", value: "NetworkPolicy" },
      { label: "Short name", value: "netpol" },
      { label: "Scope", value: "Namespaced" },
    ],
    useCases: [
      "Restricting inter-namespace traffic",
      "Isolating sensitive workloads",
      "Zero-trust network segmentation",
    ],
    pageContext:
      "This listing page shows all NetworkPolicy resources. Each policy targets a set of Pods via selectors and defines allowed ingress and egress rules. Click any row to inspect selectors and rules.",
    docsUrl: "https://kubernetes.io/docs/concepts/services-networking/network-policies/",
  },

  ingressclasses: {
    kind: "IngressClass",
    shortName: "ingressclass",
    apiVersion: "networking.k8s.io/v1",
    scope: "Cluster-scoped",
    description:
      "An IngressClass identifies which Ingress controller should handle an Ingress resource. A cluster can have multiple Ingress controllers and IngressClasses let you direct Ingress objects to the right one.",
    details: [
      { label: "API Version", value: "networking.k8s.io/v1" },
      { label: "Kind", value: "IngressClass" },
      { label: "Short name", value: "ingressclass" },
      { label: "Scope", value: "Cluster-scoped" },
    ],
    useCases: [
      "Routing Ingress resources to specific controllers",
      "Running multiple ingress controllers side-by-side",
      "Setting a default IngressClass for the cluster",
    ],
    pageContext:
      "This listing page shows all IngressClass resources. The controller field identifies which ingress implementation handles Ingresses referencing this class.",
    docsUrl: "https://kubernetes.io/docs/concepts/services-networking/ingress/#ingress-class",
  },

  limitranges: {
    kind: "LimitRange",
    shortName: "limits",
    apiVersion: "v1",
    scope: "Namespaced",
    description:
      "A LimitRange enforces minimum and maximum resource constraints on Pods, containers, and PersistentVolumeClaims within a namespace. It can also set default request and limit values when none are specified.",
    details: [
      { label: "API Version", value: "v1" },
      { label: "Kind", value: "LimitRange" },
      { label: "Short name", value: "limits" },
      { label: "Scope", value: "Namespaced" },
    ],
    useCases: [
      "Setting default CPU/memory requests for containers",
      "Preventing runaway resource consumption",
      "Enforcing minimum resource guarantees",
    ],
    pageContext:
      "This listing page shows all LimitRange resources per namespace. Click any row to see the constraint types and limits applied to workloads in that namespace.",
    docsUrl: "https://kubernetes.io/docs/concepts/policy/limit-range/",
  },

  resourcequotas: {
    kind: "ResourceQuota",
    shortName: "quota",
    apiVersion: "v1",
    scope: "Namespaced",
    description:
      "A ResourceQuota sets aggregate resource consumption limits for a namespace — capping the total CPU, memory, and object count that all workloads in a namespace can request.",
    details: [
      { label: "API Version", value: "v1" },
      { label: "Kind", value: "ResourceQuota" },
      { label: "Short name", value: "quota" },
      { label: "Scope", value: "Namespaced" },
    ],
    useCases: [
      "Multi-tenant resource governance",
      "Preventing one team from exhausting cluster resources",
      "Quota enforcement per environment (dev, staging, prod)",
    ],
    pageContext:
      "This listing page shows all ResourceQuota objects. Each row shows used vs. hard limits across CPU, memory, and object counts. Click any row to see the full quota breakdown.",
    docsUrl: "https://kubernetes.io/docs/concepts/policy/resource-quotas/",
  },

  storageclasses: {
    kind: "StorageClass",
    shortName: "sc",
    apiVersion: "storage.k8s.io/v1",
    scope: "Cluster-scoped",
    description:
      "A StorageClass describes the 'class' of storage offered by the cluster — provisioner, reclaim policy, and parameters. PersistentVolumeClaims reference a StorageClass to dynamically provision matching PersistentVolumes.",
    details: [
      { label: "API Version", value: "storage.k8s.io/v1" },
      { label: "Kind", value: "StorageClass" },
      { label: "Short name", value: "sc" },
      { label: "Scope", value: "Cluster-scoped" },
    ],
    useCases: [
      "Dynamic PV provisioning (AWS EBS, GCE PD, Azure Disk)",
      "Differentiating SSD vs. HDD tiers",
      "Setting default storage for the cluster",
    ],
    pageContext:
      "This listing page shows all StorageClass resources. The provisioner and reclaim policy columns describe how volumes are created and cleaned up. A default StorageClass is used when PVCs omit the class.",
    docsUrl: "https://kubernetes.io/docs/concepts/storage/storage-classes/",
  },

  replicationcontrollers: {
    kind: "ReplicationController",
    shortName: "rc",
    apiVersion: "v1",
    scope: "Namespaced",
    description:
      "A ReplicationController (RC) ensures a specified number of Pod replicas are running at all times. It is the predecessor of ReplicaSets and Deployments and is rarely used in modern Kubernetes setups.",
    details: [
      { label: "API Version", value: "v1" },
      { label: "Kind", value: "ReplicationController" },
      { label: "Short name", value: "rc" },
      { label: "Scope", value: "Namespaced" },
    ],
    useCases: [
      "Legacy workload compatibility",
      "Simple replica management without rolling update support",
    ],
    pageContext:
      "This listing page shows all ReplicationController resources. Consider migrating to Deployments for rolling update and rollback support. Click any row to inspect replicas and Pod selectors.",
    docsUrl: "https://kubernetes.io/docs/concepts/workloads/controllers/replicationcontroller/",
  },

  events: {
    kind: "Event",
    shortName: "ev",
    apiVersion: "events.k8s.io/v1",
    scope: "Namespaced",
    description:
      "Events record state changes and notable occurrences in the cluster — Pod scheduling decisions, image pulls, container restarts, and more. They are short-lived (retained for ~1 hour by default) and are useful for debugging.",
    details: [
      { label: "API Version", value: "events.k8s.io/v1" },
      { label: "Kind", value: "Event" },
      { label: "Short name", value: "ev" },
      { label: "Scope", value: "Namespaced" },
      { label: "Retention", value: "~1 hour (default)" },
    ],
    useCases: [
      "Diagnosing Pod scheduling failures",
      "Tracking image pull and OOM errors",
      "Auditing resource lifecycle changes",
    ],
    pageContext:
      "This listing page shows cluster events filtered by namespace and type. Warning events typically indicate problems worth investigating. Click any event to see the full message and involved object.",
    docsUrl: "https://kubernetes.io/docs/reference/kubernetes-api/cluster-resources/event-v1/",
  },

  clusterroles: {
    kind: "ClusterRole",
    shortName: "cr",
    apiVersion: "rbac.authorization.k8s.io/v1",
    scope: "Cluster-scoped",
    description:
      "A ClusterRole defines a set of permissions across the entire cluster or for cluster-scoped resources. Unlike Roles, ClusterRoles can grant access to non-namespaced resources like Nodes and PersistentVolumes.",
    details: [
      { label: "API Version", value: "rbac.authorization.k8s.io/v1" },
      { label: "Kind", value: "ClusterRole" },
      { label: "Short name", value: "cr" },
      { label: "Scope", value: "Cluster-scoped" },
    ],
    useCases: [
      "Granting read access across all namespaces",
      "Defining permissions for cluster-level resources",
      "Reusable RBAC building blocks via aggregation rules",
    ],
    pageContext:
      "This listing page shows all ClusterRole resources. Many system roles are prefixed with 'system:'. Click any row to inspect the policy rules granted by that role.",
    docsUrl: "https://kubernetes.io/docs/reference/access-authn-authz/rbac/#role-and-clusterrole",
  },

  clusterrolebindings: {
    kind: "ClusterRoleBinding",
    shortName: "crb",
    apiVersion: "rbac.authorization.k8s.io/v1",
    scope: "Cluster-scoped",
    description:
      "A ClusterRoleBinding grants a ClusterRole to a subject (user, group, or service account) cluster-wide. It binds the permissions defined in a ClusterRole to principals across all namespaces.",
    details: [
      { label: "API Version", value: "rbac.authorization.k8s.io/v1" },
      { label: "Kind", value: "ClusterRoleBinding" },
      { label: "Short name", value: "crb" },
      { label: "Scope", value: "Cluster-scoped" },
    ],
    useCases: [
      "Granting cluster-admin to an operator service account",
      "Binding monitoring agents to read-only cluster roles",
      "Cross-namespace RBAC assignments",
    ],
    pageContext:
      "This listing page shows all ClusterRoleBinding resources, mapping subjects to ClusterRoles cluster-wide. Click any row to see which role is bound and to which subjects.",
    docsUrl: "https://kubernetes.io/docs/reference/access-authn-authz/rbac/#rolebinding-and-clusterrolebinding",
  },

  rolebindings: {
    kind: "RoleBinding",
    shortName: "rb",
    apiVersion: "rbac.authorization.k8s.io/v1",
    scope: "Namespaced",
    description:
      "A RoleBinding grants the permissions defined in a Role or ClusterRole to a subject within a specific namespace. It is the most common way to assign RBAC permissions scoped to one namespace.",
    details: [
      { label: "API Version", value: "rbac.authorization.k8s.io/v1" },
      { label: "Kind", value: "RoleBinding" },
      { label: "Short name", value: "rb" },
      { label: "Scope", value: "Namespaced" },
    ],
    useCases: [
      "Granting a team access to a specific namespace",
      "Binding a service account to a Role for workload access",
      "Namespace-scoped permission delegation",
    ],
    pageContext:
      "This listing page shows all RoleBinding resources. Each binding connects a subject (user, group, or service account) to a Role within a namespace. Click any row to see subjects and the referenced role.",
    docsUrl: "https://kubernetes.io/docs/reference/access-authn-authz/rbac/#rolebinding-and-clusterrolebinding",
  },

  roles: {
    kind: "Role",
    shortName: "role",
    apiVersion: "rbac.authorization.k8s.io/v1",
    scope: "Namespaced",
    description:
      "A Role defines a set of permissions within a specific namespace. It can only grant access to resources within that namespace. Use ClusterRole for cluster-wide or non-namespaced resource access.",
    details: [
      { label: "API Version", value: "rbac.authorization.k8s.io/v1" },
      { label: "Kind", value: "Role" },
      { label: "Short name", value: "role" },
      { label: "Scope", value: "Namespaced" },
    ],
    useCases: [
      "Scoped read-only access for developers in a namespace",
      "Granting a Pod permission to read ConfigMaps",
      "Least-privilege RBAC per team or application",
    ],
    pageContext:
      "This listing page shows all Role resources. Roles define what actions are permitted on which resource types within a namespace. Click any row to see the full list of policy rules.",
    docsUrl: "https://kubernetes.io/docs/reference/access-authn-authz/rbac/#role-and-clusterrole",
  },

  serviceaccounts: {
    kind: "ServiceAccount",
    shortName: "sa",
    apiVersion: "v1",
    scope: "Namespaced",
    description:
      "A ServiceAccount provides an identity for processes running in a Pod. Pods use service accounts to authenticate to the Kubernetes API server and to other services. Each namespace has a default service account.",
    details: [
      { label: "API Version", value: "v1" },
      { label: "Kind", value: "ServiceAccount" },
      { label: "Short name", value: "sa" },
      { label: "Scope", value: "Namespaced" },
    ],
    useCases: [
      "Granting Pods access to Kubernetes API resources",
      "Authenticating to external services via projected tokens",
      "Isolating workload identities for RBAC policies",
    ],
    pageContext:
      "This listing page shows all ServiceAccount resources. Each service account can be bound to Roles via RoleBindings. Click any row to see associated secrets and role bindings.",
    docsUrl: "https://kubernetes.io/docs/concepts/security/service-accounts/",
  },

  horizontalpodautoscalers: {
    kind: "HorizontalPodAutoscaler",
    shortName: "hpa",
    apiVersion: "autoscaling/v2",
    scope: "Namespaced",
    description:
      "A HorizontalPodAutoscaler (HPA) automatically scales the number of Pods in a Deployment, ReplicaSet, or StatefulSet based on observed CPU/memory utilisation or custom metrics.",
    details: [
      { label: "API Version", value: "autoscaling/v2" },
      { label: "Kind", value: "HorizontalPodAutoscaler" },
      { label: "Short name", value: "hpa" },
      { label: "Scope", value: "Namespaced" },
    ],
    useCases: [
      "Auto-scaling web services under variable load",
      "Cost optimisation by scaling down during low traffic",
      "Custom metrics scaling (RPS, queue depth)",
    ],
    pageContext:
      "This listing page shows all HorizontalPodAutoscaler resources. The min/max replica counts and current utilisation are shown per HPA. Click any row to see the scaling target and metric configuration.",
    docsUrl: "https://kubernetes.io/docs/tasks/run-application/horizontal-pod-autoscale/",
  },

  customresourcedefinitions: {
    kind: "CustomResourceDefinition",
    shortName: "crd",
    apiVersion: "apiextensions.k8s.io/v1",
    scope: "Cluster-scoped",
    description:
      "A CustomResourceDefinition (CRD) extends the Kubernetes API with new resource types. Once a CRD is installed, you can create custom resources of that type just like built-in resources.",
    details: [
      { label: "API Version", value: "apiextensions.k8s.io/v1" },
      { label: "Kind", value: "CustomResourceDefinition" },
      { label: "Short name", value: "crd" },
      { label: "Scope", value: "Cluster-scoped" },
    ],
    useCases: [
      "Operator patterns — defining domain-specific resources",
      "Extending Kubernetes with custom controllers",
      "Managing third-party tooling (cert-manager, Istio, Argo)",
    ],
    pageContext:
      "This listing page shows all installed CRDs in the cluster. Each row represents a custom resource type added by an operator or tooling. Click any row to see the spec schema and accepted versions.",
    docsUrl: "https://kubernetes.io/docs/concepts/extend-kubernetes/api-extension/custom-resources/",
  },
};

/** Fallback for resources not explicitly listed */
export const RESOURCE_INFO_FALLBACK = {
  description: "A Kubernetes resource object that represents a desired state in the cluster.",
  details: [],
  useCases: [],
  pageContext: "This listing page shows all resources of this type in your cluster. Click any row to inspect details, related resources, and metadata.",
  docsUrl: "https://kubernetes.io/docs/home/",
};

export function getResourceInfo(resourceKey) {
  return RESOURCE_INFO[resourceKey?.toLowerCase()] ?? RESOURCE_INFO_FALLBACK;
}
