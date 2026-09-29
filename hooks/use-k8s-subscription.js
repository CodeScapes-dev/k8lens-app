"use client";

import React from "react";
import { useClusterStore } from "@/stores/clusterStore";
import { clusterHeaders } from "@/hooks/cluster-headers";

// Reconnects with a short capped backoff so a transient network blip doesn't permanently drop
// live updates; a real "this identity can't watch" failure reports via onDegraded instead of
// retrying forever (the server-side informer doesn't retry that case either — see watch-manager.js).
const RECONNECT_DELAYS_MS = [1000, 2000, 5000, 10000];
const CHANGE_DEBOUNCE_MS = 300;

// Parses the text/event-stream wire format /api/k8s/subscribe writes, calling onEvent per frame.
// Deliberately not the browser's native EventSource — see subscribe/route.js for why.
async function pump(url, headers, signal, onEvent) {
  const res = await fetch(url, { headers, signal });
  if (!res.ok) {
    const err = new Error(`subscribe failed: HTTP ${res.status}`);
    err.statusCode = res.status;
    throw err;
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) return;
    buf += decoder.decode(value, { stream: true });
    let idx;
    while ((idx = buf.indexOf("\n\n")) !== -1) {
      const raw = buf.slice(0, idx);
      buf = buf.slice(idx + 2);
      const eventLine = raw.split("\n").find((l) => l.startsWith("event: "));
      const dataLine = raw.split("\n").find((l) => l.startsWith("data: "));
      if (!eventLine || !dataLine) continue;
      try {
        onEvent(eventLine.slice("event: ".length), JSON.parse(dataLine.slice("data: ".length)));
      } catch {
        // Malformed frame — skip it rather than tearing down the whole connection over one line.
      }
    }
  }
}

/**
 * Subscribes to /api/k8s/subscribe?kind=<kind> for the active cluster while `enabled` is true.
 * Callers don't get the raw objects here on purpose: every ADD/UPDATE/DELETE frame just triggers
 * a debounced `onChange()` (SYNC always triggers one too, regardless of `filter` — it only fires
 * once per connect/reconnect, not per change, so it's cheap and worth acting on unconditionally),
 * and the caller re-fetches its own paginated/sorted/filtered view (list pages) or single object
 * (detail pages) the normal way — that reuses all of that logic instead of duplicating it against
 * a stream of raw patches.
 *
 * `filter(obj)`, if given, is checked against each ADD/UPDATE/DELETE object before triggering
 * onChange — detail pages pass one that matches their own name+namespace, so a change to an
 * unrelated object of the same kind elsewhere in the cluster doesn't cause a pointless refetch.
 * List pages omit it (every change is relevant to a list of the whole kind).
 *
 * `onDegraded(error)` fires once if the server reports this identity can't watch the kind (e.g.
 * RBAC has list/get but not watch); the caller should fall back to polling.
 */
export function useK8sSubscription(kind, { enabled, filter, onChange, onDegraded }) {
  const activeContext = useClusterStore((s) => s.activeContext);
  const clusters = useClusterStore((s) => s.clusters);

  const onChangeRef = React.useRef(onChange);
  onChangeRef.current = onChange;
  const onDegradedRef = React.useRef(onDegraded);
  onDegradedRef.current = onDegraded;
  const filterRef = React.useRef(filter);
  filterRef.current = filter;

  React.useEffect(() => {
    if (!enabled || !activeContext || !kind) return;
    const cluster = clusters.find((c) => c.contextName === activeContext);
    const controller = new AbortController();
    let stopped = false;
    let attempt = 0;
    let debounceTimer = null;

    const scheduleOnChange = () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => onChangeRef.current?.(), CHANGE_DEBOUNCE_MS);
    };

    const run = async () => {
      while (!stopped) {
        try {
          const params = new URLSearchParams({ kind });
          await pump(`/api/k8s/subscribe?${params}`, clusterHeaders(cluster), controller.signal, (event, data) => {
            if (event === "DEGRADED") {
              onDegradedRef.current?.(data);
              return;
            }
            if (event !== "SYNC" && filterRef.current && !filterRef.current(data)) return;
            scheduleOnChange();
          });
          attempt = 0; // clean end (server closed the stream) is still worth a quick reconnect
        } catch {
          if (stopped || controller.signal.aborted) return;
        }
        if (stopped) return;
        const delay = RECONNECT_DELAYS_MS[Math.min(attempt, RECONNECT_DELAYS_MS.length - 1)];
        attempt += 1;
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    };

    run();

    return () => {
      stopped = true;
      clearTimeout(debounceTimer);
      controller.abort();
    };
  }, [enabled, activeContext, kind, clusters]);
}
