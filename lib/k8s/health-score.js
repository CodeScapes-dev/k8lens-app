// Returns { score: 0-100, signals: [{ label, explanation, penalty }] }
// Only fired signals are returned. Score 100 = no signals.
export function computeHealthScore(resourceType, data) {
  const signals = [];

  const fire = (label, explanation, penalty) => signals.push({ label, explanation, penalty });

  switch (resourceType) {
    case "pod": {
      const pod = data?.pod ?? data;
      const containers = pod?.spec?.containers ?? [];
      const statuses = pod?.status?.containerStatuses ?? [];
      const restarts = statuses.reduce((s, c) => s + (c.restartCount ?? 0), 0);
      const phase = pod?.status?.phase;
      const events = data?.events ?? [];

      if (restarts > 20) fire("HighRestartCount", `Container has restarted ${restarts} times — likely a crash loop`, 30);
      else if (restarts > 5) fire("ElevatedRestartCount", `Container has restarted ${restarts} times`, 15);

      const oomKilled = statuses.some((c) => c.lastState?.terminated?.reason === "OOMKilled") ||
        events.some((e) => e.reason === "OOMKilling" || (e.message ?? "").includes("OOMKilled"));
      if (oomKilled) fire("OOMKilled", "Pod was killed due to memory limit being exceeded", 30);

      const missingLimits = containers.some((c) => !c.resources?.limits?.cpu || !c.resources?.limits?.memory);
      if (missingLimits) fire("MissingResourceLimits", "Containers without CPU/memory limits can consume unbounded resources", 15);

      const missingLiveness = containers.some((c) => !c.livenessProbe);
      if (missingLiveness) fire("NoLivenessProbe", "Without a liveness probe, Kubernetes cannot detect and restart stuck containers", 5);

      const missingReadiness = containers.some((c) => !c.readinessProbe);
      if (missingReadiness) fire("NoReadinessProbe", "Without a readiness probe, traffic may be sent to pods that are not ready", 15);

      if (phase === "Pending") {
        const createdAt = pod?.metadata?.creationTimestamp;
        if (createdAt) {
          const ageMs = Date.now() - new Date(createdAt).getTime();
          if (ageMs > 5 * 60 * 1000) fire("StuckInPending", "Pod has been in Pending state for more than 5 minutes", 30);
        }
      }
      break;
    }

    case "deployment":
    case "statefulset":
    case "daemonset": {
      const workload = data?.deployment ?? data?.statefulSet ?? data?.daemonSet ?? data;
      const desired = workload?.spec?.replicas ?? 0;
      const available = workload?.status?.availableReplicas ?? workload?.status?.readyReplicas ?? 0;
      const strategy = workload?.spec?.strategy ?? {};

      if (desired > 0 && available < desired) {
        fire("ReplicasBelowDesired", `Only ${available}/${desired} replicas are available`, available === 0 ? 40 : 25);
      }

      const hasPdb = data?.pdb != null;
      if (!hasPdb) fire("NoPodDisruptionBudget", "Without a PDB, maintenance operations may take down all replicas simultaneously", 5);

      const hasHpa = data?.hpa != null;
      if (!hasHpa) fire("NoHorizontalPodAutoscaler", "Without an HPA, this workload cannot scale automatically under load", 5);

      if (strategy.type === "RollingUpdate") {
        const mu = strategy.rollingUpdate?.maxUnavailable;
        if (mu === "100%" || mu === 100) {
          fire("MaxUnavailable100Pct", "Rolling updates may take down all replicas at once", 15);
        }
      }
      break;
    }

    case "service": {
      const endpoints = data?.endpoints;
      const readyAddresses = (endpoints?.subsets ?? []).flatMap((s) => s.addresses ?? []);
      const service = data?.service ?? data;
      const selector = service?.spec?.selector ?? {};

      if (Object.keys(selector).length > 0 && readyAddresses.length === 0) {
        fire("ZeroReadyEndpoints", "No pods are currently serving this Service", 40);
      }
      if (Object.keys(selector).length === 0 && service?.spec?.type !== "ExternalName") {
        fire("NoSelector", "Service has no selector — traffic will not be routed to any pods", 20);
      }
      break;
    }

    case "node": {
      const node = data?.node ?? data;
      const conditions = node?.status?.conditions ?? [];
      const get = (type) => conditions.find((c) => c.type === type);

      const ready = get("Ready");
      if (ready?.status === "False" || ready?.status === "Unknown") fire("NodeNotReady", "Node is not in a Ready state and cannot schedule pods", 50);

      const memPressure = get("MemoryPressure");
      if (memPressure?.status === "True") fire("MemoryPressure", "Node is under memory pressure", 30);

      const diskPressure = get("DiskPressure");
      if (diskPressure?.status === "True") fire("DiskPressure", "Node is under disk pressure", 15);

      if (node?.spec?.unschedulable) fire("Unschedulable", "Node is cordoned and will not accept new pods", 15);
      break;
    }

    case "secret": {
      const secret = data?.secret ?? data;
      const created = secret?.metadata?.creationTimestamp;
      if (created) {
        const ageDays = (Date.now() - new Date(created).getTime()) / (1000 * 60 * 60 * 24);
        if (ageDays > 180) fire("StaleSecret180Days", "This secret has not been rotated in over 180 days", 15);
        else if (ageDays > 90) fire("StaleSecret90Days", "This secret has not been rotated in over 90 days", 5);
      }
      break;
    }

    case "role":
    case "clusterrole": {
      const role = data?.role ?? data?.clusterRole ?? data;
      const rules = role?.rules ?? [];
      const allVerbs = rules.flatMap((r) => r?.verbs ?? []);
      const allResources = rules.flatMap((r) => r?.resources ?? []);

      if (allVerbs.includes("*")) fire("WildcardVerb", "This role grants all verbs — a significant privilege escalation risk", 30);
      if (allResources.includes("*")) fire("WildcardResource", "This role applies to all resources — scope should be limited", 15);
      break;
    }

    default:
      break;
  }

  const totalPenalty = signals.reduce((s, sig) => s + sig.penalty, 0);
  const score = Math.max(0, 100 - totalPenalty);
  return { score, signals };
}

export function scoreLabel(score) {
  if (score >= 80) return "Healthy";
  if (score >= 50) return "Degraded";
  return "Critical";
}

export function scoreColor(score) {
  if (score >= 80) return "var(--kl-ok)";
  if (score >= 50) return "var(--kl-warn)";
  return "var(--kl-err)";
}
