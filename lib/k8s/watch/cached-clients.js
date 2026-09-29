import { getClientsFromRequest } from "../client.js";
import { getClusterCacheFromRequest, watchCacheEnabled } from "./hub.js";
import { planFor } from "./method-plan.js";
import { apiVersionOf } from "./resources.js";
import { compileSelectors } from "./selectors.js";

// Drop-in replacement for getClientsFromRequest(). It returns the same typed API
// objects, but list*/read* calls for watchable resources are answered from the
// in-memory watch cache instead of hitting the API server. Everything else (logs,
// sub-resources, secrets reads, anything the cache can't answer) passes straight
// through to the real client, so no handler has to change how it calls the API.
//
// It also records which resources the request read, so the route can tell the
// browser what to subscribe to for live updates (see `withWatchHeaders`).

const CTX = Symbol("k8lens.watchCtx");
const WRAPPED_APIS = ["core", "apps", "batch", "networking", "rbac", "storage", "autoscaling", "scheduling", "extensions"];

// Arguments the cache can honour. Anything else (limit, continue, resourceVersion…)
// means the caller wants API-server semantics, so we pass through.
const CACHEABLE_ARGS = new Set(["namespace", "name", "fieldSelector", "labelSelector", "pretty"]);

async function serve(ctx, planned, args) {
  const { resource, op, namespacedCall } = planned;
  const namespace = namespacedCall ? args.namespace : null;
  const reflector = await ctx.cache.reflectorFor(resource.key, namespace);

  if (op === "read") {
    const obj = reflector.get(namespace, args.name);
    // A miss may just mean the watch hasn't delivered a brand-new object yet; let the
    // caller fall back to a single GET rather than report a false 404.
    if (!obj) throw Object.assign(new Error("cache miss"), { code: "CACHE_MISS" });
    ctx.deps.add(depKey(resource.key, namespace));
    return { apiVersion: apiVersionOf(resource), kind: resource.kind, ...obj };
  }

  const predicate = compileSelectors(args);
  if (!predicate) throw Object.assign(new Error("unsupported selector"), { code: "UNSUPPORTED_SELECTOR" });
  const items = reflector.list(namespace || undefined).filter(predicate);
  ctx.deps.add(depKey(resource.key, namespace));
  return {
    apiVersion: apiVersionOf(resource),
    kind: `${resource.kind}List`,
    metadata: { resourceVersion: reflector.resourceVersion },
    items,
  };
}

function depKey(resourceKey, namespace) {
  return namespace ? `${resourceKey}@${namespace}` : resourceKey;
}

function wrapApi(api, real, ctx) {
  return new Proxy(real, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);
      if (typeof prop !== "string" || typeof value !== "function") return value;
      const planned = planFor(api, prop);
      if (!planned) return value.bind(target);
      return async (args = {}) => {
        if (Object.keys(args).every((k) => CACHEABLE_ARGS.has(k))) {
          try {
            const result = await serve(ctx, planned, args);
            ctx.sources.add("watch");
            return result;
          } catch (err) {
            ctx.fallbacks.push({ method: prop, reason: err.code ?? err.statusCode ?? err.message });
          }
        }
        ctx.sources.add("rest");
        return value.call(target, args);
      };
    },
  });
}

// Same shape as getClientsFromRequest(); set K8LENS_DATA_SOURCE=rest to bypass the cache entirely.
export function getRequestClients(request) {
  const real = getClientsFromRequest(request);
  if (!watchCacheEnabled()) return real;
  const ctx = { cache: getClusterCacheFromRequest(request), deps: new Set(), sources: new Set(), fallbacks: [] };
  const clients = { ...real };
  for (const api of WRAPPED_APIS) if (real[api]) clients[api] = wrapApi(api, real[api], ctx);
  clients.events = clients.core;
  Object.defineProperty(clients, CTX, { value: ctx });
  return clients;
}

// Describes what a response was built from:
//   x-k8lens-source: watch | rest | mixed
//   x-k8lens-deps:   resources (optionally @namespace) the browser should subscribe to
export function withWatchHeaders(response, clients) {
  const ctx = clients?.[CTX];
  if (!ctx) {
    response.headers.set("x-k8lens-source", "rest");
    return response;
  }
  const source = ctx.sources.size === 0 ? "watch" : ctx.sources.size > 1 ? "mixed" : [...ctx.sources][0];
  response.headers.set("x-k8lens-source", source);
  if (ctx.deps.size) response.headers.set("x-k8lens-deps", [...ctx.deps].join(","));
  if (ctx.fallbacks.length && process.env.NODE_ENV !== "production") {
    response.headers.set("x-k8lens-fallbacks", ctx.fallbacks.map((f) => `${f.method}:${f.reason}`).join(",").slice(0, 1000));
  }
  return response;
}
