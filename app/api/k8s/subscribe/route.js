// Phase 0 of the poll -> watch migration (see the migration plan). Streams live add/update/delete
// events for one resource kind via SSE, backed by lib/k8s/watch-manager.js.
//
// Deliberately NOT consumed via the browser's native EventSource — it can't send the x-cluster-*
// headers this app's whole auth model relies on. The intended client is `fetch(url, {
// headers }).body.getReader()`, decoding this same text/event-stream wire format by hand.
import { buildKubeConfigFromRequest } from "@/lib/k8s/client";
import { serializeK8sObjects } from "@/lib/k8s/utils";
import { isKnownKind, subscribe } from "@/lib/k8s/watch-manager";

const encoder = new TextEncoder();

function sseLine(event, data) {
  return encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const kind = searchParams.get("kind");

  if (!kind) {
    return Response.json({ error: "Missing required param: kind" }, { status: 400 });
  }
  if (!isKnownKind(kind)) {
    return Response.json({ error: `Unknown or not-yet-watchable kind: ${kind}` }, { status: 400 });
  }

  let kubeConfig;
  let connectionParams;
  try {
    ({ kubeConfig, connectionParams } = buildKubeConfigFromRequest(request));
  } catch (err) {
    return Response.json({ error: err.message }, { status: 400 });
  }

  let sub;
  const stream = new ReadableStream({
    start(controller) {
      let closed = false;
      const send = (event, data) => {
        if (closed) return;
        try {
          controller.enqueue(sseLine(event, data));
        } catch {
          // Controller already closed on the other side of a race with the abort handler below.
        }
      };

      try {
        sub = subscribe(connectionParams, kind, kubeConfig, {
          onEvent: (type, obj) => send(type, serializeK8sObjects(obj)),
          onDegraded: (error) => send("DEGRADED", error),
        });
      } catch (err) {
        send("DEGRADED", { message: err.message });
        closed = true;
        controller.close();
        return;
      }

      send("SYNC", {
        items: serializeK8sObjects(sub.snapshot),
        status: sub.status,
        error: sub.error,
      });

      request.signal.addEventListener("abort", () => {
        closed = true;
        sub?.unsubscribe();
        try {
          controller.close();
        } catch {
          // Already closed.
        }
      });
    },
    cancel() {
      sub?.unsubscribe();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      // Disable response buffering on nginx-style reverse proxies, if this is ever deployed
      // behind one — see "What you lose" in the migration plan.
      "X-Accel-Buffering": "no",
    },
  });
}
