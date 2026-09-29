# Watch-based data layer (exploration)

Status: **exploratory**, on branch `feature/watch-informer-sync` (based on `development`).
Switch back to the old behaviour at any time with `K8LENS_DATA_SOURCE=rest`.

## Problem

Every page view, refresh and auto-refresh tick turned into fresh **LIST** calls against the
Kubernetes API server, often cluster-wide and many at once:

| Page | API-server calls per load (before) |
|---|---|
| Dashboard | 14 cluster-wide LISTs |
| Relationships (topology) | 20 cluster-wide LISTs |
| Namespace detail | 1 GET + 14 LISTs |
| PV / StorageClass detail | GET + cluster-wide LIST of **all pods and all events** |
| Any list page | 1 LIST (full collection, paginated in memory afterwards) |

With auto-refresh on, that repeats every N seconds, per open tab, per user. On a large
cluster (tens of thousands of pods and events) each of those LISTs is expensive for the API
server and etcd. This is the load pattern the API server's priority-and-fairness rules
exist to throttle.

## Approach: informers on the server, change notifications to the browser

```
                   ┌─────────────────────────── k8lens server (Node) ───────────────────────────┐
 kube-apiserver    │  WatchHub (process-wide, keyed by credential hash)                          │
  LIST once   ◄────┤    └─ ClusterCache (one per credential set)                                 │
  WATCH ──────────►│         └─ Reflector per resource (or per namespace, see RBAC)              │
  (bookmarks)      │              in-memory Map of objects, kept current by watch events         │
                   │                                                                             │
                   │  existing REST routes  ── getRequestClients() ──► reads from the cache      │
                   │  (lists, detail, dashboard, topology — handler code unchanged)             │
                   │        response headers: x-k8lens-source, x-k8lens-deps                    │
                   │                                                                             │
                   │  /api/k8s/watch  (SSE)  ◄── reflector change events, coalesced per window   │
                   └───────────────┬─────────────────────────────────────────────────────────────┘
                                   │ "event: change  data: {deps:[pods@team-a]}"
                   ┌───────────────▼──────────── browser ─────────────────┐
                   │  one shared stream per cluster (lib/live-stream.js)  │
                   │  hooks refetch their own page from the cache routes  │
                   └──────────────────────────────────────────────────────┘
```

1. **Reflectors** (`lib/k8s/watch/reflector.js`) do what client-go informers do: a paginated
   LIST (`limit=500`, first one served from the API server's watch cache with
   `resourceVersion=0`), then a WATCH from that resourceVersion with
   `allowWatchBookmarks=true` and a randomised `timeoutSeconds`. Deltas are applied to an
   in-memory map. A clean close resumes from the last resourceVersion; `410 Gone` triggers a
   consistent relist; transient errors back off exponentially (1 s → 30 s, jittered);
   401/403/404/405 fail fast. We don't use client-node's `ListWatch` because it stops for
   good on any non-410 error, has no bookmarks and doesn't paginate.
2. **Lazy, ref-counted, garbage-collected.** A reflector starts the first time a request
   needs that resource. It stops after 5 minutes with no readers and no open streams
   (`K8LENS_WATCH_IDLE_TTL_MS`). Someone who only ever opens the Pods page only ever watches
   pods. An idle app holds no watches.
3. **Existing handlers keep their code.** `getRequestClients(request)` returns the same
   object as `getClientsFromRequest`, but `list*` / `read*` calls on watchable kinds are
   answered from the cache. Field selectors (`involvedObject.name=…`, `spec.nodeName=…`) and
   label selectors (equality, set-based, existence) are evaluated in memory. Anything the cache
   can't answer passes through to the real API: sub-resources (logs, scale), secret reads,
   calls with `limit`/`continue`, unparseable selectors, cache misses on a read (e.g. an object
   created milliseconds ago) and forbidden scopes. Routes changed by one line each.
4. **The browser gets notifications, not objects.** Each response lists what it was built
   from (`x-k8lens-deps: pods@team-a,events@team-a`). The hook subscribes to exactly those
   over one shared SSE stream, and on `change` refetches its own page (still paginated,
   filtered and aggregated on the server, now from memory). Bursts are coalesced per
   window (1 s by default), so a rollout touching hundreds of pods causes a handful of refetches.
   Browser memory stays flat however big the cluster is. We rejected streaming raw objects to
   a client-side store because a 50k-pod cluster would mean shipping and holding 50k objects
   per tab.
5. **Interval polling is now only a fallback.** It runs only when the stream is down or a
   response wasn't fully served from the cache (`x-k8lens-source: mixed|rest`). The Refresh
   button still works; it re-reads the cache.

## Measured (real kube-apiserver v1.37.1 + etcd, ~300 pods, 3 namespaces)

Same 100 app requests (25 rounds of dashboard + pods list + deployment detail + pod detail):

| Mode | API-server LIST | API-server GET | avg app response |
|---|---|---|---|
| `K8LENS_DATA_SOURCE=rest` (current behaviour) | **525** | 50 | 36 ms |
| watch cache (this branch) | **0** | 0 | 7 ms |

After the initial sync, API-server cost is fixed: one watch per resource in use, independent
of how many pages, tabs or refreshes there are.

Other checks run against the same cluster:

- **Parity**: 92 list/detail/dashboard/topology responses compared between both modes. Every
  one matches except for the intended differences below.
- **Latency**: `kubectl scale` → the Deployments table updated in ~115 ms with no reload; a pod
  label → pod detail page in ~180 ms. No requests at all while nothing changes.
- **Coalescing**: 50 concurrent pod updates → 3 change notifications (250 ms window).
- **Isolation**: changes in `team-b` never notify a `pods@team-a` subscriber.
- **API server killed with SIGKILL**: reflectors go `retrying`, and cached reads keep serving the
  last-known state. On restart they reconnect (410 → relist where needed), and changes made
  after the restart show up within ~1 s.
- **Namespace-restricted user** (list/watch only in `team-a`): cluster-wide pods is still 403
  (as before); `team-a` pages are served from a namespace-scoped watch.

### Intended behaviour differences

- **Raw Kubernetes JSON instead of client-node's typed models.** The typed client renames
  reserved words (`default`→`_default`, `from`→`_from`, `$ref`→`ref`, `x-kubernetes-*`→`x_kubernetes_*`).
  The UI was written against the real field names, so two existing bugs go away: LimitRange
  "Default" values and NetworkPolicy ingress peers (`rule.from`) now render.
- **Secret values never enter the cache.** List responses keep the keys with empty values;
  secret detail pages still do a direct GET for the real data. As a side effect, the secrets
  list no longer ships every secret value to the browser.
- `managedFields` and `kubectl.kubernetes.io/last-applied-configuration` are dropped from
  cached objects to save memory.

## Security model

- Caches are keyed by a SHA-256 of the **full credential set** (server, token, CA,
  client cert/key, skip-TLS). Two users on the same cluster with different tokens get
  separate caches, so nobody is served objects their own credentials couldn't list.
- The server still holds no credentials at rest. Credentials live only in memory, inside the
  live cache's kubeconfig, for as long as that cache has active reflectors.
- `/api/k8s/watch/status` only reports the caller's own cache.

## RBAC

A cluster-wide reflector is tried first. If it gets 403 and the request was for a single
namespace, a namespace-scoped reflector is used instead. Failed scopes are retried at most
once a minute. Users with `list` but not `watch` fall back to direct API calls, exactly as
before.

## Configuration

| Env var | Default | Meaning |
|---|---|---|
| `K8LENS_DATA_SOURCE` | *(watch)* | `rest` disables the cache and the stream entirely |
| `K8LENS_WATCH_IDLE_TTL_MS` | `300000` | stop a reflector after this long unused |
| `K8LENS_WATCH_SYNC_TIMEOUT_MS` | `15000` | how long a request waits for a first sync before falling back to a direct call |

## Code map

| File | Role |
|---|---|
| `lib/k8s/watch/resources.js` | registry of watchable kinds, paths, per-object trimming |
| `lib/k8s/watch/transport.js` | LIST page / WATCH stream over `node:http(s)` |
| `lib/k8s/watch/reflector.js` | list+watch loop, backoff, 410 handling, sync state |
| `lib/k8s/watch/cluster-cache.js` | per-credential reflectors, namespace fallback, GC |
| `lib/k8s/watch/hub.js` | process-wide registry (on `globalThis`; Next bundles each route separately) |
| `lib/k8s/watch/cached-clients.js` + `method-plan.js` + `selectors.js` | cache-backed drop-in for `getClientsFromRequest` |
| `app/api/k8s/watch/route.js` | SSE change-notification stream |
| `lib/live-stream.js`, `hooks/use-live-updates.js` | shared browser stream + hook glue |
| `lib/k8s/watch/watch.test.js` | unit tests (fake transport) |

## Not covered yet / open questions

- **Deployment model.** Informers need a long-lived Node process: fine for the Docker image and
  `next start`, not for serverless. Each replica keeps its own cache. That's correct but
  multiplies watches, so we'd want session affinity or a single replica behind a load balancer.
- **Memory ceiling.** No per-cache object or byte limit yet. Next steps: measure RSS on a
  large cluster, index by namespace, and consider metadata-only watches
  (`PartialObjectMetadata`) for kinds the UI mostly counts (events, replicasets).
- **Helm** still lists release secrets directly (it needs the encoded payloads). Option:
  watch `owner=helm` secrets with metadata only, and fetch payloads on revision change.
- **Metrics** (`metrics.k8s.io`) don't support watch, so they keep polling. That traffic goes
  to metrics-server, not etcd.
- **Topology graph** reads from the cache but doesn't live-refetch. Every new graph re-runs
  dagre layout and `fitView`, which would yank the viewport. It needs incremental node
  updates first.
- **"Live · watching …" footers** on list pages are hardcoded strings on `main`. They should
  reflect the hook's `live` flag (connected / reconnecting / polling).
- **WatchList** (`sendInitialEvents=true`) could replace the initial LIST on clusters that
  support it, for an even cheaper first sync.
- **HTTP/2**: one TLS connection per watch today (31 after visiting every page type);
  multiplexing would reduce connections.
- ESLint currently crashes on `development` too (`scopeManager.addGlobals`), which predates
  this branch.
