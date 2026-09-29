// Phase 0 of the poll -> watch migration (see the migration plan). Server-side registry of
// Kubernetes Informers, one per (cluster identity, resource kind), shared across every browser
// tab/subscriber pointed at the same cluster with the same credentials.
//
// Deliberately proven against exactly one resource kind (Pods) before any other kind is added —
// see KIND_REGISTRY below. This module holds real state in the Node process's memory: it only
// works correctly as a single instance (see "What you lose" in the migration plan).
import crypto from "node:crypto";
import * as k8s from "@kubernetes/client-node";
import { WATCH_KINDS } from "./watch-kinds.js";

// How long an informer with zero subscribers stays running before being torn down — avoids
// stop/start thrashing when a user briefly navigates away and back to the same resource kind.
const IDLE_STOP_MS = 30_000;

// One entry per watchable resource kind, keyed exactly by lib/k8s/watch-kinds.js's WATCH_KINDS
// (asserted in watch-manager.test.js). `path` and `listPromiseFn` are the two arguments
// makeInformer needs; `listPromiseFn` receives the request-scoped KubeConfig so a fresh typed
// client is built per cluster, matching how every other route in this app builds clients. Every
// list call is the *-ForAllNamespaces (or cluster-scoped list) variant — same REST path Kubernetes
// uses for a cluster-wide watch of a namespaced resource.
const KIND_REGISTRY = {
  // core
  pods: { path: "/api/v1/pods", listPromiseFn: (kc) => kc.makeApiClient(k8s.CoreV1Api).listPodForAllNamespaces() },
  services: { path: "/api/v1/services", listPromiseFn: (kc) => kc.makeApiClient(k8s.CoreV1Api).listServiceForAllNamespaces() },
  configmaps: { path: "/api/v1/configmaps", listPromiseFn: (kc) => kc.makeApiClient(k8s.CoreV1Api).listConfigMapForAllNamespaces() },
  secrets: { path: "/api/v1/secrets", listPromiseFn: (kc) => kc.makeApiClient(k8s.CoreV1Api).listSecretForAllNamespaces() },
  persistentvolumeclaims: { path: "/api/v1/persistentvolumeclaims", listPromiseFn: (kc) => kc.makeApiClient(k8s.CoreV1Api).listPersistentVolumeClaimForAllNamespaces() },
  replicationcontrollers: { path: "/api/v1/replicationcontrollers", listPromiseFn: (kc) => kc.makeApiClient(k8s.CoreV1Api).listReplicationControllerForAllNamespaces() },
  resourcequotas: { path: "/api/v1/resourcequotas", listPromiseFn: (kc) => kc.makeApiClient(k8s.CoreV1Api).listResourceQuotaForAllNamespaces() },
  limitranges: { path: "/api/v1/limitranges", listPromiseFn: (kc) => kc.makeApiClient(k8s.CoreV1Api).listLimitRangeForAllNamespaces() },
  endpoints: { path: "/api/v1/endpoints", listPromiseFn: (kc) => kc.makeApiClient(k8s.CoreV1Api).listEndpointsForAllNamespaces() },
  serviceaccounts: { path: "/api/v1/serviceaccounts", listPromiseFn: (kc) => kc.makeApiClient(k8s.CoreV1Api).listServiceAccountForAllNamespaces() },
  namespaces: { path: "/api/v1/namespaces", listPromiseFn: (kc) => kc.makeApiClient(k8s.CoreV1Api).listNamespace() },
  nodes: { path: "/api/v1/nodes", listPromiseFn: (kc) => kc.makeApiClient(k8s.CoreV1Api).listNode() },
  persistentvolumes: { path: "/api/v1/persistentvolumes", listPromiseFn: (kc) => kc.makeApiClient(k8s.CoreV1Api).listPersistentVolume() },
  events: { path: "/api/v1/events", listPromiseFn: (kc) => kc.makeApiClient(k8s.CoreV1Api).listEventForAllNamespaces() },
  // apps
  deployments: { path: "/apis/apps/v1/deployments", listPromiseFn: (kc) => kc.makeApiClient(k8s.AppsV1Api).listDeploymentForAllNamespaces() },
  statefulsets: { path: "/apis/apps/v1/statefulsets", listPromiseFn: (kc) => kc.makeApiClient(k8s.AppsV1Api).listStatefulSetForAllNamespaces() },
  daemonsets: { path: "/apis/apps/v1/daemonsets", listPromiseFn: (kc) => kc.makeApiClient(k8s.AppsV1Api).listDaemonSetForAllNamespaces() },
  replicasets: { path: "/apis/apps/v1/replicasets", listPromiseFn: (kc) => kc.makeApiClient(k8s.AppsV1Api).listReplicaSetForAllNamespaces() },
  // batch
  jobs: { path: "/apis/batch/v1/jobs", listPromiseFn: (kc) => kc.makeApiClient(k8s.BatchV1Api).listJobForAllNamespaces() },
  cronjobs: { path: "/apis/batch/v1/cronjobs", listPromiseFn: (kc) => kc.makeApiClient(k8s.BatchV1Api).listCronJobForAllNamespaces() },
  // networking
  ingresses: { path: "/apis/networking.k8s.io/v1/ingresses", listPromiseFn: (kc) => kc.makeApiClient(k8s.NetworkingV1Api).listIngressForAllNamespaces() },
  ingressclasses: { path: "/apis/networking.k8s.io/v1/ingressclasses", listPromiseFn: (kc) => kc.makeApiClient(k8s.NetworkingV1Api).listIngressClass() },
  networkpolicies: { path: "/apis/networking.k8s.io/v1/networkpolicies", listPromiseFn: (kc) => kc.makeApiClient(k8s.NetworkingV1Api).listNetworkPolicyForAllNamespaces() },
  // rbac
  clusterroles: { path: "/apis/rbac.authorization.k8s.io/v1/clusterroles", listPromiseFn: (kc) => kc.makeApiClient(k8s.RbacAuthorizationV1Api).listClusterRole() },
  clusterrolebindings: { path: "/apis/rbac.authorization.k8s.io/v1/clusterrolebindings", listPromiseFn: (kc) => kc.makeApiClient(k8s.RbacAuthorizationV1Api).listClusterRoleBinding() },
  roles: { path: "/apis/rbac.authorization.k8s.io/v1/roles", listPromiseFn: (kc) => kc.makeApiClient(k8s.RbacAuthorizationV1Api).listRoleForAllNamespaces() },
  rolebindings: { path: "/apis/rbac.authorization.k8s.io/v1/rolebindings", listPromiseFn: (kc) => kc.makeApiClient(k8s.RbacAuthorizationV1Api).listRoleBindingForAllNamespaces() },
  // scheduling
  priorityclasses: { path: "/apis/scheduling.k8s.io/v1/priorityclasses", listPromiseFn: (kc) => kc.makeApiClient(k8s.SchedulingV1Api).listPriorityClass() },
  // storage
  storageclasses: { path: "/apis/storage.k8s.io/v1/storageclasses", listPromiseFn: (kc) => kc.makeApiClient(k8s.StorageV1Api).listStorageClass() },
  volumeattachments: { path: "/apis/storage.k8s.io/v1/volumeattachments", listPromiseFn: (kc) => kc.makeApiClient(k8s.StorageV1Api).listVolumeAttachment() },
  csidrivers: { path: "/apis/storage.k8s.io/v1/csidrivers", listPromiseFn: (kc) => kc.makeApiClient(k8s.StorageV1Api).listCSIDriver() },
  csinodes: { path: "/apis/storage.k8s.io/v1/csinodes", listPromiseFn: (kc) => kc.makeApiClient(k8s.StorageV1Api).listCSINode() },
  // autoscaling
  horizontalpodautoscalers: { path: "/apis/autoscaling/v2/horizontalpodautoscalers", listPromiseFn: (kc) => kc.makeApiClient(k8s.AutoscalingV2Api).listHorizontalPodAutoscalerForAllNamespaces() },
  // apiextensions
  customresourcedefinitions: { path: "/apis/apiextensions.k8s.io/v1/customresourcedefinitions", listPromiseFn: (kc) => kc.makeApiClient(k8s.ApiextensionsV1Api).listCustomResourceDefinition() },
};

// Safety net for the hand-maintained parity between this file and watch-kinds.js — checked in
// watch-manager.test.js rather than asserted at import time (this module runs in the request
// path; a thrown assertion here would take down every route, not just fail a test).
export function _kindRegistryKeys() {
  return Object.keys(KIND_REGISTRY);
}
export function _watchKindKeys() {
  return Object.keys(WATCH_KINDS);
}

export function isKnownKind(kind) {
  return Object.prototype.hasOwnProperty.call(KIND_REGISTRY, kind);
}

// clusterKey (sha256 of connection identity) -> Map<kind, InformerEntry>
const clusters = new Map();

// Hashes the same fields buildKubeConfigFromRequest extracts from headers, so two requests with
// identical credentials share one informer instead of opening a duplicate watch per browser tab.
// Hashed (not stored raw) so cert/key/token material never sits in a map key in plain form.
function fingerprint({ server, caData, certData, keyData, skipTls, token }) {
  return crypto
    .createHash("sha256")
    .update(server ?? "").update("\u0000")
    .update(caData ?? "").update("\u0000")
    .update(certData ?? "").update("\u0000")
    .update(keyData ?? "").update("\u0000")
    .update(skipTls ? "1" : "0").update("\u0000")
    .update(token ?? "")
    .digest("hex");
}

function getOrCreateClusterEntries(clusterKey) {
  let entries = clusters.get(clusterKey);
  if (!entries) {
    entries = new Map();
    clusters.set(clusterKey, entries);
  }
  return entries;
}

function toErrorInfo(err) {
  return {
    statusCode: err?.statusCode ?? err?.code ?? null,
    message: err?.message ?? String(err ?? "Unknown error"),
  };
}

function startEntry(entries, kind, kubeConfig) {
  const def = KIND_REGISTRY[kind];
  const informer = k8s.makeInformer(kubeConfig, def.path, () => def.listPromiseFn(kubeConfig));

  const entry = {
    informer,
    subscribers: new Set(),
    status: "starting", // "starting" | "running" | "degraded"
    error: null,
    stopTimer: null,
  };

  // A non-410 error here means the list or watch call itself failed — most importantly, a 403
  // when the connected identity has `list`/`get` but not `watch` on this resource. The SDK does
  // not retry after this (confirmed by reading dist/cache.js's doneHandler): the informer is
  // dead until something calls .start() again, so this is a stable "give up, fall back to
  // polling for this kind" signal, not a transient blip.
  informer.on("error", (err) => {
    entry.status = "degraded";
    entry.error = toErrorInfo(err);
    for (const sub of entry.subscribers) sub.onDegraded(entry.error);
  });
  informer.on("connect", () => {
    if (entry.status !== "degraded") entry.status = "running";
  });
  informer.on("add", (obj) => emit(entry, "ADD", obj));
  informer.on("update", (obj) => emit(entry, "UPDATE", obj));
  informer.on("delete", (obj) => emit(entry, "DELETE", obj));

  entries.set(kind, entry);

  informer.start().catch((err) => {
    entry.status = "degraded";
    entry.error = toErrorInfo(err);
  });

  return entry;
}

function emit(entry, type, obj) {
  for (const sub of entry.subscribers) sub.onEvent(type, obj);
}

/**
 * Subscribes to live updates for one resource kind on one cluster. Starts the informer if this is
 * the first subscriber for that (cluster, kind) pair; otherwise attaches to the already-running
 * one and hands back its current cache as `snapshot` (so a late subscriber doesn't wait for a
 * fresh relist — the SDK's in-memory cache already has it).
 *
 * @param {object} connectionParams same shape buildKubeConfigFromRequest returns
 * @param {string} kind must be a KIND_REGISTRY key (checked via isKnownKind before calling)
 * @param {import("@kubernetes/client-node").KubeConfig} kubeConfig
 * @param {{onEvent: (type: "ADD"|"UPDATE"|"DELETE", obj: object) => void, onDegraded: (error: {statusCode: number|null, message: string}) => void}} callbacks
 * @returns {{snapshot: object[], status: string, error: object|null, unsubscribe: () => void}}
 */
export function subscribe(connectionParams, kind, kubeConfig, { onEvent, onDegraded }) {
  const clusterKey = fingerprint(connectionParams);
  const entries = getOrCreateClusterEntries(clusterKey);

  let entry = entries.get(kind);
  if (entry?.stopTimer) {
    clearTimeout(entry.stopTimer);
    entry.stopTimer = null;
  }
  if (!entry) entry = startEntry(entries, kind, kubeConfig);

  const subscriber = { onEvent, onDegraded };
  entry.subscribers.add(subscriber);

  const snapshot = entry.informer.list();
  const status = entry.status;
  const error = entry.error;

  return {
    snapshot,
    status,
    error,
    unsubscribe() {
      entry.subscribers.delete(subscriber);
      if (entry.subscribers.size === 0) {
        entry.stopTimer = setTimeout(() => {
          if (entry.subscribers.size === 0) {
            entry.informer.stop().catch(() => {});
            entries.delete(kind);
            if (entries.size === 0) clusters.delete(clusterKey);
          }
        }, IDLE_STOP_MS);
      }
    },
  };
}

/**
 * Non-starting peek at a kind's current cache for this cluster identity. Returns null if no
 * informer is running for this exact (cluster, kind) pair — list routes fall back to a normal
 * Kubernetes API call in that case, exactly as before this module existed. Only
 * `/api/k8s/subscribe` (via `subscribe()`) ever starts an informer; plain GET routes only ever
 * opportunistically read an already-running one.
 */
export function getCachedList(connectionParams, kind) {
  const clusterKey = fingerprint(connectionParams);
  const entry = clusters.get(clusterKey)?.get(kind);
  if (!entry) return null;
  return { items: entry.informer.list(), status: entry.status, error: entry.error };
}

/**
 * Non-starting peek at one cached object, for detail-page reads. Deliberately conservative:
 * returns undefined (never a false "not found") unless the informer has confirmed at least one
 * successful connect (status "running", meaning its initial list has completed) — an informer
 * that's still starting up may simply not have this object cached *yet*, which is not the same as
 * it not existing. Callers fall back to a normal live read whenever this returns undefined, so a
 * cache miss here only ever costs the same read the app already did before this module existed —
 * it can make a detail page faster/fresher, never wronger.
 */
export function getCachedObject(connectionParams, kind, namespace, name) {
  const clusterKey = fingerprint(connectionParams);
  const entry = clusters.get(clusterKey)?.get(kind);
  if (!entry || entry.status !== "running") return undefined;
  return entry.informer.get(name, namespace || undefined) ?? undefined;
}

// For manual verification only (see the migration plan's Phase 0 verification section) — not
// used by application code.
export function _debugState() {
  return [...clusters.entries()].map(([clusterKey, entries]) => ({
    clusterKey,
    kinds: [...entries.entries()].map(([kind, entry]) => ({
      kind,
      status: entry.status,
      subscribers: entry.subscribers.size,
      cacheSize: entry.informer.list().length,
      error: entry.error,
    })),
  }));
}
