# K8Lens

A web UI for browsing and managing Kubernetes clusters. Built with Next.js 16, connects to any cluster via kubeconfig or manual credentials — no agents or cluster-side components required.

## Screenshots

|                                                                                    |                                                                                        |
| ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| ![Cluster Connection](https://assets.atharvaunde.com/Cluster_Connection.png)       | ![Dashboard](https://assets.atharvaunde.com/Cluster_Dashboard.png)                     |
| ![Deployments View](https://assets.atharvaunde.com/Deployments_View.png)           | ![Deployment Details](https://assets.atharvaunde.com/Deployment_Details.png)           |
| ![Deployment Details 2](https://assets.atharvaunde.com/Deployment_Details_-_2.png) | ![Deployment Dependencies](https://assets.atharvaunde.com/Deployment_Dependencies.png) |
| ![Node Details](https://assets.atharvaunde.com/Node_Details.png)                   | ![Node Metrics](https://assets.atharvaunde.com/Node_Metrics.png)                       |
| ![Resource Map](https://assets.atharvaunde.com/Resource_Map.png)                   |                                                                                        |

---

## Features

- **Dashboard** — cluster health score, resource utilization, 24h event activity, KPI strip (pods, nodes, workloads, estimated cost), resource topology overview, recent events timeline, Helm releases
- **Live resource browsing** — listing tables with search, sort, pagination, and column filtering for all standard Kubernetes resources
- **Detail pages** — per-resource detail views with tabs: Overview, Metrics, Dependencies graph, Blast Radius analysis, Events, Metadata, and resource-specific tabs (Logs, Rollout History, RBAC rules, TLS certs, etc.)
- **Live metrics** — CPU and memory columns on listing pages, per-pod/node metrics via Metrics Server or Kubelet Summary API fallback
- **Dependency graphs** — `@xyflow/react` powered visualization of resource relationships
- **Helm releases** — browse and inspect releases, managed resources, and values
- **Mobile responsive** — dashboard and listing pages adapt to narrow viewports
- **Docker-ready** — multi-stage Dockerfile with standalone output, non-root user, HEALTHCHECK, OCI labels

---

## Getting Started

### Development

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). Connect to a cluster via the `/connect` page by uploading a kubeconfig or entering credentials manually.

### Production build

```bash
pnpm build
pnpm start
```

### Analyze bundle

```bash
pnpm add -D @next/bundle-analyzer
ANALYZE=true next build --webpack
```

### Docker

```bash
# Build
docker build -t k8lens:latest .

# Run
docker run -d -p 3000:3000 --name k8lens k8lens:latest
```

Open [http://localhost:3000](http://localhost:3000) and connect via the UI. The container does not read a kubeconfig from disk — cluster credentials are passed per-request from the browser.

> **Local clusters (kind/minikube/Docker Desktop):** if your cluster's API server is at `127.0.0.1` or `localhost`, use `host.docker.internal` as the hostname when connecting through the app (e.g. `https://host.docker.internal:6443`).

---

## Connecting to a Cluster

Three connection methods are supported:

- **Kubeconfig** _(recommended)_ — paste or upload a kubeconfig file; all contexts are imported
- **Token** — bearer token + server URL + optional CA data
- **In-cluster** — service account token (for running K8Lens inside the cluster itself)

### RBAC requirements

The connecting identity needs at minimum read access to the resources you want to browse. The built-in `view` ClusterRole covers most namespaced resources. For full dashboard functionality (including nodes, namespaces, events, CRDs, and metrics) a ClusterRole with broader `get`/`list` permissions is needed:

```yaml
- apiGroups:
    [
      "",
      "apps",
      "batch",
      "networking.k8s.io",
      "storage.k8s.io",
      "rbac.authorization.k8s.io",
      "apiextensions.k8s.io",
      "autoscaling",
      "metrics.k8s.io",
    ]
  resources: ["*"]
  verbs: ["get", "list", "watch"]
- apiGroups: [""]
  resources: ["nodes/proxy"] # for Kubelet Summary API (node metrics fallback)
  verbs: ["get"]
```

---

## Resource Coverage

### Workloads

Pods · Deployments · StatefulSets · DaemonSets · ReplicaSets · ReplicationControllers · Jobs · CronJobs

### Network

Services · Ingresses · IngressClasses · NetworkPolicies · Endpoints

### Configuration

ConfigMaps · Secrets · ResourceQuotas · LimitRanges

### Storage

PersistentVolumes · PersistentVolumeClaims · StorageClasses

### Access Control

ServiceAccounts · Roles · RoleBindings · ClusterRoles · ClusterRoleBindings

### Cluster

Nodes · Namespaces · Events

### Advanced

CustomResourceDefinitions · HorizontalPodAutoscalers · Helm Releases

---

## Metrics

Live CPU and memory data is sourced from Kubernetes-native APIs — no Prometheus or external monitoring stack required.

| Source                                                           | Used for                                                                                           |
| ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `metrics.k8s.io` (Metrics Server)                                | CPU/memory columns on Pod, Node, Deployment, StatefulSet, DaemonSet, ReplicaSet, Job listing pages |
| Kubelet Summary API (`/api/v1/nodes/{name}/proxy/stats/summary`) | Node detail metrics tab fallback when Metrics Server is unavailable                                |

All metric endpoints return `{ available: false, data: null }` gracefully when the source is unavailable — existing pages never break. The dashboard's "Resource Utilization" section falls back to `status.allocatable` values from the node spec.

Metrics Server detection: `GET /api/k8s/metrics/detect`

---

## Tech Stack

|                   |                                 |
| ----------------- | ------------------------------- |
| Framework         | Next.js 16 (App Router)         |
| Language          | JavaScript (no TypeScript)      |
| Styling           | Tailwind CSS v4 + CSS variables |
| UI primitives     | Radix UI / shadcn/ui            |
| Charts            | Recharts                        |
| Dependency graphs | @xyflow/react + dagre           |
| Tables            | @tanstack/react-table           |
| State             | Zustand                         |
| Kubernetes client | @kubernetes/client-node         |
| Package manager   | pnpm 9                          |
| Node              | 24+                             |

---

## Project Structure

```
app/
  api/k8s/          # API routes — one per resource group (core, apps, batch, …)
  api/cluster/      # Connect, auto-detect, upload kubeconfig
  dashboard/        # Dashboard page
  workloads/        # Workload listing + detail pages
  network/          # Network resource pages
  configuration/    # ConfigMaps, Secrets, Quotas, LimitRanges
  storage/          # PV, PVC, StorageClasses
  access-control/   # RBAC resources
  cluster/          # Nodes, Namespaces, Events
  advanced/         # CRDs, HPAs, Helm
components/
  data-table/       # Shared listing table (search, sort, pagination, column picker)
  detail/           # Shared detail page primitives (tabs, metadata, events)
  *-detail/         # Resource-specific detail tab components
lib/k8s/
  client.js         # KubeConfig builder, per-request client factory
  utils.js          # Error parsing, K8s resource helpers
  columns/          # Column definitions per resource group
  parsers/          # Kubeconfig and resource parsers
  metrics-client.js # Metrics Server and Kubelet Summary API clients
hooks/
  use-k8s.js        # Data fetching hook for all resource listing pages
  use-dashboard.js  # Dashboard data aggregation hook
  use-metrics.js    # Metrics polling hook
stores/
  clusterStore.js   # Active cluster context, connection state (Zustand)
```
