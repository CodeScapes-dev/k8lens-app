import { test } from "node:test";
import assert from "node:assert/strict";
import { diagnoseResource } from "./diagnostics.js";

const meta = (name, extra = {}) => ({ name, namespace: "demo", creationTimestamp: new Date().toISOString(), ...extra });
const pod = (name, spec, phase = "Running") => ({ metadata: meta(name), status: { phase }, spec: { containers: [], ...spec } });
const text = (d) => [d.issue, d.rootCause, ...d.evidence, ...d.remediation].join("\n");

// ---------- ResourceQuota ----------

const quota = (hard, used) => ({ metadata: meta("demo-quota"), spec: { hard }, status: { hard, used } });

test("a full quota is critical and names what ran out in plain words", () => {
  const [d] = diagnoseResource("resourcequota", {
    resourceQuota: quota({ pods: "20", "requests.cpu": "2", "requests.memory": "2Gi" }, { pods: "20", "requests.cpu": "500m", "requests.memory": "1Gi" }),
  });
  assert.equal(d.issue, "Quota is full");
  assert.equal(d.severity, "Critical");
  assert.match(d.rootCause, /allowance for pods/);
  assert.match(d.evidence.join("\n"), /pods: 20 of 20 used \(100%\)/);
  assert.match(d.remediation.join("\n"), /kubectl edit resourcequota demo-quota -n demo/);
});

test("quantities with different units are compared correctly", () => {
  const [d] = diagnoseResource("resourcequota", { resourceQuota: quota({ "requests.memory": "2Gi", "requests.cpu": "2" }, { "requests.memory": "2048Mi", "requests.cpu": "1900m" }) });
  assert.equal(d.issue, "Quota is full");
  assert.match(d.rootCause, /memory requests/);
  assert.match(d.evidence.join("\n"), /requests\.cpu: 1900m of 2 used \(95%\)/);
});

test("a nearly full quota is only a warning", () => {
  const [d] = diagnoseResource("resourcequota", { resourceQuota: quota({ pods: "20" }, { pods: "19" }) });
  assert.equal(d.issue, "Quota is almost full");
  assert.equal(d.severity, "Warning");
});

test("a quota with headroom has no findings", () => {
  assert.deepEqual(diagnoseResource("resourcequota", { resourceQuota: quota({ pods: "20", "limits.cpu": "4" }, { pods: "3", "limits.cpu": "1" }) }), []);
});

// ---------- LimitRange ----------

const limitRange = { metadata: meta("limits"), spec: { limits: [{ type: "Container", max: { memory: "512Mi", cpu: "1" }, min: { cpu: "50m" } }] } };
const sized = (name, resources) => pod(name, { containers: [{ name: "app", resources }] });

test("pods outside a LimitRange's range are listed", () => {
  const [d] = diagnoseResource("limitrange", {
    limitRange,
    pods: [sized("big", { limits: { memory: "1Gi" } }), sized("tiny", { requests: { cpu: "10m" } }), sized("fine", { limits: { memory: "256Mi", cpu: "500m" }, requests: { cpu: "100m" } })],
  });
  assert.equal(d.issue, "Some pods don't fit these limits");
  assert.match(d.rootCause, /2 running pods/);
  assert.match(d.evidence.join("\n"), /big: app: memory limit 1Gi is above the maximum 512Mi/);
  assert.match(d.evidence.join("\n"), /tiny: app: cpu request 10m is below the minimum 50m/);
  assert.doesNotMatch(d.evidence.join("\n"), /fine/);
});

test("finished pods and compliant pods are ignored by the LimitRange check", () => {
  assert.deepEqual(diagnoseResource("limitrange", { limitRange, pods: [sized("done", { limits: { memory: "2Gi" } })].map((p) => ({ ...p, status: { phase: "Succeeded" } })) }), []);
  assert.deepEqual(diagnoseResource("limitrange", { limitRange, pods: [] }), []);
});

// ---------- ConfigMap ----------

const configMap = (data, extra = {}) => ({ metadata: meta("app-config"), data, ...extra });
const withEnv = (name, key, extra = {}) =>
  pod(name, { containers: [{ name: "app", env: [{ name: "GREETING", valueFrom: { configMapKeyRef: { name: "app-config", key, ...extra } } }] }] });

test("pods that ask for a missing ConfigMap key are called out", () => {
  const [d] = diagnoseResource("configmap", { configMap: configMap({ OTHER: "x" }), pods: [withEnv("web-1", "GREETING"), withEnv("web-2", "GREETING")] });
  assert.equal(d.severity, "Critical");
  assert.match(d.issue, /Pods expect a setting this ConfigMap doesn't have/);
  assert.match(d.rootCause, /2 pods ask for the entry "GREETING"/);
  assert.match(d.evidence.join("\n"), /"GREETING" needed by web-1, container app \(environment variable GREETING\)/);
});

test("optional references and existing keys are fine", () => {
  assert.deepEqual(diagnoseResource("configmap", { configMap: configMap({ GREETING: "hi" }), pods: [withEnv("a", "GREETING"), withEnv("b", "NOPE", { optional: true })] }), []);
});

test("volume items and projected sources are checked too", () => {
  const volPod = pod("vol", { volumes: [{ name: "cfg", configMap: { name: "app-config", items: [{ key: "app.yaml", path: "app.yaml" }] } }] });
  const projPod = pod("proj", { volumes: [{ name: "p", projected: { sources: [{ configMap: { name: "app-config", items: [{ key: "extra.yaml", path: "x" }] } }] } }] });
  const [d] = diagnoseResource("configmap", { configMap: configMap({ other: "1" }), pods: [volPod, projPod] });
  assert.match(d.rootCause, /"app\.yaml" and "extra\.yaml"/);
});

test("an empty ConfigMap is a warning", () => {
  const [d] = diagnoseResource("configmap", { configMap: configMap(undefined), pods: [] });
  assert.equal(d.issue, "ConfigMap is empty");
  assert.equal(d.severity, "Warning");
});

test("a ConfigMap near the 1 MiB limit is flagged", () => {
  const [d] = diagnoseResource("configmap", { configMap: configMap({ big: "x".repeat(1000 * 1024) }), pods: [] });
  assert.equal(d.issue, "Close to the size limit");
});

test("ConfigMap values never appear in the output", () => {
  const ds = diagnoseResource("configmap", { configMap: configMap({ SECRET_LOOKING: "hunter2-value" }), pods: [withEnv("web", "MISSING")] });
  assert.doesNotMatch(JSON.stringify(ds), /hunter2-value/);
});

// ---------- Secret ----------

const secret = (type, data, extra = {}) => ({ metadata: meta("s", extra), type, data });

test("a TLS secret without its key is critical", () => {
  const [d] = diagnoseResource("secret", { secret: secret("kubernetes.io/tls", { "tls.crt": "AAAA" }), pods: [] });
  assert.equal(d.issue, "Secret is missing entries its type requires");
  assert.match(d.rootCause, /"tls\.key" is missing/);
});

test("registry and basic-auth secrets are validated by type", () => {
  const docker = diagnoseResource("secret", { secret: secret("kubernetes.io/dockerconfigjson", { other: "x" }), pods: [] })[0];
  assert.match(docker.rootCause, /"\.dockerconfigjson"/);
  const basic = diagnoseResource("secret", { secret: secret("kubernetes.io/basic-auth", { foo: "x" }), pods: [] })[0];
  assert.match(basic.rootCause, /at least one of "username" and "password"/);
  assert.deepEqual(diagnoseResource("secret", { secret: secret("kubernetes.io/basic-auth", { password: "x" }), pods: [] }), []);
});

test("pods asking for a missing Secret key are called out", () => {
  const p = pod("api", { containers: [{ name: "app", env: [{ name: "DB_PASSWORD", valueFrom: { secretKeyRef: { name: "s", key: "db-password" } } }] }] });
  const [d] = diagnoseResource("secret", { secret: secret("Opaque", { other: "x" }), pods: [p] });
  assert.equal(d.severity, "Critical");
  assert.match(d.rootCause, /"db-password"/);
  assert.match(d.issue, /this Secret doesn't have/);
});

test("an empty Opaque secret and an old secret are warnings", () => {
  assert.equal(diagnoseResource("secret", { secret: secret("Opaque", undefined), pods: [] })[0].issue, "Secret is empty");
  const old = diagnoseResource("secret", { secret: secret("Opaque", { k: "v" }, { creationTimestamp: "2020-01-01T00:00:00Z" }), pods: [] })[0];
  assert.equal(old.issue, "Not changed in over 180 days");
  assert.deepEqual(diagnoseResource("secret", { secret: secret("kubernetes.io/service-account-token", { token: "t" }, { creationTimestamp: "2020-01-01T00:00:00Z" }), pods: [] }), []);
});

test("Secret values never appear in the output", () => {
  const ds = diagnoseResource("secret", { secret: secret("kubernetes.io/tls", { "tls.crt": "PRIVATE-CERT-BODY" }), pods: [] });
  assert.doesNotMatch(JSON.stringify(ds), /PRIVATE-CERT-BODY/);
});
