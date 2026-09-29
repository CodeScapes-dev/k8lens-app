// Browser side of the watch pipeline: one shared change-notification stream per
// cluster, multiplexed across every hook on the page.
//
// Hooks register the dependency keys their last response reported (x-k8lens-deps);
// the manager keeps a single /api/k8s/watch connection open for the union of them,
// reopening it when the union changes, and calls each subscriber when one of *its*
// dependencies changes. EventSource can't send the x-cluster-* credential headers,
// so the stream is read with fetch() and parsed as SSE here.

const RECONNECT_MIN_MS = 1_000;
const RECONNECT_MAX_MS = 30_000;
const RESUBSCRIBE_DEBOUNCE_MS = 150;

function parseSSE(buffer, onEvent) {
  let idx;
  while ((idx = buffer.indexOf("\n\n")) !== -1) {
    const block = buffer.slice(0, idx);
    buffer = buffer.slice(idx + 2);
    let event = "message";
    const data = [];
    for (const line of block.split("\n")) {
      if (line.startsWith(":")) continue;
      if (line.startsWith("event:")) event = line.slice(6).trim();
      else if (line.startsWith("data:")) data.push(line.slice(5).trimStart());
    }
    if (!data.length) continue;
    try {
      onEvent(event, JSON.parse(data.join("\n")));
    } catch {}
  }
  return buffer;
}

class LiveStream {
  constructor(key, headers) {
    this.key = key;
    this.headers = headers;
    this.subscribers = new Set(); // { deps: Set<string>, onChange, onState }
    this.state = "idle"; // idle | connecting | live | error
    this.depStatus = new Map(); // dep -> { status, synced, error }
    this.currentDeps = "";
    this.abort = null;
    this.retryMs = RECONNECT_MIN_MS;
    this.retryTimer = null;
    this.resubTimer = null;
  }

  subscribe(sub) {
    this.subscribers.add(sub);
    this._scheduleResubscribe();
    sub.onState?.(this.snapshot(sub));
    return () => {
      this.subscribers.delete(sub);
      this._scheduleResubscribe();
    };
  }

  update(sub) {
    this._scheduleResubscribe();
    sub.onState?.(this.snapshot(sub));
  }

  // Live for a subscriber = stream connected and every one of its deps synced.
  snapshot(sub) {
    if (this.state !== "live") return { live: false, state: this.state };
    for (const dep of sub.deps) {
      const s = this.depStatus.get(dep);
      if (s?.status === "failed") return { live: false, state: "error" };
      // "retrying" = the server lost its watch and is serving last-known data.
      if (!s || !s.synced || s.status === "retrying") return { live: false, state: "connecting" };
    }
    return { live: sub.deps.size > 0, state: "live" };
  }

  close() {
    clearTimeout(this.retryTimer);
    clearTimeout(this.resubTimer);
    this.abort?.abort();
    this.abort = null;
    this.state = "idle";
  }

  _union() {
    const all = new Set();
    for (const s of this.subscribers) for (const d of s.deps) all.add(d);
    return [...all].sort().join(",");
  }

  _scheduleResubscribe() {
    clearTimeout(this.resubTimer);
    this.resubTimer = setTimeout(() => {
      const next = this._union();
      if (next === this.currentDeps && this.abort) return;
      this.currentDeps = next;
      this._connect();
    }, RESUBSCRIBE_DEBOUNCE_MS);
  }

  _setState(state) {
    this.state = state;
    for (const s of this.subscribers) s.onState?.(this.snapshot(s));
  }

  async _connect() {
    this.abort?.abort();
    clearTimeout(this.retryTimer);
    if (!this.currentDeps) {
      this.abort = null;
      this._setState("idle");
      return;
    }
    const controller = new AbortController();
    this.abort = controller;
    this.depStatus.clear();
    this._setState("connecting");
    try {
      const params = new URLSearchParams({ deps: this.currentDeps });
      const res = await fetch(`/api/k8s/watch?${params}`, { headers: this.headers, signal: controller.signal, cache: "no-store" });
      if (!res.ok || !res.body) throw Object.assign(new Error(`watch stream ${res.status}`), { status: res.status });
      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
      let buffer = "";
      this.retryMs = RECONNECT_MIN_MS;
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer = parseSSE(buffer + value, (event, data) => this._onEvent(event, data));
      }
      if (controller.signal.aborted) return;
      throw new Error("watch stream ended");
    } catch (err) {
      if (controller.signal.aborted) return;
      this._setState("error");
      // 404 = watch cache disabled on the server; stay in polling mode.
      if (err.status === 404) return;
      this.retryTimer = setTimeout(() => this._connect(), this.retryMs);
      this.retryMs = Math.min(RECONNECT_MAX_MS, this.retryMs * 2);
    }
  }

  _onEvent(event, data) {
    if (event === "hello") {
      this._setState("live");
    } else if (event === "status") {
      this.depStatus.set(data.dep, data);
      for (const s of this.subscribers) if (s.deps.has(data.dep)) s.onState?.(this.snapshot(s));
    } else if (event === "change") {
      const changed = new Set(data.deps);
      for (const s of this.subscribers) {
        for (const dep of s.deps) {
          if (changed.has(dep)) {
            s.onChange?.();
            break;
          }
        }
      }
    }
  }
}

const streams = new Map();

// `streamKey` must change whenever the credentials do, so a stream never outlives them.
export function subscribeLive(streamKey, headers, sub) {
  let stream = streams.get(streamKey);
  if (!stream) {
    for (const [k, s] of streams) {
      // Only one cluster is active at a time; drop streams for other contexts.
      if (k !== streamKey && s.subscribers.size === 0) {
        s.close();
        streams.delete(k);
      }
    }
    stream = new LiveStream(streamKey, headers);
    streams.set(streamKey, stream);
  }
  const unsubscribe = stream.subscribe(sub);
  return {
    update: () => stream.update(sub),
    unsubscribe: () => {
      unsubscribe();
      if (stream.subscribers.size === 0) {
        // Keep the connection briefly so page-to-page navigation doesn't tear it down.
        setTimeout(() => {
          if (stream.subscribers.size === 0 && streams.get(streamKey) === stream) {
            stream.close();
            streams.delete(streamKey);
          }
        }, 5_000);
      }
    },
  };
}
