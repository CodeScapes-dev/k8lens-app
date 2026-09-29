import { getResourceByApiKind } from "./resources.js";

// Maps a typed client-node method name onto a cache lookup:
//   listPodForAllNamespaces / listNamespacedPod / readNamespacedPod / listNode / readNode
// Sub-resources (readNamespacedPodLog, readNamespacedDeploymentScale, …) resolve to a
// kind the registry doesn't know, so they return null and go to the API server.
export function planFor(api, method) {
  let m;
  if ((m = method.match(/^list(\w+)ForAllNamespaces$/))) return plan(api, m[1], "list", false);
  if ((m = method.match(/^listNamespaced(\w+)$/))) return plan(api, m[1], "list", true);
  if ((m = method.match(/^readNamespaced(\w+)$/))) return plan(api, m[1], "read", true);
  if ((m = method.match(/^list(\w+)$/))) return plan(api, m[1], "list", false, true);
  if ((m = method.match(/^read(\w+)$/))) return plan(api, m[1], "read", false, true);
  return null;
}

function plan(api, kind, op, namespacedCall, clusterScopedOnly = false) {
  const resource = getResourceByApiKind(api, kind);
  if (!resource) return null;
  if (clusterScopedOnly && resource.namespaced) return null;
  if (namespacedCall && !resource.namespaced) return null;
  if (op === "read" && resource.cacheReads === false) return null;
  return { resource, op, namespacedCall };
}

