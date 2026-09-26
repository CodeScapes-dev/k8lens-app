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

const meta = (name, extra = {}) => ({ name, namespace: "demo", creationTimestamp: "2020-01-01T00:00:00Z", ...extra });
const cond = (type, status, reason, message) => ({ type, status, reason, message });

test("Deployment blocked by a full quota names the quota", () => {
  const deployment = {
    metadata: meta("web"),
    spec: { replicas: 3 },
    status: { conditions: [cond("ReplicaFailure", "True", "FailedCreate", 'pods "web-1" is forbidden: exceeded quota: demo-quota, requested: pods=1, used: pods=20, limited: pods=20')] },
  };
  const [d] = diagnoseResource("deployment", { deployment, pods: [], events: [] });
  assert.equal(d.issue, "Can't create pods: quota is full");
  assert.match(d.rootCause, /quota "demo-quota"/);
  assert.match(d.remediation.join("\n"), /Resource Quotas/);
  assert.match(d.evidence.join("\n"), /used: pods=20/);
});

test("pod security and LimitRange rejections are recognised", () => {
  const mk = (message) => ({ metadata: meta("a"), spec: {}, status: { conditions: [cond("ReplicaFailure", "True", "FailedCreate", message)] } });
  const psa = diagnoseResource("replicaset", { replicaSet: mk('pods "a" is forbidden: violates PodSecurity "restricted:latest": allowPrivilegeEscalation != false'), pods: [], events: [] })[0];
  assert.equal(psa.issue, "Blocked by the namespace's pod security rules");
  assert.match(psa.rootCause, /restricted:latest/);
  const lr = diagnoseResource("replicaset", { replicaSet: mk("maximum memory usage per Container is 512Mi, but limit is 1Gi"), pods: [], events: [] })[0];
  assert.equal(lr.issue, "Pods don't fit the namespace's size limits");
});

test("StatefulSet create failures are read from FailedCreate events", () => {
  const events = [{ type: "Warning", reason: "FailedCreate", message: 'create Pod db-0 in StatefulSet db failed error: pods "db-0" is forbidden: exceeded quota: q' }];
  const [d] = diagnoseResource("statefulset", { statefulSet: { metadata: meta("db"), spec: {}, status: {} }, pods: [], events });
  assert.equal(d.issue, "Can't create pods: quota is full");
});

test("Deployment with ProgressDeadlineExceeded reports a stuck update", () => {
  const deployment = {
    metadata: meta("web"),
    spec: { replicas: 3, progressDeadlineSeconds: 120 },
    status: { readyReplicas: 1, updatedReplicas: 2, conditions: [cond("Progressing", "False", "ProgressDeadlineExceeded", 'ReplicaSet "web-2" has timed out progressing.')] },
  };
  const [d] = diagnoseResource("deployment", { deployment, pods: [], events: [] });
  assert.equal(d.issue, "Update is stuck");
  assert.match(d.rootCause, /120-second deadline/);
  assert.match(d.evidence.join("\n"), /1 ready, 2 updated, 3 wanted/);
  assert.match(d.remediation.join("\n"), /kubectl rollout undo deployment\/web -n demo/);
});

test("owner-level and pod-level findings appear together, most severe first", () => {
  const deployment = { metadata: meta("web"), spec: { replicas: 1 }, status: { conditions: [cond("ReplicaFailure", "True", "FailedCreate", "boom")] } };
  const ds = diagnoseResource("deployment", { deployment, pods: [f.notReadyPod, f.crashLoopAppPod], events: [] });
  assert.deepEqual(ds.map((d) => d.severity), ["Critical", "Critical", "Warning"]);
  assert.equal(ds[0].id, "create:failed");
});

test("ReplicaSets, ReplicationControllers and Jobs run the pod checks too", () => {
  for (const [type, key] of [["replicaset", "replicaSet"], ["replicationcontroller", "replicationController"], ["job", "job"]]) {
    const ds = diagnoseResource(type, { [key]: { metadata: meta("x"), spec: {}, status: {} }, pods: [f.crashLoopAppPod], events: [] });
    assert.equal(ds.length, 1, type);
    assert.equal(ds[0].issue, "App keeps crashing", type);
  }
});

test("a Job that used up its retries says so and how to recover", () => {
  const job = { metadata: meta("etl"), spec: { backoffLimit: 4 }, status: { failed: 5, conditions: [cond("Failed", "True", "BackoffLimitExceeded", "Job has reached the specified backoff limit")] } };
  const [d] = diagnoseResource("job", { job, pods: [], events: [] });
  assert.equal(d.issue, "Job gave up after repeated failures");
  assert.equal(d.technicalName, "BackoffLimitExceeded");
  assert.match(d.rootCause, /failed 5 times.*\(4\)/);
  assert.match(d.remediation.join("\n"), /delete this Job and create it again/);
});

test("a Job that hit its deadline mentions activeDeadlineSeconds", () => {
  const job = { metadata: meta("etl"), spec: { activeDeadlineSeconds: 60 }, status: { conditions: [cond("Failed", "True", "DeadlineExceeded", "Job was active longer than specified deadline")] } };
  const [d] = diagnoseResource("job", { job, pods: [], events: [] });
  assert.equal(d.issue, "Job ran too long");
  assert.match(d.remediation.join("\n"), /activeDeadlineSeconds/);
});

test("a completed Job has no findings", () => {
  const job = { metadata: meta("etl"), spec: {}, status: { succeeded: 1, conditions: [cond("Complete", "True")] } };
  assert.deepEqual(diagnoseResource("job", { job, pods: [], events: [] }), []);
});

test("suspended CronJob is flagged with the command to resume it", () => {
  const [d] = diagnoseResource("cronjob", { cronJob: { metadata: meta("nightly"), spec: { suspend: true }, status: {} }, jobs: [] });
  assert.equal(d.issue, "Paused, so it won't run");
  assert.match(d.remediation.join("\n"), /suspend":false/);
});

test("CronJob distinguishes a failing latest run from earlier failures", () => {
  const job = (name, ts, failed) => ({ metadata: meta(name, { creationTimestamp: ts }), status: { conditions: failed ? [cond("Failed", "True", "BackoffLimitExceeded", "gave up")] : [cond("Complete", "True")] } });
  const cronJob = { metadata: meta("nightly"), spec: {}, status: {} };
  const latestFailed = diagnoseResource("cronjob", { cronJob, jobs: [job("a", "2026-01-01T00:00:00Z", false), job("b", "2026-01-02T00:00:00Z", true)] })[0];
  assert.equal(latestFailed.issue, "The latest run failed");
  assert.equal(latestFailed.severity, "Critical");
  const earlier = diagnoseResource("cronjob", { cronJob, jobs: [job("a", "2026-01-01T00:00:00Z", true), job("b", "2026-01-02T00:00:00Z", false)] })[0];
  assert.equal(earlier.issue, "Some recent runs failed");
  assert.equal(earlier.severity, "Warning");
  assert.deepEqual(diagnoseResource("cronjob", { cronJob, jobs: [job("a", "2026-01-01T00:00:00Z", false)] }), []);
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
