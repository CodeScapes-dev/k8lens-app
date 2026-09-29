import { EventEmitter } from "node:events";

import { Reflector } from "./reflector.js";
import { getResource } from "./resources.js";

// All watches for one set of cluster credentials.
//
// Reflectors start lazily, the first time something reads or subscribes to a resource,
// and stop after `idleTtlMs` with no readers and no live subscribers. So an idle tab
// costs nothing, and a user who only ever opens the Pods page only ever watches pods.
//
// Scope: a cluster-wide reflector is tried first. If RBAC forbids that (403) and the
// caller asked for a single namespace, a namespace-scoped reflector is used instead,
// so namespace-restricted users still get watch-backed data.

export const DEFAULTS = {
  idleTtlMs: 5 * 60_000,
  // After a reflector fails (403/404…), don't retry the same scope for this long.
  failureCooldownMs: 60_000,
  syncTimeoutMs: 15_000,
};

function scopeKey(resourceKey, namespace) {
  return namespace ? `${resourceKey}@${namespace}` : resourceKey;
}

export class ClusterCache extends EventEmitter {
  constructor({ id, kubeConfig, options = {}, reflectorFactory }) {
    super();
    this.id = id;
    this.kubeConfig = kubeConfig;
    const overrides = Object.fromEntries(Object.entries(options).filter(([, v]) => v !== undefined));
    this.options = { ...DEFAULTS, ...overrides };
    this.reflectors = new Map(); // scopeKey -> { reflector, refs, lastUsed }
    this.createdAt = Date.now();
    this.lastUsed = Date.now();
    this.reflectorFactory = reflectorFactory ?? ((args) => new Reflector(args));
    this.setMaxListeners(0);
  }

  // Returns a synced reflector that can answer for `resourceKey` (optionally within
  // `namespace`), or throws — callers treat a throw as "fall back to a direct API call".
  async reflectorFor(resourceKey, namespace = null) {
    const resource = getResource(resourceKey);
    if (!resource) throw Object.assign(new Error(`Resource ${resourceKey} is not watchable`), { code: "NOT_WATCHABLE" });
    this.lastUsed = Date.now();

    const clusterWide = this._entry(resource, null);
    if (clusterWide.reflector.status !== "failed") {
      try {
        await clusterWide.reflector.waitForSync(this.options.syncTimeoutMs);
        clusterWide.lastUsed = Date.now();
        return clusterWide.reflector;
      } catch (err) {
        if (!(resource.namespaced && namespace && clusterWide.reflector.status === "failed")) throw err;
      }
    }
    if (!resource.namespaced || !namespace) throw clusterWide.reflector.lastError ?? new Error(`${resourceKey} unavailable`);

    const scoped = this._entry(resource, namespace);
    await scoped.reflector.waitForSync(this.options.syncTimeoutMs);
    scoped.lastUsed = Date.now();
    return scoped.reflector;
  }

  async list(resourceKey, namespace = null) {
    const reflector = await this.reflectorFor(resourceKey, namespace);
    return { items: reflector.list(namespace || undefined), resourceVersion: reflector.resourceVersion };
  }

  async get(resourceKey, namespace, name) {
    const reflector = await this.reflectorFor(resourceKey, namespace);
    return reflector.get(namespace, name);
  }

  // Keeps the given resources warm and forwards their changes to `onChange` until the
  // returned function is called. Scopes follow the same cluster-wide→namespace rule.
  subscribe(resourceKeys, { namespace = null, onChange, onStatus }) {
    const held = [];
    let closed = false;

    const attach = async (key) => {
      try {
        const reflector = await this.reflectorFor(key, namespace);
        if (closed) return;
        const entry = this.reflectors.get(scopeKey(key, reflector.namespace));
        entry.refs++;
        const changeListener = (change) => onChange?.(change);
        const statusListener = (status) => onStatus?.(status);
        reflector.on("change", changeListener);
        reflector.on("status", statusListener);
        held.push(() => {
          reflector.off("change", changeListener);
          reflector.off("status", statusListener);
          entry.refs--;
          entry.lastUsed = Date.now();
        });
        onStatus?.(reflector.snapshotStatus());
      } catch (err) {
        if (!closed) onStatus?.({ resource: key, namespace, status: "failed", synced: false, error: { message: err.message, statusCode: err.statusCode ?? null } });
      }
    };

    const ready = Promise.all(resourceKeys.map(attach));
    const unsubscribe = () => {
      closed = true;
      for (const release of held.splice(0)) release();
    };
    return { ready, unsubscribe };
  }

  // Stops reflectors nobody has used for idleTtlMs. Returns true when the cache is empty
  // and can be discarded.
  sweep(now = Date.now()) {
    for (const [key, entry] of this.reflectors) {
      const idle = entry.refs <= 0 && now - entry.lastUsed > this.options.idleTtlMs;
      const expiredFailure = entry.reflector.status === "failed" && entry.refs <= 0 && now - (entry.reflector.failedAt ?? 0) > this.options.failureCooldownMs;
      if (idle || expiredFailure) {
        entry.reflector.stop();
        entry.reflector.removeAllListeners();
        this.reflectors.delete(key);
      }
    }
    return this.reflectors.size === 0 && now - this.lastUsed > this.options.idleTtlMs;
  }

  stopAll() {
    for (const entry of this.reflectors.values()) {
      entry.reflector.stop();
      entry.reflector.removeAllListeners();
    }
    this.reflectors.clear();
  }

  status() {
    return Array.from(this.reflectors.values()).map(({ reflector, refs }) => ({ ...reflector.snapshotStatus(), subscribers: refs }));
  }

  _entry(resource, namespace) {
    const key = scopeKey(resource.key, namespace);
    let entry = this.reflectors.get(key);
    if (!entry) {
      const reflector = this.reflectorFactory({ kubeConfig: this.kubeConfig, resource, namespace });
      entry = { reflector, refs: 0, lastUsed: Date.now() };
      this.reflectors.set(key, entry);
      reflector.start();
    }
    return entry;
  }
}
