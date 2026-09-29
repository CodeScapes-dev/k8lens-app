import { NextResponse } from "next/server";

import { getClusterCacheFromRequest, watchCacheEnabled } from "@/lib/k8s/watch/hub";
import { depMatches, parseDeps } from "@/lib/k8s/watch/deps";

// Server-Sent Events stream of *change notifications* for the resources a page depends on.
//
//   GET /api/k8s/watch?deps=pods@default,events@default&throttle=1000
//   (cluster credentials in the usual x-cluster-* headers, so the browser reads this
//    with fetch() + a stream reader rather than EventSource, which can't send headers)
//
// Events:
//   status  { resource, namespace, status, synced, error }   per dependency, as it changes
//   change  { deps: ["pods@default", ...], at }             coalesced per throttle window
//   ": ping" comment every 20s to keep proxies from idling the connection out
//
// Payloads are deliberately small: the page refetches its (already paginated, filtered,
// aggregated) data from the cache-backed REST routes, which no longer touch the API
// server. That keeps browser memory flat no matter how many objects the cluster has.

const HEARTBEAT_MS = 20_000;
const MIN_THROTTLE_MS = 250;
const DEFAULT_THROTTLE_MS = 1_000;

export async function GET(request) {
  if (!watchCacheEnabled()) {
    return NextResponse.json({ error: { code: "WATCH_DISABLED", message: "Watch cache is disabled (K8LENS_DATA_SOURCE=rest)." } }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const deps = parseDeps(searchParams.get("deps"));
  if (!deps.length) {
    return NextResponse.json({ error: "Missing or invalid deps" }, { status: 400 });
  }
  const throttleMs = Math.max(MIN_THROTTLE_MS, Number(searchParams.get("throttle")) || DEFAULT_THROTTLE_MS);

  let cache;
  try {
    cache = getClusterCacheFromRequest(request);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }

  const encoder = new TextEncoder();
  const cleanups = [];
  let closed = false;

  const stream = new ReadableStream({
    start(controller) {
      const send = (event, data) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch {
          close();
        }
      };

      // Coalesce bursts (a rollout can emit hundreds of pod events a second) into one
      // notification per window listing every dependency that changed.
      const pending = new Set();
      let timer = null;
      let lastFlush = 0;
      const flush = () => {
        timer = null;
        lastFlush = Date.now();
        if (!pending.size) return;
        send("change", { deps: [...pending], at: lastFlush });
        pending.clear();
      };
      const schedule = () => {
        if (timer) return;
        const wait = Math.max(0, throttleMs - (Date.now() - lastFlush));
        timer = setTimeout(flush, wait);
      };

      // One subscription per namespace scope; each change is matched back to the deps it affects.
      const byNamespace = new Map();
      for (const dep of deps) {
        const k = dep.namespace ?? "";
        if (!byNamespace.has(k)) byNamespace.set(k, []);
        byNamespace.get(k).push(dep);
      }
      for (const [ns, group] of byNamespace) {
        const sub = cache.subscribe(
          [...new Set(group.map((d) => d.resource))],
          {
            namespace: ns || null,
            onChange: (change) => {
              for (const dep of group) {
                if (depMatches(dep, change.resource, change.objectNamespace)) pending.add(dep.key);
              }
              if (pending.size) schedule();
            },
            onStatus: (status) => {
              for (const dep of group) {
                if (dep.resource === status.resource) send("status", { dep: dep.key, ...pick(status) });
              }
            },
          },
        );
        cleanups.push(sub.unsubscribe);
      }

      const heartbeat = setInterval(() => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`: ping ${Date.now()}\n\n`));
        } catch {
          close();
        }
      }, HEARTBEAT_MS);
      cleanups.push(() => clearInterval(heartbeat), () => clearTimeout(timer));

      send("hello", { deps: deps.map((d) => d.key), throttleMs });

      function close() {
        if (closed) return;
        closed = true;
        for (const fn of cleanups.splice(0)) {
          try {
            fn();
          } catch {}
        }
        try {
          controller.close();
        } catch {}
      }
      request.signal.addEventListener("abort", close);
    },
    cancel() {
      closed = true;
      for (const fn of cleanups.splice(0)) {
        try {
          fn();
        } catch {}
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

function pick({ status, synced, count, error, namespace }) {
  return { status, synced, count, error, scope: namespace ?? null };
}
