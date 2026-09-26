import { test } from "node:test";
import assert from "node:assert/strict";
import { diagnoseResource } from "./diagnostics.js";
import * as f from "./__fixtures__/pods.js";

const OLD = "2020-01-01T00:00:00Z";
const meta = (name, extra = {}) => ({ name, creationTimestamp: OLD, ...extra });
const cond = (type, status, extra = {}) => ({ type, status, ...extra });

// ---------- Node ----------

const node = (conditions, extra = {}) => ({
  metadata: meta("n1"),
  spec: {},
  status: { conditions, allocatable: { cpu: "4", memory: "8Gi", pods: "110" }, ...extra },
});
const healthyConditions = [cond("Ready", "True"), cond("MemoryPressure", "False"), cond("DiskPressure", "False"), cond("PIDPressure", "False")];
const podWith = (name, requests, phase = "Running") => ({ metadata: { name, namespace: "d" }, status: { phase }, spec: { containers: [{ name: "c", resources: { requests } }] } });

test("a healthy node has no findings", () => {
  assert.deepEqual(diagnoseResource("node", { node: node(healthyConditions), pods: [podWith("a", { cpu: "100m", memory: "128Mi" })], events: [] }), []);
});

test("a node that stopped reporting and one that is not ready are described differently", () => {
  const unknown = diagnoseResource("node", { node: node([cond("Ready", "Unknown", { reason: "NodeStatusUnknown", message: "Kubelet stopped posting node status." })]), pods: [] })[0];
  assert.equal(unknown.issue, "Machine stopped reporting");
  assert.equal(unknown.severity, "Critical");
  assert.match(unknown.rootCause, /switched off, crashed/);
  const notReady = diagnoseResource("node", { node: node([cond("Ready", "False", { message: "container runtime is down" })]), pods: [] })[0];
  assert.equal(notReady.issue, "Machine isn't ready");
  assert.match(notReady.evidence.join("\n"), /container runtime is down/);
});

test("memory, disk and process pressure each get their own explanation", () => {
  const ds = diagnoseResource("node", { node: node([cond("Ready", "True"), cond("MemoryPressure", "True", { message: "low memory" }), cond("DiskPressure", "True"), cond("PIDPressure", "True")]), pods: [] });
  assert.deepEqual(ds.map((d) => d.issue).sort(), ["Running low on disk space", "Running low on memory", "Running too many processes"]);
  assert.ok(ds.every((d) => d.severity === "Critical"));
});

test("a cordoned node tells you how to uncordon it", () => {
  const [d] = diagnoseResource("node", { node: { ...node(healthyConditions), spec: { unschedulable: true } }, pods: [] });
  assert.equal(d.issue, "Won't accept new pods");
  assert.match(d.remediation.join("\n"), /kubectl uncordon n1/);
});

test("a node whose pods have reserved over 90% of its CPU is nearly full", () => {
  const [d] = diagnoseResource("node", { node: node(healthyConditions), pods: [podWith("a", { cpu: "3", memory: "1Gi" }), podWith("b", { cpu: "700m" })] });
  assert.equal(d.issue, "Almost fully booked");
  assert.match(d.evidence.join("\n"), /CPU: 3\.70 cores of 4\.00 cores reserved by pods \(93%\)/);
  assert.doesNotMatch(d.rootCause, /memory/);
});

test("finished pods don't count toward a node's reservations", () => {
  assert.deepEqual(diagnoseResource("node", { node: node(healthyConditions), pods: [podWith("done", { cpu: "4" }, "Succeeded")] }), []);
});

test("failing pods on a node are listed by reason", () => {
  const [d] = diagnoseResource("node", { node: node(healthyConditions), pods: [f.crashLoopAppPod, f.imagePullPod, f.healthyPod] });
  assert.equal(d.issue, "2 pods on this machine are failing");
  assert.match(d.evidence.join("\n"), /CrashLoopBackOff: crash-app/);
  assert.match(d.evidence.join("\n"), /ImagePullBackOff: image-pull/);
});

// ---------- Namespace ----------

const ns = (extra = {}) => ({ metadata: meta("demo"), status: { phase: "Active" }, ...extra });
const quota = (name, hard, used) => ({ metadata: { name, namespace: "demo" }, status: { hard, used } });

test("a healthy namespace has no findings", () => {
  assert.deepEqual(diagnoseResource("namespace", { ns: ns(), pods: [f.healthyPod], quotas: [quota("q", { pods: "10" }, { pods: "1" })] }), []);
});

test("a namespace stuck terminating names what is blocking it", () => {
  const stuck = ns({
    metadata: meta("demo", { deletionTimestamp: OLD }),
    status: {
      phase: "Terminating",
      conditions: [
        cond("NamespaceDeletionDiscoveryFailure", "True", { message: "Discovery failed for some groups: metrics.k8s.io/v1beta1: not available" }),
        cond("NamespaceContentRemaining", "False", { message: "gone" }),
      ],
    },
  });
  const [d] = diagnoseResource("namespace", { ns: stuck, pods: [], quotas: [] });
  assert.equal(d.issue, "Stuck deleting");
  assert.equal(d.severity, "Critical");
  assert.match(d.evidence.join("\n"), /metrics\.k8s\.io/);
  assert.match(d.remediation.join("\n"), /kubectl get apiservice/);
  assert.doesNotMatch(d.evidence.join("\n"), /gone/);
});

test("a namespace that just started terminating is left alone", () => {
  const fresh = ns({ metadata: meta("demo", { deletionTimestamp: new Date().toISOString() }), status: { phase: "Terminating" } });
  assert.deepEqual(diagnoseResource("namespace", { ns: fresh, pods: [], quotas: [] }), []);
});

test("full quotas in a namespace are named", () => {
  const [d] = diagnoseResource("namespace", { ns: ns(), pods: [], quotas: [quota("team-quota", { pods: "5" }, { pods: "5" })] });
  assert.equal(d.issue, 'Quota "team-quota" is full');
  assert.equal(d.severity, "Critical");
});

test("failing pods are counted, and escalate when half or more fail", () => {
  const some = diagnoseResource("namespace", { ns: ns(), pods: [f.crashLoopAppPod, f.healthyPod, f.healthyPod, f.healthyPod], quotas: [] })[0];
  assert.equal(some.issue, "1 of 4 pods is failing");
  assert.equal(some.severity, "Warning");
  const most = diagnoseResource("namespace", { ns: ns(), pods: [f.crashLoopAppPod, f.imagePullPod, f.healthyPod], quotas: [] })[0];
  assert.equal(most.severity, "Critical");
});

// ---------- HPA ----------

const hpa = (conditions, extra = {}) => ({
  metadata: { name: "web-hpa", namespace: "demo" },
  spec: { scaleTargetRef: { kind: "Deployment", name: "web" }, maxReplicas: 3 },
  status: { conditions, currentReplicas: 3, desiredReplicas: 5 },
  ...extra,
});

test("an autoscaler with no metrics server explains how to install it", () => {
  const [d] = diagnoseResource("hpa", {
    hpa: hpa([cond("ScalingActive", "False", { reason: "FailedGetResourceMetric", message: "the HPA was unable to compute the replica count: failed to get cpu utilization: unable to get metrics for resource cpu: unable to fetch metrics from resource metrics API: the server could not find the requested resource (get pods.metrics.k8s.io)" })]),
  });
  assert.equal(d.issue, "Metrics aren't available");
  assert.equal(d.severity, "Critical");
  assert.match(d.remediation.join("\n"), /metrics-server/);
  assert.match(d.remediation.join("\n"), /Docker Desktop/);
});

test("an autoscaler whose pods have no CPU request says to set one", () => {
  const [d] = diagnoseResource("hpa", { hpa: hpa([cond("ScalingActive", "False", { reason: "FailedGetResourceMetric", message: "failed to get cpu utilization: missing request for cpu in container app of Pod web-1" })]) });
  assert.equal(d.issue, "Pods don't set a CPU request");
  assert.match(d.remediation.join("\n"), /resources\.requests\.cpu/);
});

test("an autoscaler that can't find its target", () => {
  const [d] = diagnoseResource("hpa", { hpa: hpa([cond("AbleToScale", "False", { reason: "FailedGetScale", message: 'deployments/scale.apps "web" not found' })]) });
  assert.equal(d.issue, "Can't find what to scale");
  assert.match(d.rootCause, /Deployment "web"/);
});

test("an autoscaler at its maximum is a warning", () => {
  const [d] = diagnoseResource("hpa", { hpa: hpa([cond("ScalingLimited", "True", { reason: "TooManyReplicas" })]) });
  assert.equal(d.issue, "Already at its maximum size");
  assert.equal(d.severity, "Warning");
  assert.match(d.evidence.join("\n"), /maximum: 3/);
});

test("a working autoscaler has no findings", () => {
  assert.deepEqual(diagnoseResource("hpa", { hpa: hpa([cond("AbleToScale", "True"), cond("ScalingActive", "True"), cond("ScalingLimited", "False", { reason: "DesiredWithinRange" })]) }), []);
});
