// Diagnostics for Cluster resources: Node and Namespace.
import { PENDING_THRESHOLD_MS, condition, parseQuantity, plural, podFailureReason } from "./diagnostics-common.js";
import { diagnoseResourceQuota } from "./diagnostics-config.js";

const ACTIVE_PHASES = new Set(["Running", "Pending", "Unknown", undefined]);
const joinList = (items) => (items.length <= 2 ? items.join(" and ") : `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`);

const failingPods = (pods, now) =>
  (pods ?? []).map((pod) => ({ pod, reason: podFailureReason(pod, now) })).filter((x) => x.reason);

function groupByReason(failing) {
  const groups = new Map();
  for (const { pod, reason } of failing) {
    if (!groups.has(reason)) groups.set(reason, []);
    groups.get(reason).push(pod.metadata?.name);
  }
  return [...groups].map(([reason, names]) => `${reason}: ${names.slice(0, 5).join(", ")}${names.length > 5 ? ` +${names.length - 5} more` : ""}`);
}

// ---------- Node ----------

const PRESSURE = {
  MemoryPressure: {
    issue: "Running low on memory",
    cause: "The machine is almost out of memory, so Kubernetes will start evicting pods from it.",
    fix: ["Move or scale down memory-hungry workloads, or add machines to the cluster.", "Set memory requests and limits on containers so no pod can take more than its share."],
  },
  DiskPressure: {
    issue: "Running low on disk space",
    cause: "The machine is almost out of disk space, so Kubernetes will start evicting pods and deleting unused images.",
    fix: ["Free up space on the machine: remove unused container images and old logs.", "Give the machine a bigger disk, or spread pods across more machines."],
  },
  PIDPressure: {
    issue: "Running too many processes",
    cause: "The machine is close to its process limit, so new processes and containers may fail to start.",
    fix: ["Find pods that spawn many processes and limit them (a pod can set a PID limit).", "Spread pods across more machines."],
  },
};

const requestsOf = (pod, resource) => (pod?.spec?.containers ?? []).reduce((sum, c) => sum + (parseQuantity(c.resources?.requests?.[resource]) ?? 0), 0);

export function diagnoseNode(data, now = Date.now()) {
  const node = data?.node;
  if (!node) return [];
  const out = [];
  const name = node.metadata?.name;

  const ready = condition(node, "Ready");
  if (ready && ready.status !== "True") {
    const unknown = ready.status === "Unknown";
    out.push({
      id: "node:not-ready",
      issue: unknown ? "Machine stopped reporting" : "Machine isn't ready",
      technicalName: `Ready: ${ready.status}`,
      severity: "Critical",
      rootCause: unknown
        ? "The machine stopped reporting to the cluster. It may be switched off, crashed, or cut off from the network, so pods on it are not being managed."
        : "Kubernetes reports this machine as not ready, so it won't run new pods.",
      evidence: [...(ready.reason ? [`Reason: ${ready.reason}`] : []), ...(ready.message ? [`Kubernetes reported: ${ready.message}`] : []), ...(ready.lastHeartbeatTime ? [`Last heard from: ${ready.lastHeartbeatTime}`] : [])],
      remediation: [
        "Check that the machine (or virtual machine) is running and reachable on the network.",
        "Check the kubelet service on it, for example: systemctl status kubelet, and read its logs.",
        "If it can't be recovered, drain and remove it; its pods are rescheduled elsewhere.",
      ],
    });
  }

  for (const type of ["MemoryPressure", "DiskPressure", "PIDPressure"]) {
    const c = condition(node, type);
    if (c?.status === "True") {
      out.push({
        id: `node:${type}`,
        issue: PRESSURE[type].issue,
        technicalName: type,
        severity: "Critical",
        rootCause: PRESSURE[type].cause,
        evidence: [...(c.message ? [`Kubernetes reported: ${c.message}`] : []), `Condition ${type} is True`],
        remediation: PRESSURE[type].fix,
      });
    }
  }

  const net = condition(node, "NetworkUnavailable");
  if (net?.status === "True") {
    out.push({
      id: "node:network",
      issue: "Machine's network isn't set up",
      technicalName: "NetworkUnavailable",
      severity: "Critical",
      rootCause: "The cluster's network plugin hasn't set up networking on this machine, so pods can't talk to each other from here.",
      evidence: [...(net.message ? [`Kubernetes reported: ${net.message}`] : [])],
      remediation: ["Check that the network plugin (CNI) pods are running on this machine, usually in the kube-system namespace."],
    });
  }

  if (node.spec?.unschedulable) {
    out.push({
      id: "node:cordoned",
      issue: "Won't accept new pods",
      technicalName: "Cordoned",
      severity: "Warning",
      rootCause: "This machine is cordoned (marked unschedulable), so Kubernetes won't place new pods on it. Pods already on it keep running.",
      evidence: ["spec.unschedulable is true"],
      remediation: [`If the maintenance is finished, allow pods again: kubectl uncordon ${name}`],
    });
  }

  const active = (data?.pods ?? []).filter((p) => ACTIVE_PHASES.has(p?.status?.phase));
  const alloc = node.status?.allocatable ?? {};
  const full = [];
  const evidence = [];
  for (const [resource, label, format] of [
    ["cpu", "CPU", (n) => `${n.toFixed(2)} cores`],
    ["memory", "memory", (n) => `${(n / 1024 ** 3).toFixed(1)} GiB`],
  ]) {
    const total = parseQuantity(alloc[resource]);
    const requested = active.reduce((sum, p) => sum + requestsOf(p, resource), 0);
    if (total && total > 0 && requested / total >= 0.9) {
      full.push(label);
      evidence.push(`${label}: ${format(requested)} of ${format(total)} reserved by pods (${Math.round((requested / total) * 100)}%)`);
    }
  }
  const podLimit = parseQuantity(alloc.pods);
  if (podLimit && active.length / podLimit >= 0.9) {
    full.push("pod slots");
    evidence.push(`Pods: ${active.length} of ${podLimit}`);
  }
  if (full.length > 0) {
    out.push({
      id: "node:capacity",
      issue: "Almost fully booked",
      severity: "Warning",
      rootCause: `Pods on this machine have already reserved over 90% of its ${joinList(full)}, so new pods may not fit here.`,
      evidence,
      remediation: ["Add machines to the cluster, or lower CPU and memory requests that are larger than the workloads need."],
    });
  }

  const failing = failingPods(data?.pods, now);
  if (failing.length > 0) {
    out.push({
      id: "node:failing-pods",
      issue: `${plural(failing.length, "pod")} on this machine ${failing.length === 1 ? "is" : "are"} failing`,
      severity: "Warning",
      rootCause: "Some pods running on this machine are crash-looping, can't start or aren't ready. If they all fail at once, the machine itself may be the problem.",
      evidence: groupByReason(failing),
      remediation: ["Open a failing pod (Workloads → Pods) and read its Diagnostics tab.", "If unrelated pods fail the same way, check the machine's conditions and events."],
    });
  }
  return out;
}

// ---------- Namespace ----------

const TERMINATING_HINTS = {
  NamespaceContentRemaining: "Some objects inside are still being deleted. Wait for them to finish, or delete them yourself.",
  NamespaceFinalizersRemaining: "Some objects have finalizers that haven't run. Find them and fix or remove the finalizer.",
  NamespaceDeletionDiscoveryFailure: "An API service is unavailable, so Kubernetes can't list everything to delete. List failing ones with: kubectl get apiservice | grep False, then fix or remove them.",
  NamespaceDeletionContentFailure: "Kubernetes failed to delete some of the content. Read the message for which objects.",
  NamespaceDeletionGroupVersionParsingFailure: "Kubernetes can't parse an API group version, so it can't finish. Check custom resource definitions.",
};

export function diagnoseNamespace(data, now = Date.now()) {
  const ns = data?.ns;
  if (!ns) return [];
  const out = [];
  const name = ns.metadata?.name;

  if (ns.status?.phase === "Terminating") {
    const since = ns.metadata?.deletionTimestamp ? now - new Date(ns.metadata.deletionTimestamp).getTime() : null;
    if (since === null || since > PENDING_THRESHOLD_MS) {
      const blockers = (ns.status?.conditions ?? []).filter((c) => c.status === "True" && TERMINATING_HINTS[c.type]);
      out.push({
        id: "ns:stuck",
        issue: "Stuck deleting",
        technicalName: "Terminating",
        severity: "Critical",
        rootCause: "This namespace was asked to delete more than 5 minutes ago and is still there, because something inside it is blocking the deletion.",
        evidence: blockers.length > 0 ? blockers.map((c) => `${c.type}: ${c.message ?? "true"}`) : ["No blocking condition was reported"],
        remediation: blockers.length > 0 ? blockers.map((c) => TERMINATING_HINTS[c.type]) : [`Run kubectl get all -n ${name} and look for objects still being deleted, then check their finalizers.`],
      });
    }
  }

  for (const quota of data?.quotas ?? []) {
    for (const d of diagnoseResourceQuota({ resourceQuota: quota })) {
      out.push({ ...d, id: `${d.id}:${quota.metadata?.name}`, issue: d.issue.replace(/^Quota/, `Quota "${quota.metadata?.name}"`) });
    }
  }

  const pods = (data?.pods ?? []).filter((p) => ACTIVE_PHASES.has(p?.status?.phase) || p?.status?.phase === "Failed");
  const failing = failingPods(pods, now);
  if (failing.length > 0) {
    out.push({
      id: "ns:failing-pods",
      issue: `${failing.length} of ${plural(pods.length, "pod")} ${failing.length === 1 ? "is" : "are"} failing`,
      severity: failing.length * 2 >= pods.length ? "Critical" : "Warning",
      rootCause: `${plural(failing.length, "pod")} in this namespace ${failing.length === 1 ? "is" : "are"} crash-looping, can't start, were evicted or aren't ready.`,
      evidence: groupByReason(failing),
      remediation: ["Open a failing pod (Workloads → Pods) and read its Diagnostics tab for the cause and fix."],
    });
  }
  return out;
}
