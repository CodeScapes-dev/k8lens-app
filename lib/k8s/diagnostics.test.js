import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { diagnoseResource, classifyCrashLoop, isOomKilled, isStuckPending } from "./diagnostics.js";
import * as f from "./__fixtures__/pods.js";

const podDiag = (pod, extra = {}) => diagnoseResource("pod", { pod, events: [], ...extra });
const text = (d) => [d.issue, d.rootCause, ...d.evidence, ...d.remediation].join("\n");

test("AC1: missing ConfigMap key names the ConfigMap and key", () => {
  const [d] = podDiag(f.configMissingPod, { events: f.configMissingEvents });
  assert.equal(d.issue, "Missing configuration");
  assert.equal(d.technicalName, "CrashLoopBackOff");
  assert.match(d.rootCause, /"GREETING"/);
  assert.match(d.rootCause, /ConfigMap "demo-config"/);
  assert.match(d.remediation.join("\n"), /Add "GREETING"/);
});

test("AC1b: 'not found' ConfigMap event is classified as config", () => {
  const events = [{ type: "Warning", reason: "FailedMount", message: 'MountVolume.SetUp failed: configmap "app-cfg" not found' }];
  const [d] = podDiag(f.configMissingPod, { events });
  assert.match(d.rootCause, /ConfigMap "app-cfg".*doesn't exist/);
});

test("AC2: app crash reports exit code and points to logs without guessing a cause", () => {
  const [d] = podDiag(f.crashLoopAppPod);
  assert.equal(d.issue, "App keeps crashing");
  assert.equal(d.technicalName, "CrashLoopBackOff");
  assert.match(d.rootCause, /exit code 1/);
  assert.match(d.remediation.join("\n"), /Logs tab/);
});

test("AC3: OOMKilled is distinct from generic CrashLoopBackOff", () => {
  const [d] = podDiag(f.oomPod);
  assert.equal(d.issue, "Ran out of memory");
  assert.equal(d.technicalName, "OOMKilled");
  assert.match(d.remediation.join("\n"), /raising its memory limit/);
  assert.match(d.remediation.join("\n"), /memory leak/);
});

test("AC4: unmatched nodeSelector names key/value and node counts, offers both fixes", () => {
  const [d] = podDiag(f.pendingSelectorPod, { nodes: f.plainNodes });
  assert.equal(d.issue, "Can't find a machine to run on");
  assert.equal(d.technicalName, "Pending");
  assert.equal(d.severity, "Critical");
  assert.match(d.rootCause, /0 of 2 machines have the label disktype=ssd/);
  const r = d.remediation.join("\n");
  assert.match(r, /kubectl label node <node-name> disktype=ssd/);
  assert.match(r, /Remove the "disktype: ssd" requirement/);
});

test("AC4b: selector matching only some nodes does not claim a mismatch", () => {
  const events = [f.failedSchedulingEvent("0/3 nodes are available: 3 Insufficient cpu.")];
  const [d] = podDiag(f.pendingSelectorPod, { nodes: f.ssdNodes, events });
  assert.equal(d.severity, "Warning");
  assert.match(d.rootCause, /Insufficient cpu/);
  assert.doesNotMatch(d.rootCause, /None of the/);
});

test("AC5: untolerated taint names key/value/effect and node count, offers both fixes", () => {
  const [d] = podDiag(f.pendingTaintPod, { nodes: f.allTaintedNodes });
  assert.match(d.rootCause, /2 of 2 machines are reserved for other workloads \(taint dedicated=gpu:NoSchedule\)/);
  const r = d.remediation.join("\n");
  assert.match(r, /adding a toleration for dedicated=gpu:NoSchedule/);
  assert.match(r, /kubectl taint nodes <node-name> dedicated=gpu:NoSchedule-/);
});

test("AC5b: a matching toleration removes the taint from the diagnosis", () => {
  const [d] = podDiag(f.pendingTolerationPod, { nodes: f.allTaintedNodes });
  assert.equal(d.severity, "Warning");
  assert.doesNotMatch(d.rootCause, /taint/);
});

test("required nodeAffinity mismatch is reported per expression", () => {
  const [d] = podDiag(f.pendingAffinityPod, { nodes: f.plainNodes });
  assert.match(d.rootCause, /0 of 2 machines match the pod's placement rule "zone In \[us-east-1a\]"/);
});

test("AC6: healthy pod produces no diagnostics", () => {
  assert.deepEqual(podDiag(f.healthyPod), []);
  assert.deepEqual(diagnoseResource("pod", { pod: f.healthyPod, events: [], nodes: f.plainNodes }), []);
});

test("AC9: missing node access degrades with an explicit message", () => {
  const [d] = podDiag(f.pendingSelectorPod, { nodesError: true, events: [f.failedSchedulingEvent("0/1 nodes are available")] });
  assert.match(text(d), /Couldn't check the cluster's machines/);
  assert.match(d.rootCause, /0\/1 nodes are available/);
  const [noNodes] = podDiag(f.pendingSelectorPod);
  assert.match(text(noNodes), /Couldn't check the cluster's machines/);
});

test("young Pending pod is not flagged", () => {
  assert.deepEqual(podDiag(f.pendingYoungPod(), { nodes: f.plainNodes }), []);
  assert.equal(isStuckPending(f.pendingYoungPod()), false);
  assert.equal(isStuckPending(f.pendingOldPod), true);
});

test("scheduled pods are never diagnosed as unschedulable", () => {
  const pod = { ...f.pendingOldPod, spec: { ...f.pendingOldPod.spec, nodeName: "node-1" } };
  const [d] = podDiag(pod, { nodes: f.plainNodes });
  assert.equal(d.issue, "Stuck starting up");
  assert.doesNotMatch(d.issue, /machine to run on/);
});

test("init container crash is reported as such", () => {
  const [d] = podDiag(f.initCrashPod);
  assert.match(d.id, /init:setup/);
  assert.match(d.rootCause, /"setup" startup step \(an init container\)/);
  assert.match(d.remediation.join("\n"), /init container section/);
});

test("exit code 0 crash loop is reported plainly as unusual", () => {
  const [d] = podDiag(f.cleanExitCrashPod);
  assert.match(d.rootCause, /exit code 0/);
  assert.match(d.rootCause, /unusual/);
});

test("multi-container pod reports only the crashing container", () => {
  const ds = podDiag(f.multiContainerPod);
  assert.equal(ds.length, 1);
  assert.match(ds[0].rootCause, /"sidecar" container/);
});

test("workload view merges identical causes across pods", () => {
  const second = { ...f.crashLoopAppPod, metadata: { ...f.crashLoopAppPod.metadata, name: "crash-app-2" } };
  const ds = diagnoseResource("deployment", { deployment: {}, pods: [f.crashLoopAppPod, second, f.healthyPod], events: [] });
  assert.equal(ds.length, 1);
  assert.deepEqual(ds[0].pods, ["crash-app", "crash-app-2"]);
});

test("old pod caught mid-restart in Error state is still reported", () => {
  const [d] = podDiag(f.oldFlappingPod);
  assert.equal(d.issue, "App keeps crashing");
  assert.match(d.evidence.join("\n"), /Restarted 10 times/);
});

test("a container that restarted long ago but is ready now is not flagged", () => {
  assert.deepEqual(podDiag(f.recoveredPod), []);
});

test("failing liveness check is called out instead of a generic crash", () => {
  const [d] = podDiag(f.livenessPod, { events: f.livenessEvents });
  assert.equal(d.issue, "Failing its health check");
  assert.match(d.rootCause, /liveness/);
  assert.match(d.evidence.join("\n"), /HTTP GET \/live on port 8080/);
  assert.match(d.evidence.join("\n"), /connection refused/);
});

test("image not found is explained with tag advice", () => {
  const [d] = podDiag(f.imagePullPod, { events: f.imagePullNotFoundEvents });
  assert.equal(d.issue, "Can't download the container image");
  assert.equal(d.technicalName, "ImagePullBackOff");
  assert.match(d.rootCause, /registry\.example\/team\/app:v9.*doesn't exist, or its tag is wrong/);
  assert.match(d.remediation.join("\n"), /typos/);
});

test("registry access denied points at pull secrets", () => {
  const [d] = podDiag(f.imagePullPod, { events: f.imagePullAuthEvents });
  assert.match(d.rootCause, /image name is wrong or the registry needs a login/);
  assert.match(d.remediation.join("\n"), /imagePullSecrets/);
});

test("image pull with no detail still produces a useful diagnosis", () => {
  const [d] = podDiag(f.imagePullPod);
  assert.match(d.rootCause, /couldn't download the image/);
});

test("CreateContainerConfigError with a missing key names the ConfigMap and key", () => {
  const [d] = podDiag(f.startErrorConfigPod);
  assert.equal(d.issue, "Missing configuration");
  assert.equal(d.technicalName, "CreateContainerConfigError");
  assert.match(d.rootCause, /"GREETING"/);
  assert.match(d.rootCause, /ConfigMap "demo-config"/);
});

test("other container start errors carry Kubernetes' message and a hint", () => {
  const [d] = podDiag(f.startErrorRootPod);
  assert.equal(d.issue, "Container can't start");
  assert.match(d.rootCause, /runAsNonRoot/);
  assert.match(d.remediation.join("\n"), /non-root/);
});

test("scheduled pod stuck on a volume mount explains the storage problem", () => {
  const [d] = podDiag(f.stuckMountPod, { events: f.stuckMountEvents });
  assert.equal(d.issue, "Can't attach its storage");
  assert.match(d.rootCause, /persistentvolumeclaim "data-claim" not found/);
  assert.match(d.remediation.join("\n"), /Bound/);
});

test("scheduled pod mounting a missing ConfigMap says so", () => {
  const [d] = podDiag(f.stuckMountPod, { events: f.stuckMissingConfigMapEvents });
  assert.equal(d.issue, "Waiting for missing configuration");
  assert.match(d.rootCause, /ConfigMap "app-cfg"/);
});

test("pod sandbox failures point at the network plugin", () => {
  const [d] = podDiag(f.stuckMountPod, { events: f.stuckSandboxEvents });
  assert.equal(d.issue, "Can't set up the pod's network");
  assert.match(d.remediation.join("\n"), /CNI/);
});

test("evicted pods name the resource that ran out", () => {
  const [d] = podDiag(f.evictedPod);
  assert.equal(d.technicalName, "Evicted");
  assert.match(d.rootCause, /ran low on memory/);
  assert.match(d.remediation.join("\n"), /kubectl delete pod evicted/);
});

test("failed pods report the exit code", () => {
  const [d] = podDiag(f.failedExitPod);
  assert.equal(d.issue, "Pod failed");
  assert.match(d.rootCause, /exit code 2/);
});

test("running-but-not-ready pods show the failing readiness check", () => {
  const [d] = podDiag(f.notReadyPod, { events: f.notReadyEvents });
  assert.equal(d.issue, "Running but not ready");
  assert.equal(d.severity, "Warning");
  assert.match(d.evidence.join("\n"), /HTTP GET \/healthz on port 8080/);
  assert.match(d.evidence.join("\n"), /statuscode: 503/);
});

test("a young not-ready pod is left alone", () => {
  const young = { ...f.notReadyPod, metadata: { ...f.notReadyPod.metadata, creationTimestamp: new Date().toISOString() } };
  assert.deepEqual(podDiag(young), []);
});

test("unsupported resource types return an empty array", () => {
  assert.deepEqual(diagnoseResource("service", {}), []);
});

test("shared helpers", () => {
  assert.equal(isOomKilled(f.oomPod.status.containerStatuses, []), true);
  assert.equal(isOomKilled(f.oomEventOnlyPod.status.containerStatuses, f.oomEvents), true);
  assert.equal(isOomKilled(f.healthyPod.status.containerStatuses, []), false);
  assert.equal(classifyCrashLoop(f.healthyPod).length, 0);
  assert.equal(classifyCrashLoop(f.configMissingPod, f.configMissingEvents)[0].kind, "config");
});

test("AC7: diagnostics modules make no network calls and import only sibling modules", () => {
  const dir = new URL("./", import.meta.url);
  const files = readdirSync(dir).filter((f) => /^diagnostics(-[a-z]+)?\.js$/.test(f));
  assert.ok(files.length >= 2, "expected diagnostics.js and diagnostics-common.js");
  for (const file of files) {
    const src = readFileSync(new URL(file, dir), "utf8");
    assert.doesNotMatch(src, /\bfetch\s*\(|XMLHttpRequest|WebSocket|https?:\/\//, file);
    for (const [, from] of src.matchAll(/^\s*(?:import|export)[^;]*?from\s+"([^"]+)"/gms)) {
      assert.match(from, /^\.\/diagnostics(-[a-z]+)?\.js$/, `${file} imports ${from}`);
    }
  }
});
