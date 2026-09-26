import { test } from "node:test";
import assert from "node:assert/strict";
import { diagnoseResource } from "./diagnostics.js";

const OLD = "2020-01-01T00:00:00Z";
const meta = (name, extra = {}) => ({ name, namespace: "demo", creationTimestamp: OLD, ...extra });
const readyPod = (name, labels, ports) => ({
  metadata: meta(name, { labels }),
  spec: { containers: [{ name: "app", ports }] },
  status: { phase: "Running", conditions: [{ type: "Ready", status: "True" }] },
});
const notReadyPod = (name, labels, ports) => ({
  ...readyPod(name, labels, ports),
  status: { phase: "Running", conditions: [{ type: "Ready", status: "False" }], containerStatuses: [{ name: "app", ready: false, restartCount: 0, state: { running: {} } }] },
});
const service = (spec, extra = {}) => ({ metadata: meta("web"), spec: { type: "ClusterIP", ...spec }, status: {}, ...extra });
const ep = (subsets) => ({ metadata: meta("web"), subsets });

// ---------- Service ----------

test("a Service whose selector matches no pods says so", () => {
  const [d] = diagnoseResource("service", { service: service({ selector: { app: "web" }, ports: [{ port: 80 }] }), endpoints: ep(undefined), podsUsingService: [] });
  assert.equal(d.issue, "No pods match this Service");
  assert.equal(d.severity, "Critical");
  assert.match(d.rootCause, /labeled app=web/);
  assert.match(d.remediation.join("\n"), /pod template's labels/);
});

test("a Service whose matching pods aren't ready points at the pods", () => {
  const [d] = diagnoseResource("service", {
    service: service({ selector: { app: "web" }, ports: [{ port: 80 }] }),
    endpoints: ep([{ notReadyAddresses: [{ ip: "10.0.0.1" }] }]),
    podsUsingService: [notReadyPod("web-1", { app: "web" })],
  });
  assert.equal(d.issue, "Matching pods aren't ready");
  assert.match(d.rootCause, /1 pod matches this Service, but it isn't ready/);
  assert.match(d.evidence.join("\n"), /web-1/);
});

test("a healthy Service has no findings", () => {
  assert.deepEqual(
    diagnoseResource("service", {
      service: service({ selector: { app: "web" }, ports: [{ port: 80, targetPort: 8080 }] }),
      endpoints: ep([{ addresses: [{ ip: "10.0.0.1" }] }]),
      podsUsingService: [readyPod("web-1", { app: "web" }, [{ containerPort: 8080 }])],
    }),
    [],
  );
});

test("a named targetPort that no pod defines is critical", () => {
  const ds = diagnoseResource("service", {
    service: service({ selector: { app: "web" }, ports: [{ port: 80, targetPort: "http" }] }),
    endpoints: ep([{ addresses: [{ ip: "10.0.0.1" }] }]),
    podsUsingService: [readyPod("web-1", { app: "web" }, [{ name: "metrics", containerPort: 9090 }])],
  });
  assert.equal(ds[0].issue, "Service points at a port name no pod defines");
  assert.match(ds[0].rootCause, /"http"/);
});

test("a numeric targetPort not declared by any pod is only a warning, since declaring ports is optional", () => {
  const ds = diagnoseResource("service", {
    service: service({ selector: { app: "web" }, ports: [{ port: 80, targetPort: 8080 }] }),
    endpoints: ep([{ addresses: [{ ip: "10.0.0.1" }] }]),
    podsUsingService: [readyPod("web-1", { app: "web" }, [{ containerPort: 3000 }])],
  });
  assert.equal(ds[0].severity, "Warning");
  assert.match(ds[0].remediation.join("\n"), /false alarm/);
  assert.deepEqual(
    diagnoseResource("service", {
      service: service({ selector: { app: "web" }, ports: [{ port: 80, targetPort: 8080 }] }),
      endpoints: ep([{ addresses: [{ ip: "10.0.0.1" }] }]),
      podsUsingService: [readyPod("web-1", { app: "web" }, undefined)],
    }),
    [],
  );
});

test("a selector-less Service with no endpoints and an ExternalName Service", () => {
  assert.equal(diagnoseResource("service", { service: service({ ports: [{ port: 80 }] }), endpoints: null, podsUsingService: [] })[0].issue, "No selector and no manual endpoints");
  assert.deepEqual(diagnoseResource("service", { service: service({ type: "ExternalName", externalName: "db.example" }), endpoints: null, podsUsingService: [] }), []);
});

test("a LoadBalancer with no address after 5 minutes is flagged, a young one is not", () => {
  const lb = (created) => service({ type: "LoadBalancer", selector: { app: "web" }, ports: [{ port: 80 }] }, { metadata: meta("web", { creationTimestamp: created }) });
  const ok = { endpoints: ep([{ addresses: [{ ip: "1" }] }]), podsUsingService: [readyPod("w", { app: "web" })] };
  const [d] = diagnoseResource("service", { service: lb(OLD), ...ok });
  assert.equal(d.issue, "No external address assigned");
  assert.deepEqual(diagnoseResource("service", { service: lb(new Date().toISOString()), ...ok }), []);
  const withAddress = { ...lb(OLD), status: { loadBalancer: { ingress: [{ ip: "1.2.3.4" }] } } };
  assert.deepEqual(diagnoseResource("service", { service: withAddress, ...ok }), []);
});

// ---------- Endpoints ----------

test("endpoints with only not-ready addresses and empty endpoints are distinguished", () => {
  const nr = diagnoseResource("endpoints", { endpoints: ep([{ notReadyAddresses: [{ ip: "1", targetRef: { name: "web-1" } }] }]) })[0];
  assert.equal(nr.issue, "Backing pods aren't ready");
  assert.match(nr.evidence.join("\n"), /web-1 is not ready/);
  assert.equal(diagnoseResource("endpoints", { endpoints: ep(undefined) })[0].issue, "No addresses behind this Service");
  assert.deepEqual(diagnoseResource("endpoints", { endpoints: ep([{ addresses: [{ ip: "1" }] }]) }), []);
});

test("leader-election endpoints are not reported as empty", () => {
  const leader = { metadata: meta("kube-scheduler", { annotations: { "control-plane.alpha.kubernetes.io/leader": "{}" } }) };
  assert.deepEqual(diagnoseResource("endpoints", { endpoints: leader }), []);
});

// ---------- Ingress ----------

const ingress = (spec, extra = {}) => ({
  metadata: meta("site"),
  spec,
  status: { loadBalancer: { ingress: [{ ip: "1.2.3.4" }] } },
  ...extra,
});
const rule = (svc, port = { number: 80 }, host = "a.example", path = "/") => ({ host, http: { paths: [{ path, backend: { service: { name: svc, port } } }] } });
const classes = [{ name: "nginx", isDefault: true }];
const services = [{ name: "web", ports: [{ port: 80 }] }];

test("an Ingress route to a missing Service is critical", () => {
  const ds = diagnoseResource("ingress", { ingress: ingress({ ingressClassName: "nginx", rules: [rule("gone")] }), services, ingressClasses: classes, tlsSecrets: {} });
  assert.equal(ds[0].issue, "Route points to a Service that doesn't exist");
  assert.match(ds[0].evidence.join("\n"), /a\.example\/ → Service "gone" \(not found\)/);
});

test("an Ingress route to a port the Service doesn't expose is critical", () => {
  const ds = diagnoseResource("ingress", { ingress: ingress({ ingressClassName: "nginx", rules: [rule("web", { number: 8080 })] }), services, ingressClasses: classes, tlsSecrets: {} });
  assert.equal(ds[0].issue, "Route points to a port the Service doesn't expose");
  assert.match(ds[0].evidence.join("\n"), /web:8080.*exposes 80/);
});

test("a named backend port is matched by name", () => {
  const named = [{ name: "web", ports: [{ port: 80, name: "http" }] }];
  assert.deepEqual(diagnoseResource("ingress", { ingress: ingress({ ingressClassName: "nginx", rules: [rule("web", { name: "http" })] }), services: named, ingressClasses: classes, tlsSecrets: {} }), []);
});

test("an unknown ingress class and a missing default class are reported", () => {
  const unknown = diagnoseResource("ingress", { ingress: ingress({ ingressClassName: "traefik", rules: [rule("web")] }), services, ingressClasses: classes, tlsSecrets: {} });
  assert.equal(unknown[0].issue, "Ingress class doesn't exist");
  const noDefault = diagnoseResource("ingress", { ingress: ingress({ rules: [rule("web")] }), services, ingressClasses: [{ name: "nginx", isDefault: false }], tlsSecrets: {} });
  assert.equal(noDefault[0].issue, "No ingress class, and the cluster has no default");
  assert.deepEqual(diagnoseResource("ingress", { ingress: ingress({ rules: [rule("web")] }), services, ingressClasses: classes, tlsSecrets: {} }), []);
});

test("a missing TLS Secret is critical; an unknown one (no permission) is not", () => {
  const spec = { ingressClassName: "nginx", tls: [{ secretName: "site-tls" }], rules: [rule("web")] };
  const missing = diagnoseResource("ingress", { ingress: ingress(spec), services, ingressClasses: classes, tlsSecrets: { "site-tls": false } })[0];
  assert.equal(missing.issue, "TLS certificate Secret is missing");
  assert.match(missing.rootCause, /"site-tls"/);
  assert.deepEqual(diagnoseResource("ingress", { ingress: ingress(spec), services, ingressClasses: classes, tlsSecrets: { "site-tls": null } }), []);
});

test("an Ingress with no address says the cluster has no controller when there are no classes", () => {
  const noAddress = ingress({ rules: [rule("web")] }, { status: {} });
  const [d] = diagnoseResource("ingress", { ingress: noAddress, services, ingressClasses: [], tlsSecrets: {} }).filter((x) => x.id === "ingress:no-address");
  assert.equal(d.issue, "Not picked up by any controller");
  assert.match(d.rootCause, /no ingress controller installed/);
  assert.match(d.remediation.join("\n"), /ingress-nginx/);
  const young = ingress({ rules: [rule("web")] }, { status: {}, metadata: meta("site", { creationTimestamp: new Date().toISOString() }) });
  assert.equal(diagnoseResource("ingress", { ingress: young, services, ingressClasses: classes, tlsSecrets: {} }).filter((x) => x.id === "ingress:no-address").length, 0);
});

test("ingress checks that need extra data are skipped when it is unavailable", () => {
  assert.deepEqual(diagnoseResource("ingress", { ingress: ingress({ ingressClassName: "x", rules: [rule("gone")] }) }), []);
});

// ---------- IngressClass ----------

test("two default ingress classes are flagged", () => {
  const ic = { metadata: meta("nginx", { annotations: { "ingressclass.kubernetes.io/is-default-class": "true" } }) };
  const [d] = diagnoseResource("ingressclass", { ingressClass: ic, allClasses: [{ name: "nginx", isDefault: true }, { name: "traefik", isDefault: true }] });
  assert.equal(d.issue, "More than one default ingress class");
  assert.match(d.rootCause, /"traefik"/);
  assert.deepEqual(diagnoseResource("ingressclass", { ingressClass: ic, allClasses: [{ name: "nginx", isDefault: true }] }), []);
});

// ---------- NetworkPolicy ----------

const policy = (spec) => ({ metadata: meta("p"), spec: { podSelector: {}, ...spec } });
const labeled = (name, labels) => ({ metadata: meta(name, { labels }), status: { phase: "Running" }, spec: {} });

test("a policy that selects no pods is flagged, an empty selector is not", () => {
  const [d] = diagnoseResource("networkpolicy", { networkPolicy: policy({ podSelector: { matchLabels: { app: "db" } } }), pods: [labeled("web", { app: "web" })] });
  assert.equal(d.issue, "Doesn't apply to any pods");
  assert.deepEqual(diagnoseResource("networkpolicy", { networkPolicy: policy({}), pods: [] }), []);
  assert.deepEqual(diagnoseResource("networkpolicy", { networkPolicy: policy({ podSelector: { matchLabels: { app: "web" } } }), pods: [labeled("web", { app: "web" })] }), []);
});

test("an egress policy with no rules blocks DNS too", () => {
  const [d] = diagnoseResource("networkpolicy", { networkPolicy: policy({ policyTypes: ["Egress"] }), pods: [labeled("web", {})] });
  assert.equal(d.issue, "Blocks all outgoing traffic, including DNS");
});

test("egress rules that don't allow port 53 may block DNS", () => {
  const blocked = policy({ policyTypes: ["Egress"], egress: [{ ports: [{ port: 5432, protocol: "TCP" }] }] });
  assert.equal(diagnoseResource("networkpolicy", { networkPolicy: blocked, pods: [labeled("web", {})] })[0].issue, "May block DNS lookups");
  const allowed = policy({ policyTypes: ["Egress"], egress: [{ ports: [{ port: 5432 }] }, { ports: [{ port: 53, protocol: "UDP" }] }] });
  assert.deepEqual(diagnoseResource("networkpolicy", { networkPolicy: allowed, pods: [labeled("web", {})] }), []);
  const allPorts = policy({ policyTypes: ["Egress"], egress: [{ to: [{ ipBlock: { cidr: "10.0.0.0/8" } }] }] });
  assert.deepEqual(diagnoseResource("networkpolicy", { networkPolicy: allPorts, pods: [labeled("web", {})] }), []);
});

test("an ingress-only default-deny policy is not reported", () => {
  assert.deepEqual(diagnoseResource("networkpolicy", { networkPolicy: policy({ policyTypes: ["Ingress"] }), pods: [labeled("web", {})] }), []);
});
