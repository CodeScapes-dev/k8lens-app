export function aggregatePodsByPhase(pods = []) {
  const phases = { Running: 0, Pending: 0, Succeeded: 0, Failed: 0, Unknown: 0 };
  pods.forEach((pod) => {
    const phase = pod?.status?.phase || "Unknown";
    if (phase in phases) phases[phase]++;
    else phases.Unknown++;
  });
  return phases;
}

export function aggregateNodeHealth(nodes = []) {
  const stats = { total: nodes.length, ready: 0, notReady: 0, memoryPressure: 0, diskPressure: 0, pidPressure: 0 };
  nodes.forEach((node) => {
    const conditions = node?.status?.conditions || [];
    const ready = conditions.find((c) => c.type === "Ready");
    if (ready?.status === "True") stats.ready++;
    else stats.notReady++;
    if (conditions.find((c) => c.type === "MemoryPressure")?.status === "True") stats.memoryPressure++;
    if (conditions.find((c) => c.type === "DiskPressure")?.status === "True") stats.diskPressure++;
    if (conditions.find((c) => c.type === "PIDPressure")?.status === "True") stats.pidPressure++;
  });
  return stats;
}

export function aggregateWorkloadHealth(deployments = [], statefulSets = [], daemonSets = []) {
  const stats = {
    deployments: { total: deployments.length, healthy: 0, degraded: 0 },
    statefulSets: { total: statefulSets.length, healthy: 0, degraded: 0 },
    daemonSets: { total: daemonSets.length, healthy: 0, degraded: 0 },
  };
  deployments.forEach((d) => {
    const desired = d?.spec?.replicas || 0;
    const ready = d?.status?.readyReplicas || 0;
    if (desired > 0 && desired === ready) stats.deployments.healthy++;
    else stats.deployments.degraded++;
  });
  statefulSets.forEach((s) => {
    const desired = s?.spec?.replicas || 0;
    const ready = s?.status?.readyReplicas || 0;
    if (desired > 0 && desired === ready) stats.statefulSets.healthy++;
    else stats.statefulSets.degraded++;
  });
  daemonSets.forEach((ds) => {
    const desired = ds?.status?.desiredNumberScheduled || 0;
    const ready = ds?.status?.numberReady || 0;
    if (desired > 0 && desired === ready) stats.daemonSets.healthy++;
    else stats.daemonSets.degraded++;
  });
  return stats;
}

export function aggregatePodRestarts(pods = []) {
  let totalRestarts = 0;
  const crashLoopPods = [];
  pods.forEach((pod) => {
    const containerStatuses = pod?.status?.containerStatuses || [];
    containerStatuses.forEach((status) => {
      totalRestarts += status?.restartCount || 0;
      if (status?.state?.waiting?.reason === "CrashLoopBackOff") {
        crashLoopPods.push({
          pod: pod?.metadata?.name,
          namespace: pod?.metadata?.namespace,
          container: status?.name,
          restarts: status?.restartCount || 0,
        });
      }
    });
  });
  return { totalRestarts, crashLoopPods };
}

export function aggregateJobHealth(jobs = [], cronJobs = []) {
  const stats = {
    jobs: { total: jobs.length, succeeded: 0, failed: 0, active: 0 },
    cronJobs: { total: cronJobs.length, suspended: 0, active: 0 },
  };
  jobs.forEach((job) => {
    if (job?.status?.succeeded > 0) stats.jobs.succeeded++;
    else if (job?.status?.failed > 0) stats.jobs.failed++;
    else if (job?.status?.active > 0) stats.jobs.active++;
  });
  cronJobs.forEach((cj) => {
    if (cj?.spec?.suspend === true) stats.cronJobs.suspended++;
    if ((cj?.status?.active || []).length > 0) stats.cronJobs.active++;
  });
  return stats;
}

export function aggregateRecentEvents(events = [], minutesAgo = 15) {
  const cutoff = Date.now() - minutesAgo * 60 * 1000;
  const recent = events.filter((e) => {
    const ts = e?.lastTimestamp || e?.eventTime || e?.metadata?.creationTimestamp;
    return ts && new Date(ts).getTime() >= cutoff;
  });
  const warnings = recent.filter((e) => e.type === "Warning" || e.reason === "Warning");
  const reasonCounts = {};
  warnings.forEach((e) => {
    const r = e.reason || "Unknown";
    reasonCounts[r] = (reasonCounts[r] || 0) + 1;
  });
  return {
    total: recent.length,
    warnings: warnings.length,
    reasonCounts,
    topReasons: Object.entries(reasonCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([reason, count]) => ({ reason, count })),
    recentWarnings: warnings.slice(0, 10).map((e) => ({
      name: e?.regarding?.name || e?.involvedObject?.name || e?.metadata?.name,
      namespace: e?.regarding?.namespace || e?.involvedObject?.namespace || e?.metadata?.namespace,
      reason: e.reason,
      message: e.note || e.message,
      type: e.type,
      lastTimestamp: e?.lastTimestamp || e?.eventTime || e?.metadata?.creationTimestamp,
    })),
  };
}

export function findServicesWithoutEndpoints(services = [], endpoints = []) {
  const endpointMap = {};
  endpoints.forEach((ep) => {
    const key = `${ep?.metadata?.namespace}/${ep?.metadata?.name}`;
    const subsets = ep?.subsets || [];
    endpointMap[key] = subsets.some((s) => (s?.addresses || []).length > 0);
  });
  return services.filter((svc) => {
    const key = `${svc?.metadata?.namespace}/${svc?.metadata?.name}`;
    return !endpointMap[key];
  });
}

export function findNamespacesWithoutPolicies(namespaces = [], resourceQuotas = [], limitRanges = []) {
  const quotaNs = new Set(resourceQuotas.map((q) => q?.metadata?.namespace).filter(Boolean));
  const limitNs = new Set(limitRanges.map((l) => l?.metadata?.namespace).filter(Boolean));
  const systemNs = new Set(["kube-system", "kube-public", "kube-node-lease"]);
  const withoutQuota = [];
  const withoutLimits = [];
  namespaces.forEach((ns) => {
    const name = ns?.metadata?.name;
    if (!name || systemNs.has(name)) return;
    if (!quotaNs.has(name)) withoutQuota.push(name);
    if (!limitNs.has(name)) withoutLimits.push(name);
  });
  return { withoutQuota, withoutLimits };
}

export function buildUnhealthyWorkloads(pods = [], deployments = [], statefulSets = [], daemonSets = []) {
  const items = [];

  pods.forEach((pod) => {
    const phase = pod?.status?.phase;
    const containerStatuses = pod?.status?.containerStatuses || [];
    const name = pod?.metadata?.name;
    const namespace = pod?.metadata?.namespace;
    const age = pod?.metadata?.creationTimestamp;

    for (const cs of containerStatuses) {
      if (cs?.state?.waiting?.reason === "CrashLoopBackOff") {
        items.push({ kind: "Pod", name, namespace, reason: "CrashLoopBackOff", age, severity: "error" });
        return;
      }
    }
    if (phase === "Failed") {
      items.push({ kind: "Pod", name, namespace, reason: "Failed", age, severity: "error" });
    } else if (phase === "Pending") {
      items.push({ kind: "Pod", name, namespace, reason: "Pending", age, severity: "warning" });
    }
  });

  deployments.forEach((d) => {
    const desired = d?.spec?.replicas || 0;
    const ready = d?.status?.readyReplicas || 0;
    if (desired > 0 && ready < desired) {
      items.push({
        kind: "Deployment",
        name: d?.metadata?.name,
        namespace: d?.metadata?.namespace,
        reason: `${ready}/${desired} ready`,
        age: d?.metadata?.creationTimestamp,
        severity: "warning",
      });
    }
  });

  statefulSets.forEach((s) => {
    const desired = s?.spec?.replicas || 0;
    const ready = s?.status?.readyReplicas || 0;
    if (desired > 0 && ready < desired) {
      items.push({
        kind: "StatefulSet",
        name: s?.metadata?.name,
        namespace: s?.metadata?.namespace,
        reason: `${ready}/${desired} ready`,
        age: s?.metadata?.creationTimestamp,
        severity: "warning",
      });
    }
  });

  daemonSets.forEach((ds) => {
    const desired = ds?.status?.desiredNumberScheduled || 0;
    const ready = ds?.status?.numberReady || 0;
    if (desired > 0 && ready < desired) {
      items.push({
        kind: "DaemonSet",
        name: ds?.metadata?.name,
        namespace: ds?.metadata?.namespace,
        reason: `${ready}/${desired} ready`,
        age: ds?.metadata?.creationTimestamp,
        severity: "warning",
      });
    }
  });

  // Sort: errors first, then warnings
  return items.sort((a, b) => (a.severity === "error" ? -1 : 1) - (b.severity === "error" ? -1 : 1));
}
