import { test } from "node:test";
import assert from "node:assert/strict";

import { Reflector } from "./reflector.js";
import { ClusterCache } from "./cluster-cache.js";
import { getResource, collectionPath, makeTransform } from "./resources.js";
import { compileSelectors, parseLabelSelector } from "./selectors.js";
import { planFor } from "./method-plan.js";
import { parseDeps, depMatches } from "./deps.js";

const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms));

const pod = (ns, name, rv, extra = {}) => ({
  metadata: { namespace: ns, name, resourceVersion: String(rv), managedFields: [{ manager: "x" }], ...extra.metadata },
  spec: { nodeName: extra.nodeName ?? "node-a" },
  status: { phase: extra.phase ?? "Running" },
});

// Scriptable stand-in for transport.js. `pages` are served in order for LIST calls;
// each openWatch() call gets a controllable stream.
function fakeTransport({ pages = [], listErrors = [] } = {}) {
  const t = {
    listCalls: [],
    watchCalls: [],
    streams: [],
    async listPage(_kc, path, query) {
      t.listCalls.push({ path, query });
      const err = listErrors.shift();
      if (err) throw err;
      const page = pages.shift();
      if (!page) throw new Error("no more pages scripted");
      return page;
    },
    async openWatch(_kc, path, query, { onOpen, onEvent, onDone }) {
      t.watchCalls.push({ path, query });
      onOpen?.();
      const stream = {
        closed: false,
        send(type, object) {
          try {
            onEvent({ type, object });
          } catch (err) {
            this.end(err);
          }
        },
        end(err = null) {
          if (this.closed) return;
          this.closed = true;
          onDone(err);
        },
      };
      t.streams.push(stream);
      return { abort: () => stream.end(null) };
    },
  };
  return t;
}

const list = (items, rv, cont) => ({ metadata: { resourceVersion: String(rv), continue: cont }, items });

test("reflector lists with pagination, strips managedFields and freezes objects", async () => {
  const transport = fakeTransport({
    pages: [list([pod("a", "p1", 1)], 10, "tok"), list([pod("b", "p2", 2)], 10)],
  });
  const r = new Reflector({ kubeConfig: null, resource: getResource("pods"), transport, pageSize: 1, random: () => 0.5 });
  r.start();
  await r.waitForSync(1000);

  assert.equal(r.items.size, 2);
  assert.equal(transport.listCalls[0].query.resourceVersion, "0");
  assert.equal(transport.listCalls[1].query.continue, "tok");
  const p1 = r.get("a", "p1");
  assert.equal(p1.metadata.managedFields, undefined);
  assert.equal(p1.kind, undefined, "list items carry no kind, same as API-server LISTs");
  assert.ok(Object.isFrozen(p1.metadata));
  await tick();
  assert.equal(transport.watchCalls[0].query.resourceVersion, "10");
  assert.equal(transport.watchCalls[0].query.allowWatchBookmarks, "true");
  r.stop();
});

test("reflector applies ADDED / MODIFIED / DELETED / BOOKMARK and emits changes", async () => {
  const transport = fakeTransport({ pages: [list([pod("a", "p1", 1)], 5)] });
  const r = new Reflector({ kubeConfig: null, resource: getResource("pods"), transport });
  const changes = [];
  r.on("change", (c) => changes.push(c));
  r.start();
  await r.waitForSync(1000);
  await tick();
  const s = transport.streams[0];

  s.send("ADDED", pod("a", "p2", 6));
  s.send("MODIFIED", pod("a", "p1", 7, { phase: "Failed" }));
  s.send("DELETED", pod("a", "p2", 8));
  s.send("BOOKMARK", { metadata: { resourceVersion: "20" } });

  assert.equal(r.items.size, 1);
  assert.equal(r.get("a", "p1").status.phase, "Failed");
  assert.equal(r.resourceVersion, "20");
  assert.deepEqual(changes.map((c) => c.type), ["RESYNC", "ADDED", "MODIFIED", "DELETED"]);
  assert.equal(changes[1].objectNamespace, "a");
  r.stop();
});

test("reflector resumes the watch from the last resourceVersion after a clean close", async () => {
  const transport = fakeTransport({ pages: [list([], 5)] });
  const r = new Reflector({ kubeConfig: null, resource: getResource("pods"), transport });
  r.start();
  await r.waitForSync(1000);
  await tick();
  transport.streams[0].send("ADDED", pod("a", "p1", 9));
  transport.streams[0].end(null);
  await tick();
  assert.equal(transport.listCalls.length, 1, "no relist on a clean close");
  assert.equal(transport.watchCalls[1].query.resourceVersion, "9");
  r.stop();
});

test("reflector relists on 410 Gone (watch ERROR event) with a consistent list", async () => {
  const transport = fakeTransport({ pages: [list([pod("a", "p1", 1)], 5), list([pod("a", "p3", 30)], 30)] });
  const r = new Reflector({ kubeConfig: null, resource: getResource("pods"), transport });
  r.start();
  await r.waitForSync(1000);
  await tick();
  transport.streams[0].send("ERROR", { kind: "Status", code: 410, message: "too old resource version" });
  await tick(5);

  assert.equal(transport.listCalls.length, 2);
  assert.equal(transport.listCalls[1].query.resourceVersion, undefined);
  assert.deepEqual([...r.items.keys()], ["a/p3"]);
  assert.equal(r.stats.relistsAfterGone, 1);
  r.stop();
});

test("reflector restarts a paginated list when the continue token expires", async () => {
  const gone = Object.assign(new Error("expired"), { statusCode: 410 });
  const transport = fakeTransport({
    pages: [list([pod("a", "old", 1)], 5, "tok"), list([pod("a", "p1", 1), pod("a", "p2", 2)], 6)],
    listErrors: [undefined, gone],
  });
  const r = new Reflector({ kubeConfig: null, resource: getResource("pods"), transport, pageSize: 1 });
  r.start();
  await r.waitForSync(1000);
  assert.deepEqual([...r.items.keys()].sort(), ["a/p1", "a/p2"]);
  r.stop();
});

test("reflector backs off and retries transient watch errors without relisting", async () => {
  const transport = fakeTransport({ pages: [list([], 5)] });
  const r = new Reflector({ kubeConfig: null, resource: getResource("pods"), transport, random: () => 0 });
  r.start();
  await r.waitForSync(1000);
  await tick();
  transport.streams[0].end(Object.assign(new Error("reset"), { code: "ECONNRESET" }));
  await tick();
  assert.equal(r.status, "retrying");
  await tick(900); // backoff is 1s * 0.8 with random()=0
  assert.equal(transport.watchCalls.length, 2);
  assert.equal(transport.listCalls.length, 1);
  assert.equal(r.status, "ready");
  r.stop();
});

test("reflector fails fast on 403 and rejects sync waiters", async () => {
  const forbidden = Object.assign(new Error("forbidden"), { statusCode: 403 });
  const transport = fakeTransport({ listErrors: [forbidden] });
  const r = new Reflector({ kubeConfig: null, resource: getResource("pods"), transport });
  r.start();
  await assert.rejects(r.waitForSync(1000), /forbidden/);
  assert.equal(r.status, "failed");
  r.stop();
});

test("cluster cache falls back to a namespace-scoped reflector when cluster-wide is forbidden", async () => {
  const forbidden = Object.assign(new Error("forbidden"), { statusCode: 403 });
  const created = [];
  const cache = new ClusterCache({
    id: "t",
    kubeConfig: null,
    reflectorFactory: ({ resource, namespace }) => {
      const transport = namespace
        ? fakeTransport({ pages: [list([pod(namespace, "mine", 1)], 3)] })
        : fakeTransport({ listErrors: [forbidden] });
      const r = new Reflector({ kubeConfig: null, resource, namespace, transport });
      created.push(r.path);
      return r;
    },
  });

  const { items } = await cache.list("pods", "team-a");
  assert.deepEqual(items.map((p) => p.metadata.name), ["mine"]);
  assert.deepEqual(created, ["/api/v1/pods", "/api/v1/namespaces/team-a/pods"]);
  await assert.rejects(cache.list("pods"), /forbidden/);
  cache.stopAll();
});

test("cluster cache sweeps idle reflectors but keeps subscribed ones", async () => {
  const cache = new ClusterCache({
    id: "t",
    kubeConfig: null,
    options: { idleTtlMs: 10 },
    reflectorFactory: ({ resource, namespace }) =>
      new Reflector({ kubeConfig: null, resource, namespace, transport: fakeTransport({ pages: [list([], 1)] }) }),
  });
  await cache.list("nodes");
  const sub = cache.subscribe(["pods"], { onChange: () => {} });
  await sub.ready;
  const later = Date.now() + 1000;
  cache.sweep(later);
  assert.deepEqual([...cache.reflectors.keys()], ["pods"]);
  sub.unsubscribe();
  assert.equal(cache.sweep(later + 1000), true);
  assert.equal(cache.reflectors.size, 0);
});

test("secret values never enter the cache", () => {
  const t = makeTransform(getResource("secrets"));
  const s = t({ metadata: { name: "s", namespace: "a" }, data: { password: "c2VjcmV0" }, type: "Opaque" });
  assert.deepEqual(s.data, { password: "" });
});

test("last-applied-configuration is dropped, other annotations kept", () => {
  const t = makeTransform(getResource("deployments"));
  const d = t({ metadata: { name: "d", annotations: { "kubectl.kubernetes.io/last-applied-configuration": "{...}", keep: "me" } } });
  assert.deepEqual(d.metadata.annotations, { keep: "me" });
});

test("collection paths", () => {
  assert.equal(collectionPath(getResource("pods")), "/api/v1/pods");
  assert.equal(collectionPath(getResource("pods"), "kube-system"), "/api/v1/namespaces/kube-system/pods");
  assert.equal(collectionPath(getResource("deployments"), "x"), "/apis/apps/v1/namespaces/x/deployments");
  assert.equal(collectionPath(getResource("ingressclasses"), "ignored"), "/apis/networking.k8s.io/v1/ingressclasses");
  assert.equal(collectionPath(getResource("horizontalpodautoscalers")), "/apis/autoscaling/v2/horizontalpodautoscalers");
});

test("field selectors used by the detail handlers", () => {
  const ev = { involvedObject: { name: "web", kind: "Pod" }, metadata: { name: "e" } };
  assert.ok(compileSelectors({ fieldSelector: "involvedObject.name=web,involvedObject.kind=Pod" })(ev));
  assert.ok(!compileSelectors({ fieldSelector: "involvedObject.name=web,involvedObject.kind=Node" })(ev));
  const p = pod("a", "p", 1, { nodeName: "n1" });
  assert.ok(compileSelectors({ fieldSelector: "spec.nodeName=n1" })(p));
  assert.ok(compileSelectors({ fieldSelector: "spec.nodeName!=n2" })(p));
});

test("label selectors: equality, set-based and existence", () => {
  const obj = { metadata: { labels: { app: "web", tier: "fe", owner: "helm" } } };
  const m = (sel) => compileSelectors({ labelSelector: sel })(obj);
  assert.ok(m("owner=helm"));
  assert.ok(m("app in (web,api),tier"));
  assert.ok(!m("app notin (web)"));
  assert.ok(m("!missing"));
  assert.ok(!m("app!=web"));
  assert.equal(parseLabelSelector("bad selector ("), null);
  assert.equal(compileSelectors({ labelSelector: "bad selector (" }), null);
});

test("planFor maps typed client methods onto cache lookups", () => {
  assert.deepEqual(pick(planFor("core", "listPodForAllNamespaces")), ["pods", "list", false]);
  assert.deepEqual(pick(planFor("core", "listNamespacedPod")), ["pods", "list", true]);
  assert.deepEqual(pick(planFor("core", "readNamespacedPod")), ["pods", "read", true]);
  assert.deepEqual(pick(planFor("core", "listNamespace")), ["namespaces", "list", false]);
  assert.deepEqual(pick(planFor("core", "readNamespace")), ["namespaces", "read", false]);
  assert.deepEqual(pick(planFor("core", "listNamespacedEndpoints")), ["endpoints", "list", true]);
  assert.deepEqual(pick(planFor("networking", "listIngressClass")), ["ingressclasses", "list", false]);
  assert.deepEqual(pick(planFor("autoscaling", "listHorizontalPodAutoscalerForAllNamespaces")), ["horizontalpodautoscalers", "list", false]);
  // pass-through cases
  assert.equal(planFor("core", "readNamespacedPodLog"), null);
  assert.equal(planFor("apps", "readNamespacedDeploymentScale"), null);
  assert.equal(planFor("core", "readNamespacedSecret"), null, "secret reads need real data");
  assert.deepEqual(pick(planFor("core", "listSecretForAllNamespaces")), ["secrets", "list", false]);
  assert.equal(planFor("core", "listPod"), null, "namespaced kinds need an explicit scope");
  assert.equal(planFor("apps", "createNamespacedDeployment"), null);
});

function pick(p) {
  return p && [p.resource.key, p.op, p.namespacedCall];
}

test("deps parsing and matching", () => {
  const deps = parseDeps("pods@default,events,nodes@x,bogus,pods@default,pods@Bad_NS");
  assert.deepEqual(deps.map((d) => d.key), ["pods@default", "events"]);
  assert.ok(depMatches(deps[0], "pods", "default"));
  assert.ok(!depMatches(deps[0], "pods", "other"));
  assert.ok(depMatches(deps[0], "pods", null), "resyncs match every namespace");
  assert.ok(depMatches(deps[1], "events", "anything"));
});
