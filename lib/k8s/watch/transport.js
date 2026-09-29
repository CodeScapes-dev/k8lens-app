import http from "node:http";
import https from "node:https";

// Minimal LIST/WATCH transport over node:http(s). We talk to the API server directly
// (instead of client-node's Watch/ListWatch) so we control bookmarks, server-side
// timeouts, pagination and status handling.

export class K8sHttpError extends Error {
  constructor(statusCode, status) {
    super(status?.message || `Kubernetes API responded ${statusCode}`);
    this.name = "K8sHttpError";
    this.statusCode = statusCode;
    this.code = statusCode;
    this.body = status ?? null;
    this.reason = status?.reason;
  }
}

async function requestOptions(kubeConfig, path, query) {
  const cluster = kubeConfig.getCurrentCluster();
  if (!cluster) throw new Error("No active cluster in kubeconfig");
  const url = new URL(cluster.server.replace(/\/+$/, "") + path);
  for (const [k, v] of Object.entries(query ?? {})) {
    if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
  }
  const opts = { headers: {} };
  await kubeConfig.applyToHTTPSOptions(opts);
  const headers = { Accept: "application/json", ...opts.headers };
  if (opts.auth) headers.Authorization = "Basic " + Buffer.from(opts.auth).toString("base64");
  // createAgent() already picks the right agent for the scheme, TLS settings and any proxyUrl.
  return {
    url,
    lib: url.protocol === "https:" ? https : http,
    options: { method: "GET", headers, agent: opts.agent },
  };
}

function readBody(res) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    res.on("data", (c) => chunks.push(c));
    res.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    res.on("error", reject);
  });
}

function parseStatus(text) {
  try {
    return JSON.parse(text);
  } catch {
    return { message: text?.slice(0, 500) };
  }
}

// One page of a LIST. Returns the parsed List object ({ metadata, items }).
export async function listPage(kubeConfig, path, query, { signal, timeoutMs = 60_000 } = {}) {
  const { url, lib, options } = await requestOptions(kubeConfig, path, query);
  return new Promise((resolve, reject) => {
    const req = lib.request(url, { ...options, signal, timeout: timeoutMs }, async (res) => {
      try {
        const text = await readBody(res);
        if (res.statusCode !== 200) return reject(new K8sHttpError(res.statusCode, parseStatus(text)));
        resolve(JSON.parse(text));
      } catch (err) {
        reject(err);
      }
    });
    req.on("timeout", () => req.destroy(Object.assign(new Error("LIST timed out"), { code: "ETIMEDOUT" })));
    req.on("error", reject);
    req.end();
  });
}

// Opens a WATCH stream. `onOpen()` fires once the server accepts it (HTTP 200);
// `onEvent({ type, object })` per watch event; `onDone(err|null)` exactly once when the
// stream ends (null = clean server-side close). Returns `{ abort() }`.
export async function openWatch(kubeConfig, path, query, { onOpen, onEvent, onDone, idleTimeoutMs = 90_000 }) {
  const { url, lib, options } = await requestOptions(kubeConfig, path, { ...query, watch: "true" });
  let finished = false;
  let req;
  const finish = (err) => {
    if (finished) return;
    finished = true;
    try {
      req?.destroy();
    } catch {}
    onDone(err ?? null);
  };

  req = lib.request(url, options, (res) => {
    if (res.statusCode !== 200) {
      readBody(res).then(
        (text) => finish(new K8sHttpError(res.statusCode, parseStatus(text))),
        (err) => finish(err),
      );
      return;
    }
    onOpen?.();
    res.setEncoding("utf8");
    let buffer = "";
    res.on("data", (chunk) => {
      buffer += chunk;
      let nl;
      while ((nl = buffer.indexOf("\n")) !== -1) {
        const line = buffer.slice(0, nl).trim();
        buffer = buffer.slice(nl + 1);
        if (!line) continue;
        let event;
        try {
          event = JSON.parse(line);
        } catch {
          continue;
        }
        try {
          onEvent(event);
        } catch (err) {
          finish(err);
          return;
        }
      }
    });
    res.on("end", () => finish(null));
    res.on("close", () => finish(null));
    res.on("error", finish);
  });

  // With bookmarks enabled the server sends *something* at least every minute or so;
  // silence beyond this means a half-open connection (NAT/LB dropped it), so reconnect.
  req.setTimeout(idleTimeoutMs, () => finish(Object.assign(new Error("watch idle timeout"), { code: "ETIMEDOUT" })));
  req.on("socket", (socket) => socket.setKeepAlive?.(true, 30_000));
  req.on("error", finish);
  req.end();

  return { abort: () => finish(null) };
}
