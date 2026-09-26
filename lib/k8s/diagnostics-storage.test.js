import { test } from "node:test";
import assert from "node:assert/strict";
import { diagnoseResource } from "./diagnostics.js";

const OLD = "2020-01-01T00:00:00Z";
const meta = (name, extra = {}) => ({ name, namespace: "demo", creationTimestamp: OLD, ...extra });
const pvc = (phase, spec = {}, extra = {}) => ({ metadata: meta("data"), spec, status: { phase }, ...extra });
const classes = [
  { name: "hostpath", provisioner: "docker.io/hostpath", isDefault: true },
  { name: "manual", provisioner: "kubernetes.io/no-provisioner", isDefault: false },
  { name: "later", provisioner: "csi.example", volumeBindingMode: "WaitForFirstConsumer", isDefault: false },
];
const check = (claim, extra = {}) => diagnoseResource("pvc", { pvc: claim, pods: [], events: [], storageClasses: classes, ...extra });

// ---------- PVC ----------

test("a bound claim is healthy", () => {
  assert.deepEqual(check(pvc("Bound", { storageClassName: "hostpath" })), []);
});

test("a claim asking for a storage class that doesn't exist is critical", () => {
  const [d] = check(pvc("Pending", { storageClassName: "fast-ssd" }));
  assert.equal(d.issue, "Storage class doesn't exist");
  assert.match(d.rootCause, /"fast-ssd"/);
  assert.match(d.evidence.join("\n"), /hostpath, manual, later/);
});

test("a claim with no class and no cluster default is critical, but with a default it is not", () => {
  const noDefault = check(pvc("Pending", {}), { storageClasses: classes.map((c) => ({ ...c, isDefault: false })) })[0];
  assert.equal(noDefault.issue, "No storage class, and the cluster has no default");
  assert.deepEqual(check(pvc("Pending", {}, { metadata: meta("data", { creationTimestamp: new Date().toISOString() }) })), []);
});

test("a provisioning failure shows the storage system's message", () => {
  const events = [{ type: "Warning", reason: "ProvisioningFailed", message: 'failed to provision volume: quota exceeded for "fast"' }];
  const [d] = check(pvc("Pending", { storageClassName: "hostpath" }), { events });
  assert.equal(d.issue, "Couldn't create the volume");
  assert.match(d.evidence.join("\n"), /quota exceeded/);
});

test("a class without a provisioner explains the manual step", () => {
  const [d] = check(pvc("Pending", { storageClassName: "manual" }));
  assert.equal(d.issue, "Waiting for a volume to be created by hand");
  assert.match(d.remediation.join("\n"), /PersistentVolume/);
});

test("WaitForFirstConsumer is normal until a pod is waiting on it", () => {
  assert.deepEqual(check(pvc("Pending", { storageClassName: "later" })), []);
  const [d] = check(pvc("Pending", { storageClassName: "later" }), { pods: [{ metadata: meta("app-0") }] });
  assert.equal(d.issue, "Waiting for its pod to be placed");
  assert.match(d.evidence.join("\n"), /app-0/);
});

test("a young pending claim is left alone and an old generic one is a warning", () => {
  const young = pvc("Pending", { storageClassName: "hostpath" }, { metadata: meta("data", { creationTimestamp: new Date().toISOString() }) });
  assert.deepEqual(check(young), []);
  const [d] = check(pvc("Pending", { storageClassName: "hostpath" }));
  assert.equal(d.issue, "Still waiting for a volume");
  assert.equal(d.severity, "Warning");
});

test("a lost claim is critical", () => {
  const [d] = check(pvc("Lost", { volumeName: "pv-1" }));
  assert.equal(d.issue, "The volume behind this claim is gone");
  assert.match(d.rootCause, /"pv-1"/);
});

test("class checks are skipped when the class list is unavailable", () => {
  const ds = diagnoseResource("pvc", { pvc: pvc("Pending", { storageClassName: "fast-ssd" }), pods: [], events: [] });
  assert.equal(ds[0].issue, "Still waiting for a volume");
});

test("a failed volume resize is reported", () => {
  const events = [{ type: "Warning", reason: "VolumeResizeFailed", message: "expansion is not supported" }];
  const [d] = check(pvc("Bound", { storageClassName: "hostpath" }), { events });
  assert.equal(d.issue, "Growing the volume failed");
  assert.match(d.remediation.join("\n"), /allowVolumeExpansion/);
});

// ---------- PV ----------

const pv = (phase, extra = {}) => ({ metadata: meta("pv-1"), spec: { persistentVolumeReclaimPolicy: "Retain", claimRef: { namespace: "demo", name: "old-claim" } }, status: { phase, ...extra } });

test("a released volume explains why it can't be reused and how to free it", () => {
  const [d] = diagnoseResource("pv", { pv: pv("Released"), events: [], pods: [] });
  assert.equal(d.issue, "Released, but not available for reuse");
  assert.match(d.evidence.join("\n"), /demo\/old-claim/);
  assert.match(d.remediation.join("\n"), /claimRef":null/);
});

test("a failed volume shows the reason and the cleanup steps", () => {
  const [d] = diagnoseResource("pv", { pv: pv("Failed", { message: "error getting deleter volume plugin" }), events: [], pods: [] });
  assert.equal(d.severity, "Critical");
  assert.match(d.evidence.join("\n"), /deleter volume plugin/);
  assert.match(d.remediation.join("\n"), /kubectl delete pv pv-1/);
});

test("bound and available volumes are healthy", () => {
  assert.deepEqual(diagnoseResource("pv", { pv: pv("Bound"), events: [], pods: [] }), []);
  assert.deepEqual(diagnoseResource("pv", { pv: pv("Available"), events: [], pods: [] }), []);
});

// ---------- StorageClass ----------

const claim = (name, phase, created = OLD) => ({ metadata: meta(name, { creationTimestamp: created }), spec: { volumeName: "v" }, status: { phase } });

test("a storage class lists the claims stuck on it", () => {
  const [d] = diagnoseResource("storageclass", {
    storageClass: { metadata: meta("hostpath"), provisioner: "docker.io/hostpath" },
    pvcs: [claim("a", "Pending"), claim("b", "Bound"), claim("c", "Pending", new Date().toISOString())],
    pvs: [],
  });
  assert.equal(d.issue, "Claims are stuck waiting for storage");
  assert.match(d.rootCause, /1 claim using this class has waited/);
  assert.match(d.evidence.join("\n"), /demo\/a/);
  assert.doesNotMatch(d.evidence.join("\n"), /demo\/c/);
  assert.match(d.remediation.join("\n"), /docker\.io\/hostpath/);
});

test("a no-provisioner class points at creating volumes by hand, lost claims are critical", () => {
  const ds = diagnoseResource("storageclass", {
    storageClass: { metadata: meta("manual"), provisioner: "kubernetes.io/no-provisioner" },
    pvcs: [claim("a", "Pending"), claim("gone", "Lost")],
  });
  assert.equal(ds[0].issue, "Claims lost their volumes");
  assert.equal(ds[0].severity, "Critical");
  assert.match(ds[1].remediation.join("\n"), /Create PersistentVolumes/);
});

test("a storage class with healthy claims has no findings", () => {
  assert.deepEqual(diagnoseResource("storageclass", { storageClass: { metadata: meta("x"), provisioner: "p" }, pvcs: [claim("a", "Bound")] }), []);
});

test("a WaitForFirstConsumer class ignores claims that no pod is waiting on", () => {
  const sc = { metadata: meta("standard"), provisioner: "rancher.io/local-path", volumeBindingMode: "WaitForFirstConsumer" };
  assert.deepEqual(diagnoseResource("storageclass", { storageClass: sc, pvcs: [claim("unused", "Pending")], claimsInUse: [] }), []);
  const [d] = diagnoseResource("storageclass", { storageClass: sc, pvcs: [claim("unused", "Pending"), claim("waiting", "Pending")], claimsInUse: ["demo/waiting"] });
  assert.match(d.evidence.join("\n"), /demo\/waiting/);
  assert.doesNotMatch(d.evidence.join("\n"), /demo\/unused/);
});

test("an Immediate class still reports every stuck claim", () => {
  const sc = { metadata: meta("fast"), provisioner: "csi.example", volumeBindingMode: "Immediate" };
  assert.equal(diagnoseResource("storageclass", { storageClass: sc, pvcs: [claim("a", "Pending")], claimsInUse: [] })[0].issue, "Claims are stuck waiting for storage");
});
