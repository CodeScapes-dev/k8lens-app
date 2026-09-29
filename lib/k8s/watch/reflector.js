import { EventEmitter } from "node:events";

import * as defaultTransport from "./transport.js";
import { collectionPath, makeTransform } from "./resources.js";

// A Reflector mirrors one resource collection (cluster-wide, or one namespace)
// into memory: LIST once, then WATCH from that resourceVersion and apply deltas.
// It is the same pattern as client-go's reflector/informer, so the API server
// sees one long-lived watch per resource instead of a full LIST on every page view.
//
// Differences from @kubernetes/client-node's ListWatch, which is why it isn't used:
//  - retries with backoff on transient errors (ListWatch stops for good on any non-410 error)
//  - allowWatchBookmarks, so reconnects rarely need a relist
//  - paginated LIST (limit/continue), so the first sync of a large collection isn't one giant response
//  - explicit sync/failure state that callers can await or fall back on

const FATAL_STATUS = new Set([401, 403, 404, 405]);

const MIN_BACKOFF_MS = 1_000;
const MAX_BACKOFF_MS = 30_000;

function isGone(err) {
  return err?.statusCode === 410 || err?.code === 410;
}

export function objectKey(obj) {
  const md = obj?.metadata ?? {};
  return md.namespace ? `${md.namespace}/${md.name}` : md.name;
}

export class Reflector extends EventEmitter {
  constructor({ kubeConfig, resource, namespace = null, transport = defaultTransport, pageSize = 500, watchTimeoutSeconds, random = Math.random }) {
    super();
    this.kubeConfig = kubeConfig;
    this.resource = resource;
    this.namespace = resource.namespaced ? namespace : null;
    this.path = collectionPath(resource, this.namespace);
    this.transport = transport;
    this.pageSize = pageSize;
    this.random = random;
    // Randomised so hundreds of watches don't all reconnect in the same second.
    this.watchTimeoutSeconds = watchTimeoutSeconds ?? 300 + Math.floor(random() * 300);
    this.transform = makeTransform(resource);

    this.items = new Map();
    this.resourceVersion = "";
    this.status = "pending"; // pending | syncing | ready | retrying | failed | stopped
    this.synced = false;
    this.lastError = null;
    this.failedAt = null;
    this.revision = 0;
    this.lastSyncAt = null;
    this.stats = { lists: 0, watches: 0, events: 0, relistsAfterGone: 0 };

    this._stopped = true;
    this._watch = null;
    this._sleepTimer = null;
    this._wake = null;
    this._backoffMs = MIN_BACKOFF_MS;
    this._syncWaiters = new Set();
    this.setMaxListeners(0);
  }

  start() {
    if (!this._stopped) return;
    this._stopped = false;
    this._setStatus(this.synced ? "ready" : "syncing");
    this._loop();
  }

  stop() {
    this._stopped = true;
    this._setStatus("stopped");
    this._watch?.abort();
    this._watch = null;
    clearTimeout(this._sleepTimer);
    this._wake?.();
    this._rejectWaiters(new Error("Reflector stopped"));
  }

  list(namespace) {
    const all = Array.from(this.items.values());
    if (!namespace) return all;
    return all.filter((o) => o.metadata?.namespace === namespace);
  }

  get(namespace, name) {
    return this.items.get(namespace ? `${namespace}/${name}` : name) ?? null;
  }

  // Resolves once the first LIST has completed; rejects if the reflector fails
  // (e.g. RBAC forbids a cluster-wide list) or the timeout elapses first.
  waitForSync(timeoutMs = 15_000) {
    if (this.synced) return Promise.resolve();
    if (this.status === "failed") return Promise.reject(this.lastError);
    return new Promise((resolve, reject) => {
      const waiter = { resolve, reject };
      waiter.timer = setTimeout(() => {
        this._syncWaiters.delete(waiter);
        reject(Object.assign(new Error(`Timed out waiting for ${this.resource.key} to sync`), { code: "SYNC_TIMEOUT" }));
      }, timeoutMs);
      this._syncWaiters.add(waiter);
    });
  }

  snapshotStatus() {
    return {
      resource: this.resource.key,
      namespace: this.namespace,
      status: this.status,
      synced: this.synced,
      count: this.items.size,
      resourceVersion: this.resourceVersion,
      revision: this.revision,
      lastSyncAt: this.lastSyncAt,
      error: this.lastError ? { message: this.lastError.message, statusCode: this.lastError.statusCode ?? null } : null,
      stats: { ...this.stats },
    };
  }

  // ─── internals ────────────────────────────────────────────────────────────

  async _loop() {
    while (!this._stopped) {
      try {
        if (!this.resourceVersion) await this._relist();
        if (this._stopped) break;
        // A clean close is the server's timeoutSeconds elapsing; resume from the last resourceVersion.
        await this._watchOnce();
      } catch (err) {
        if (this._stopped) break;
        if (isGone(err)) {
          // Our resourceVersion was compacted away; a fresh LIST is the only way to resync.
          this.stats.relistsAfterGone++;
          this.resourceVersion = "";
          continue;
        }
        this.lastError = err;
        if (FATAL_STATUS.has(err?.statusCode)) {
          // Permission or API-availability problems don't fix themselves on a retry loop.
          this.failedAt = Date.now();
          this._setStatus("failed");
          this._rejectWaiters(err);
          this.emit("failed", err);
          return;
        }
        // Stays "retrying" (cache serving last-known state) until a LIST or WATCH succeeds again.
        this._setStatus("retrying");
        await this._sleep(this._nextBackoff());
      }
    }
  }

  async _relist() {
    const fresh = new Map();
    let continueToken;
    let listRv = "";
    // First sync may be served from the API server's watch cache (resourceVersion=0);
    // after a 410 we ask for a consistent list so we never step back in time.
    const rvParam = this.stats.lists === 0 ? "0" : undefined;
    this.stats.lists++;
    for (;;) {
      let page;
      try {
        page = await this.transport.listPage(this.kubeConfig, this.path, {
          limit: this.pageSize,
          continue: continueToken,
          resourceVersion: continueToken ? undefined : rvParam,
        });
      } catch (err) {
        // An expired continue token also comes back as 410: start the LIST over.
        if (continueToken && isGone(err)) {
          fresh.clear();
          continueToken = undefined;
          continue;
        }
        throw err;
      }
      for (const item of page.items ?? []) {
        const obj = this.transform(item);
        fresh.set(objectKey(obj), obj);
      }
      continueToken = page.metadata?.continue || undefined;
      listRv = page.metadata?.resourceVersion || listRv;
      if (!continueToken || this._stopped) break;
    }

    if (this._stopped) return;
    const changed = this._replace(fresh);
    this.resourceVersion = listRv;
    this.lastSyncAt = Date.now();
    const firstSync = !this.synced;
    this.synced = true;
    this.lastError = null;
    this._setStatus("ready");
    this._resolveWaiters();
    if (firstSync || changed) this._bump({ type: "RESYNC" });
  }

  // Swap in a freshly listed set; returns whether anything differs from what we had.
  _replace(fresh) {
    let changed = fresh.size !== this.items.size;
    if (!changed) {
      for (const [key, obj] of fresh) {
        const prev = this.items.get(key);
        if (!prev || prev.metadata?.resourceVersion !== obj.metadata?.resourceVersion) {
          changed = true;
          break;
        }
      }
    }
    this.items = fresh;
    return changed;
  }

  _watchOnce() {
    return new Promise((resolve, reject) => {
      let settled = false;
      const done = (err) => {
        if (settled) return;
        settled = true;
        this._watch = null;
        err ? reject(err) : resolve();
      };
      this.stats.watches++;
      this.transport
        .openWatch(
          this.kubeConfig,
          this.path,
          {
            resourceVersion: this.resourceVersion,
            allowWatchBookmarks: "true",
            timeoutSeconds: this.watchTimeoutSeconds,
          },
          {
            onOpen: () => {
              this._backoffMs = MIN_BACKOFF_MS;
              this._setStatus("ready");
            },
            onEvent: (event) => this._handleEvent(event),
            onDone: done,
          },
        )
        .then((handle) => {
          if (settled || this._stopped) handle.abort();
          else this._watch = handle;
        }, done);
    });
  }

  _handleEvent({ type, object }) {
    if (!object) return;
    switch (type) {
      case "ADDED":
      case "MODIFIED": {
        const obj = this.transform(object);
        this.items.set(objectKey(obj), obj);
        this.stats.events++;
        this._bump({ type, key: objectKey(obj), objectNamespace: obj.metadata?.namespace ?? null });
        break;
      }
      case "DELETED": {
        const key = objectKey(object);
        this.items.delete(key);
        this.stats.events++;
        this._bump({ type, key, objectNamespace: object.metadata?.namespace ?? null });
        break;
      }
      case "BOOKMARK":
        break;
      case "ERROR": {
        // A Status object; 410 means our resourceVersion is too old. Throwing ends the
        // stream (transport calls onDone with this error) and the loop decides what to do.
        const code = object.code ?? 500;
        const err = new Error(object.message || `watch error ${code}`);
        err.statusCode = code;
        err.code = code;
        throw err;
      }
      default:
        return;
    }
    const rv = object.metadata?.resourceVersion;
    if (rv) this.resourceVersion = rv;
  }

  _bump(change) {
    this.revision++;
    this.emit("change", { resource: this.resource.key, namespace: this.namespace, revision: this.revision, ...change });
  }

  _setStatus(status) {
    if (this.status === status) return;
    this.status = status;
    this.emit("status", this.snapshotStatus());
  }

  _nextBackoff() {
    const ms = this._backoffMs;
    this._backoffMs = Math.min(MAX_BACKOFF_MS, this._backoffMs * 2);
    return Math.round(ms * (0.8 + this.random() * 0.4));
  }

  _sleep(ms) {
    return new Promise((resolve) => {
      this._wake = resolve;
      this._sleepTimer = setTimeout(resolve, ms);
      this._sleepTimer.unref?.();
    });
  }

  _resolveWaiters() {
    for (const w of this._syncWaiters) {
      clearTimeout(w.timer);
      w.resolve();
    }
    this._syncWaiters.clear();
  }

  _rejectWaiters(err) {
    for (const w of this._syncWaiters) {
      clearTimeout(w.timer);
      w.reject(err);
    }
    this._syncWaiters.clear();
  }
}
