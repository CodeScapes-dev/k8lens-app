import { test } from "node:test";
import assert from "node:assert/strict";
import { diagnoseResource } from "./diagnostics.js";

const meta = (name, extra = {}) => ({ name, namespace: "demo", creationTimestamp: "2020-01-01T00:00:00Z", ...extra });
const rule = (verbs, resources, apiGroups = [""]) => ({ verbs, resources, apiGroups });
const role = (rules) => ({ metadata: meta("r"), rules });
const ids = (ds) => ds.map((d) => d.id);

// ---------- Role ----------

test("a role with wildcard verbs and resources is full admin and nothing else is reported for it", () => {
  const ds = diagnoseResource("role", { role: role([rule(["*"], ["*"]), rule(["get"], ["secrets"])]), bindings: [{}] });
  assert.deepEqual(ids(ds), ["rbac:everything"]);
  assert.equal(ds[0].severity, "Critical");
  assert.match(ds[0].rootCause, /cluster administrator access/);
  assert.match(ds[0].evidence.join("\n"), /\*\/? ?on \*|\* on \*/);
});

test("wildcard verbs on some resources names the resources", () => {
  const [d] = diagnoseResource("role", { role: role([rule(["*"], ["pods", "deployments"])]), bindings: [{}] });
  assert.equal(d.id, "rbac:wildcard-verbs");
  assert.match(d.rootCause, /pods and deployments/);
});

test("wildcard resources is critical with write verbs and a warning when read-only", () => {
  assert.equal(diagnoseResource("role", { role: role([rule(["get", "list"], ["*"])]), bindings: [{}] })[0].severity, "Warning");
  const writes = diagnoseResource("role", { role: role([rule(["get", "delete"], ["*"])]), bindings: [{}] })[0];
  assert.equal(writes.severity, "Critical");
  assert.equal(writes.issue, "Can change every kind of resource");
});

test("escalate, bind and impersonate are critical", () => {
  const [d] = diagnoseResource("role", { role: role([rule(["escalate", "bind"], ["clusterroles"], ["rbac.authorization.k8s.io"])]), bindings: [{}] });
  assert.equal(d.id, "rbac:escalate");
  assert.equal(d.severity, "Critical");
});

test("reading secrets, exec into pods and editing roles are warnings", () => {
  const ds = diagnoseResource("role", { role: role([rule(["get", "list"], ["secrets"]), rule(["create"], ["pods/exec"]), rule(["update"], ["rolebindings"], ["rbac.authorization.k8s.io"])]), bindings: [{}] });
  assert.deepEqual(new Set(ids(ds)), new Set(["rbac:secrets", "rbac:exec", "rbac:edit-permissions"]));
  assert.ok(ds.every((d) => d.severity === "Warning"));
});

test("a read-only role on ordinary resources is healthy; an unbound role is flagged", () => {
  assert.deepEqual(diagnoseResource("role", { role: role([rule(["get", "list", "watch"], ["pods", "configmaps"])]), bindings: [{}] }), []);
  const [d] = diagnoseResource("role", { role: role([rule(["get"], ["pods"])]), bindings: [] });
  assert.equal(d.issue, "Not given to anyone");
});

test("ClusterRole uses the same permission checks", () => {
  const [d] = diagnoseResource("clusterrole", { clusterRole: role([rule(["*"], ["*"])]) });
  assert.equal(d.id, "rbac:everything");
  assert.match(d.rootCause, /^This cluster role/);
  assert.deepEqual(diagnoseResource("clusterrole", { clusterRole: role([rule(["get"], ["pods"])]) }), []);
});

// ---------- RoleBinding / ClusterRoleBinding ----------

const binding = (roleRef, subjects) => ({ metadata: meta("b"), roleRef, subjects });
const ref = (name, kind = "Role") => ({ kind, name, apiGroup: "rbac.authorization.k8s.io" });
const sa = (name) => ({ kind: "ServiceAccount", name, namespace: "demo" });

test("a binding to a role that doesn't exist is critical, but not when the lookup was just denied", () => {
  const [d] = diagnoseResource("rolebinding", { roleBinding: binding(ref("gone"), [sa("app")]), role: null, roleMissing: true });
  assert.equal(d.issue, "Points to a role that doesn't exist");
  assert.match(d.rootCause, /Role "gone"/);
  assert.match(d.remediation.join("\n"), /can't be edited/);
  assert.deepEqual(diagnoseResource("rolebinding", { roleBinding: binding(ref("x"), [sa("app")]), role: null, roleMissing: false }), []);
});

test("a binding with no subjects does nothing", () => {
  assert.equal(diagnoseResource("rolebinding", { roleBinding: binding(ref("r"), []), role: role([]) })[0].issue, "Gives the role to nobody");
});

test("anonymous and unauthenticated subjects are critical, authenticated is a warning", () => {
  const anon = diagnoseResource("clusterrolebinding", { clusterRoleBinding: binding(ref("view", "ClusterRole"), [{ kind: "Group", name: "system:unauthenticated" }]), role: role([]) });
  assert.equal(anon[0].id, "binding:anonymous");
  assert.equal(anon[0].severity, "Critical");
  const all = diagnoseResource("clusterrolebinding", { clusterRoleBinding: binding(ref("view", "ClusterRole"), [{ kind: "Group", name: "system:authenticated" }]), role: role([]) });
  assert.equal(all[0].id, "binding:authenticated");
  assert.equal(all[0].severity, "Warning");
});

test("cluster-admin bindings are flagged, except the built-in system:masters one", () => {
  const [d] = diagnoseResource("clusterrolebinding", { clusterRoleBinding: binding(ref("cluster-admin", "ClusterRole"), [sa("ci")]), role: role([rule(["*"], ["*"])]) });
  assert.equal(d.issue, "Gives full control of the whole cluster");
  assert.match(d.rootCause, /ServiceAccount ci/);
  assert.deepEqual(diagnoseResource("clusterrolebinding", { clusterRoleBinding: binding(ref("cluster-admin", "ClusterRole"), [{ kind: "Group", name: "system:masters" }]), role: role([rule(["*"], ["*"])]) }), []);
  const ns = diagnoseResource("rolebinding", { roleBinding: binding(ref("cluster-admin", "ClusterRole"), [sa("ci")]), role: role([]) })[0];
  assert.equal(ns.issue, "Gives full control of this namespace");
});

test("binding a role with full access is flagged even when it isn't cluster-admin", () => {
  const [d] = diagnoseResource("rolebinding", { roleBinding: binding(ref("god"), [sa("app")]), role: role([rule(["*"], ["*"])]) });
  assert.equal(d.id, "binding:powerful-role");
});

test("an ordinary binding is healthy", () => {
  assert.deepEqual(diagnoseResource("rolebinding", { roleBinding: binding(ref("reader"), [sa("app")]), role: role([rule(["get"], ["pods"])]) }), []);
});

// ---------- ServiceAccount ----------

test("a service account bound to cluster-admin is critical", () => {
  const [d] = diagnoseResource("serviceaccount", {
    serviceAccount: { metadata: meta("ci") },
    clusterRoleBindings: [{ metadata: meta("ci-admin"), roleRef: ref("cluster-admin", "ClusterRole") }],
    effectivePermissions: { rules: [rule(["*"], ["*"])] },
  });
  assert.equal(d.id, "sa:cluster-admin");
  assert.equal(d.severity, "Critical");
  assert.match(d.evidence.join("\n"), /ci-admin/);
});

test("a service account's combined permissions are checked with account wording", () => {
  const [d] = diagnoseResource("serviceaccount", { serviceAccount: { metadata: meta("app") }, clusterRoleBindings: [], effectivePermissions: { rules: [rule(["get", "list"], ["secrets"])] } });
  assert.equal(d.id, "rbac:secrets");
  assert.match(d.rootCause, /^This service account/);
});

test("a harmless service account has no findings", () => {
  assert.deepEqual(diagnoseResource("serviceaccount", { serviceAccount: { metadata: meta("app") }, clusterRoleBindings: [], effectivePermissions: { rules: [] } }), []);
});
