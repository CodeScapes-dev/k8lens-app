// Diagnostics for Access Control resources: ServiceAccount, Role, ClusterRole, RoleBinding, ClusterRoleBinding.
import { plural } from "./diagnostics-common.js";

const WRITE_VERBS = new Set(["create", "update", "patch", "delete", "deletecollection", "*"]);
const READ_VERBS = new Set(["get", "list", "watch", "*"]);
const RBAC_KINDS = new Set(["roles", "rolebindings", "clusterroles", "clusterrolebindings"]);
const ESCALATION_VERBS = ["escalate", "bind", "impersonate"];

const has = (list, value) => (list ?? []).includes(value);
const rulesWith = (rules, predicate) => rules.filter(predicate);
const some = (list, set) => (list ?? []).some((v) => set.has(v));
const joinList = (items) => (items.length <= 2 ? items.join(" and ") : `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`);
const ruleText = (r) => `${(r.verbs ?? []).join("/")} on ${(r.resources ?? []).join(", ") || "(no resources)"}${r.apiGroups?.length ? ` in ${r.apiGroups.map((g) => g || "core").join(", ")}` : ""}`;

/**
 * Looks for permissions that are risky or surprising. `who` is "This role" / "This account".
 * Each finding names the exact rules it found, so the reader can go straight to them.
 */
export function analyzePermissions(rules, who) {
  const out = [];
  const list = (rules ?? []).filter(Boolean);

  const everything = rulesWith(list, (r) => has(r.verbs, "*") && has(r.resources, "*"));
  if (everything.length > 0) {
    return [
      {
        id: "rbac:everything",
        issue: "Full access to everything",
        technicalName: "Wildcard verbs and resources",
        severity: "Critical",
        rootCause: `${who} can do anything to every kind of resource. That is the same as cluster administrator access.`,
        evidence: everything.map(ruleText),
        remediation: ["List only the actions and resources that are really needed, instead of \"*\".", "Anyone or anything using this can read every Secret and change or delete any workload."],
      },
    ];
  }

  const escalation = rulesWith(list, (r) => (r.verbs ?? []).some((v) => ESCALATION_VERBS.includes(v)));
  if (escalation.length > 0) {
    out.push({
      id: "rbac:escalate",
      issue: "Can give itself more permissions",
      technicalName: "escalate, bind or impersonate",
      severity: "Critical",
      rootCause: `${who} can grant permissions it doesn't have, or act as other users, which is a way to reach full cluster access.`,
      evidence: escalation.map(ruleText),
      remediation: ["Remove the escalate, bind and impersonate verbs unless this really is an administrator role."],
    });
  }

  const wildVerbs = rulesWith(list, (r) => has(r.verbs, "*") && !has(r.resources, "*"));
  if (wildVerbs.length > 0) {
    out.push({
      id: "rbac:wildcard-verbs",
      issue: "Allows every action on some resources",
      technicalName: "Wildcard verbs",
      severity: "Critical",
      rootCause: `${who} can do any action (read, change, delete) on ${joinList([...new Set(wildVerbs.flatMap((r) => r.resources ?? []))])}.`,
      evidence: wildVerbs.map(ruleText),
      remediation: ["Replace \"*\" with just the actions that are needed, such as get and list."],
    });
  }

  const wildResources = rulesWith(list, (r) => has(r.resources, "*") && !has(r.verbs, "*"));
  if (wildResources.length > 0) {
    const writes = wildResources.some((r) => some(r.verbs, WRITE_VERBS));
    out.push({
      id: "rbac:wildcard-resources",
      issue: writes ? "Can change every kind of resource" : "Can read every kind of resource",
      technicalName: "Wildcard resources",
      severity: writes ? "Critical" : "Warning",
      rootCause: `${who} isn't limited to particular kinds of resource${writes ? ", and it can change them" : ", so it can read all of them, including Secrets"}.`,
      evidence: wildResources.map(ruleText),
      remediation: ["List only the resource kinds that are really needed instead of \"*\"."],
    });
  }

  if (everything.length === 0 && wildVerbs.length === 0 && wildResources.length === 0) {
    const rbacWrites = rulesWith(list, (r) => (r.resources ?? []).some((x) => RBAC_KINDS.has(x)) && some(r.verbs, WRITE_VERBS));
    if (rbacWrites.length > 0 && escalation.length === 0) {
      out.push({
        id: "rbac:edit-permissions",
        issue: "Can change who has access",
        severity: "Warning",
        rootCause: `${who} can create or change roles and bindings, which lets it change who is allowed to do what.`,
        evidence: rbacWrites.map(ruleText),
        remediation: ["Limit this to administrators, or remove the role and binding resources from the rule."],
      });
    }
    const secrets = rulesWith(list, (r) => has(r.resources, "secrets") && some(r.verbs, READ_VERBS));
    if (secrets.length > 0) {
      out.push({
        id: "rbac:secrets",
        issue: "Can read Secrets",
        severity: "Warning",
        rootCause: `${who} can read Secrets, which hold passwords, tokens and keys.`,
        evidence: secrets.map(ruleText),
        remediation: ["Remove secrets from the rule unless it is really needed, or restrict it with resourceNames to the specific Secrets required."],
      });
    }
    const exec = rulesWith(list, (r) => (r.resources ?? []).some((x) => x === "pods/exec" || x === "pods/attach") && some(r.verbs, new Set(["create", "get", "*"])));
    if (exec.length > 0) {
      out.push({
        id: "rbac:exec",
        issue: "Can run commands inside pods",
        severity: "Warning",
        rootCause: `${who} can open a shell in running pods, giving access to everything those pods can reach, including their credentials.`,
        evidence: exec.map(ruleText),
        remediation: ["Remove pods/exec and pods/attach unless people really need to debug in place."],
      });
    }
  }
  return out;
}

// ---------- Role / ClusterRole ----------

export function diagnoseRole(data) {
  const role = data?.role;
  if (!role) return [];
  const out = analyzePermissions(role.rules, "This role");
  if (Array.isArray(data?.bindings) && data.bindings.length === 0) {
    out.push({
      id: "role:unused",
      issue: "Not given to anyone",
      technicalName: "No bindings",
      severity: "Warning",
      rootCause: "No RoleBinding points at this role, so it currently grants nothing to anyone.",
      evidence: ["Bindings that use this role: 0"],
      remediation: ["Delete the role if it is left over, or create a RoleBinding to give it to the users or service accounts that need it."],
    });
  }
  return out;
}

export function diagnoseClusterRole(data) {
  const role = data?.clusterRole;
  return role ? analyzePermissions(role.rules, "This cluster role") : [];
}

// ---------- bindings ----------

const ANONYMOUS = new Set(["system:anonymous", "system:unauthenticated"]);

function bindingDiagnoses(binding, role, roleMissing, scope) {
  if (!binding) return [];
  const out = [];
  const ref = binding.roleRef ?? {};
  const subjects = binding.subjects ?? [];

  if (roleMissing === true) {
    out.push({
      id: "binding:missing-role",
      issue: "Points to a role that doesn't exist",
      severity: "Critical",
      rootCause: `This binding is meant to give the permissions of ${ref.kind} "${ref.name}", but that ${ref.kind} doesn't exist, so it currently grants nothing.`,
      evidence: [`roleRef: ${ref.kind} ${ref.name}`],
      remediation: [`Create the ${ref.kind}, or delete this binding and recreate it pointing at one that exists. (A binding's roleRef can't be edited.)`],
    });
  }

  if (subjects.length === 0) {
    out.push({
      id: "binding:no-subjects",
      issue: "Gives the role to nobody",
      severity: "Warning",
      rootCause: "This binding doesn't list any users, groups or service accounts, so it has no effect.",
      evidence: ["subjects is empty"],
      remediation: ["Add the users, groups or service accounts that should get the role, or delete the binding."],
    });
  }

  const anonymous = subjects.filter((s) => s.kind === "Group" && ANONYMOUS.has(s.name));
  if (anonymous.length > 0) {
    out.push({
      id: "binding:anonymous",
      issue: "Gives access to people who haven't logged in",
      severity: "Critical",
      rootCause: `This binding grants ${ref.kind} "${ref.name}" to ${joinList(anonymous.map((s) => s.name))}, which means anyone who can reach the cluster's API can use these permissions without credentials.`,
      evidence: anonymous.map((s) => `Subject: Group ${s.name}`),
      remediation: ["Remove these subjects unless this is deliberate, and bind only named users, groups or service accounts."],
    });
  }

  const everyone = subjects.filter((s) => s.kind === "Group" && s.name === "system:authenticated");
  if (everyone.length > 0) {
    out.push({
      id: "binding:authenticated",
      issue: "Gives access to every logged-in user",
      severity: "Warning",
      rootCause: `This binding grants ${ref.kind} "${ref.name}" to every authenticated user or service account in the cluster.`,
      evidence: ["Subject: Group system:authenticated"],
      remediation: ["Bind specific groups or service accounts instead, unless everyone really should have this."],
    });
  }

  const onlyMasters = subjects.length > 0 && subjects.every((s) => s.kind === "Group" && s.name === "system:masters");
  if (ref.name === "cluster-admin" && !onlyMasters) {
    out.push({
      id: "binding:cluster-admin",
      issue: scope === "cluster" ? "Gives full control of the whole cluster" : "Gives full control of this namespace",
      technicalName: "cluster-admin",
      severity: "Warning",
      rootCause: `This binding gives the built-in cluster-admin role to ${subjects.length ? joinList(subjects.map((s) => `${s.kind} ${s.name}`)) : "its subjects"}, which allows anything ${scope === "cluster" ? "anywhere in the cluster" : "within this namespace"}.`,
      evidence: [`roleRef: ${ref.kind} ${ref.name}`, ...subjects.slice(0, 5).map((s) => `Subject: ${s.kind} ${s.name}`)],
      remediation: ["Use a narrower role (for example edit or view) unless these subjects really are administrators."],
    });
  }

  if (role && Array.isArray(role.rules)) {
    const everything = role.rules.filter((r) => has(r.verbs, "*") && has(r.resources, "*"));
    if (everything.length > 0 && ref.name !== "cluster-admin") {
      out.push({
        id: "binding:powerful-role",
        issue: "Gives a role with full access",
        severity: "Warning",
        rootCause: `The ${ref.kind} "${ref.name}" allows every action on every resource, and this binding hands it to ${plural(subjects.length, "subject")}.`,
        evidence: [`roleRef: ${ref.kind} ${ref.name}`],
        remediation: ["Open the role to narrow its rules, or bind a smaller role."],
      });
    }
  }
  return out;
}

export const diagnoseRoleBinding = (data) => bindingDiagnoses(data?.roleBinding, data?.role, data?.roleMissing, "namespace");
export const diagnoseClusterRoleBinding = (data) => bindingDiagnoses(data?.clusterRoleBinding, data?.role, data?.roleMissing, "cluster");

// ---------- ServiceAccount ----------

export function diagnoseServiceAccount(data) {
  const sa = data?.serviceAccount;
  if (!sa) return [];
  const out = [];
  const admin = (data?.clusterRoleBindings ?? []).filter((b) => b?.roleRef?.name === "cluster-admin");
  if (admin.length > 0) {
    out.push({
      id: "sa:cluster-admin",
      issue: "Has full control of the whole cluster",
      technicalName: "cluster-admin",
      severity: "Critical",
      rootCause: "This service account is bound to the cluster-admin role, so any pod that uses it can do anything anywhere in the cluster.",
      evidence: admin.map((b) => `ClusterRoleBinding: ${b.metadata?.name}`),
      remediation: ["Bind a narrower role that covers only what its pods need.", "If it isn't needed, delete the binding."],
    });
  }
  const perms = analyzePermissions(data?.effectivePermissions?.rules, "This service account").filter((d) => !(admin.length > 0 && d.id === "rbac:everything"));
  out.push(...perms);
  return out;
}
