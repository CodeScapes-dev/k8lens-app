import { createHash } from "node:crypto";

import { buildManualKubeConfig, isBlockedServerUrl } from "../client.js";
import { ClusterCache } from "./cluster-cache.js";

// Process-wide registry of ClusterCaches.
//
// Caches are keyed by a hash of the *full credential set*, not the context name: two
// users pointing at the same API server with different tokens get separate caches,
// so nobody is ever served objects their own credentials couldn't list.
//
// Kept on globalThis because Next.js bundles each route handler separately; a plain
// module-level Map would give every route its own copy and duplicate every watch.

const HUB_KEY = Symbol.for("k8lens.watchHub");
const SWEEP_INTERVAL_MS = 30_000;

export function watchCacheEnabled() {
  return process.env.K8LENS_DATA_SOURCE !== "rest";
}

function envNumber(name) {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

function hub() {
  if (!globalThis[HUB_KEY]) {
    const state = { caches: new Map(), sweeper: null };
    state.sweeper = setInterval(() => {
      for (const [id, cache] of state.caches) {
        if (cache.sweep()) {
          cache.stopAll();
          state.caches.delete(id);
        }
      }
    }, SWEEP_INTERVAL_MS);
    state.sweeper.unref?.();
    globalThis[HUB_KEY] = state;
  }
  return globalThis[HUB_KEY];
}

export function credentialsFromHeaders(headers) {
  const server = headers.get("x-cluster-server");
  if (!server) throw new Error("Missing x-cluster-server header");
  if (isBlockedServerUrl(server)) throw new Error("Blocked server URL.");
  return {
    server,
    token: headers.get("x-cluster-token") || undefined,
    caData: headers.get("x-cluster-ca-data") || undefined,
    certData: headers.get("x-cluster-cert-data") || undefined,
    keyData: headers.get("x-cluster-key-data") || undefined,
    skipTLSVerify: headers.get("x-cluster-skip-tls") === "true",
  };
}

export function fingerprint(creds) {
  const h = createHash("sha256");
  for (const k of ["server", "token", "caData", "certData", "keyData", "skipTLSVerify"]) h.update(`${k}=${creds[k] ?? ""}\n`);
  return h.digest("hex");
}

export function getClusterCache(creds) {
  const state = hub();
  const id = fingerprint(creds);
  let cache = state.caches.get(id);
  if (!cache) {
    const kubeConfig = buildManualKubeConfig({
      apiEndpoint: creds.server,
      caData: creds.caData,
      certData: creds.certData,
      keyData: creds.keyData,
      skipTls: creds.skipTLSVerify,
      token: creds.token,
    });
    cache = new ClusterCache({
      id,
      kubeConfig,
      options: {
        idleTtlMs: envNumber("K8LENS_WATCH_IDLE_TTL_MS"),
        syncTimeoutMs: envNumber("K8LENS_WATCH_SYNC_TIMEOUT_MS"),
      },
    });
    state.caches.set(id, cache);
  }
  return cache;
}

export function getClusterCacheFromRequest(request) {
  return getClusterCache(credentialsFromHeaders(request.headers));
}

export function hubStatus() {
  const state = hub();
  return Array.from(state.caches.values()).map((c) => ({
    id: c.id.slice(0, 12),
    server: c.kubeConfig?.getCurrentCluster?.()?.server,
    reflectors: c.status(),
  }));
}
