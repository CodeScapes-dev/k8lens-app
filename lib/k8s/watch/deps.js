import { getResource } from "./resources.js";

// Dependency keys are "resource" (all namespaces) or "resource@namespace".
// They travel in the x-k8lens-deps response header and the watch stream's ?deps= param.

const MAX_DEPS = 64;
const NAMESPACE_RE = /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/;

export function parseDeps(value) {
  const out = [];
  const seen = new Set();
  for (const raw of String(value ?? "").split(",")) {
    const token = raw.trim();
    if (!token || seen.has(token)) continue;
    const [resource, namespace = null] = token.split("@");
    const def = getResource(resource);
    if (!def) continue;
    if (namespace !== null && (!def.namespaced || !NAMESPACE_RE.test(namespace))) continue;
    seen.add(token);
    out.push({ resource, namespace, key: token });
    if (out.length >= MAX_DEPS) break;
  }
  return out;
}

// Does a change to `resource` in `objectNamespace` affect dependency `dep`?
export function depMatches(dep, resource, objectNamespace) {
  if (dep.resource !== resource) return false;
  if (!dep.namespace) return true;
  // RESYNC changes have no single namespace; they may touch any of them.
  return objectNamespace == null || objectNamespace === dep.namespace;
}
