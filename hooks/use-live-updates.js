"use client";

import React from "react";
import { useClusterStore } from "@/stores/clusterStore";
import { subscribeLive } from "@/lib/live-stream";

// Reads what a cache-backed API response was built from.
export function readWatchHeaders(res) {
  const deps = res.headers.get("x-k8lens-deps");
  return {
    source: res.headers.get("x-k8lens-source") ?? "rest",
    deps: deps ? deps.split(",").filter(Boolean) : [],
  };
}

// Tracks the dependency info a cache-backed response reports, keeping the object
// identity stable when nothing changed so the live subscription isn't torn down.
export function useWatchInfo() {
  const [info, setInfo] = React.useState({ source: "rest", deps: [] });
  const update = React.useCallback((res) => {
    const next = readWatchHeaders(res);
    setInfo((prev) => (prev.source === next.source && prev.deps.join(",") === next.deps.join(",") ? prev : next));
  }, []);
  return [info, update];
}

// Subscribes to change notifications for `deps` and calls `refetch` when any of them
// change. Refetches never overlap: a change that lands mid-fetch queues exactly one
// follow-up fetch. Returns `live` = the stream is connected and all deps are synced,
// which callers use to switch interval polling off.
export function useLiveUpdates({ deps, refetch, headers, enabled = true }) {
  const activeContext = useClusterStore((s) => s.activeContext);
  const [live, setLive] = React.useState(false);
  const refetchRef = React.useRef(refetch);
  const inFlight = React.useRef(false);
  const queued = React.useRef(false);

  React.useEffect(() => {
    refetchRef.current = refetch;
  }, [refetch]);

  const depsKey = [...new Set(deps ?? [])].sort().join(",");
  const headersKey = JSON.stringify(headers ?? {});
  const streamKey = `${activeContext}|${headersKey}`;

  React.useEffect(() => {
    if (!enabled || !activeContext || !depsKey || !headers?.["x-cluster-server"]) return;

    const run = async () => {
      if (inFlight.current) {
        queued.current = true;
        return;
      }
      inFlight.current = true;
      try {
        await refetchRef.current?.();
      } finally {
        inFlight.current = false;
        if (queued.current) {
          queued.current = false;
          run();
        }
      }
    };

    const handle = subscribeLive(streamKey, headers, {
      deps: new Set(depsKey.split(",")),
      onChange: run,
      onState: (s) => setLive(s.live),
    });
    return () => {
      handle.unsubscribe();
      setLive(false);
    };
    // headers is represented by streamKey
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [streamKey, depsKey, enabled, activeContext]);

  return { live };
}
