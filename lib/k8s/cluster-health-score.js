import {
  aggregateNodeHealth,
  aggregatePodsByPhase,
  aggregateWorkloadHealth,
  aggregateRecentEvents,
  aggregatePodRestarts,
  findServicesWithoutEndpoints,
  findNamespacesWithoutPolicies,
} from "./dashboard-aggregations";

export function calculateClusterHealthScore(data) {
  let score = 100;
  const deductions = [];

  const nodeHealth = aggregateNodeHealth(data.nodes || []);
  let nodeDeductions = 0;
  if (nodeHealth.notReady > 0) {
    const d = Math.min(15, nodeHealth.notReady * 5);
    nodeDeductions += d;
    deductions.push({ category: "Node Health", reason: `${nodeHealth.notReady} node(s) not ready`, deduction: d });
  }
  if (nodeHealth.diskPressure > 0) {
    nodeDeductions += 10;
    deductions.push({ category: "Node Health", reason: `${nodeHealth.diskPressure} node(s) under disk pressure`, deduction: 10 });
  }
  if (nodeHealth.memoryPressure > 0) {
    nodeDeductions += 10;
    deductions.push({ category: "Node Health", reason: `${nodeHealth.memoryPressure} node(s) under memory pressure`, deduction: 10 });
  }
  if (nodeHealth.pidPressure > 0) {
    nodeDeductions += 5;
    deductions.push({ category: "Node Health", reason: `${nodeHealth.pidPressure} node(s) under PID pressure`, deduction: 5 });
  }
  score -= Math.min(30, nodeDeductions);

  const podPhases = aggregatePodsByPhase(data.pods || []);
  const restartInfo = aggregatePodRestarts(data.pods || []);
  let podDeductions = 0;
  if (podPhases.Failed > 0) {
    const d = Math.min(10, podPhases.Failed);
    podDeductions += d;
    deductions.push({ category: "Pod Health", reason: `${podPhases.Failed} failed pod(s)`, deduction: d });
  }
  if (podPhases.Pending > 0) {
    const d = Math.min(10, podPhases.Pending);
    podDeductions += d;
    deductions.push({ category: "Pod Health", reason: `${podPhases.Pending} pending pod(s)`, deduction: d });
  }
  if (restartInfo.crashLoopPods.length > 0) {
    podDeductions += 10;
    deductions.push({ category: "Pod Health", reason: `${restartInfo.crashLoopPods.length} pod(s) in CrashLoopBackOff`, deduction: 10 });
  }
  score -= Math.min(30, podDeductions);

  const workloadHealth = aggregateWorkloadHealth(data.deployments || [], data.statefulSets || [], data.daemonSets || []);
  let workloadDeductions = 0;
  if (workloadHealth.deployments.degraded > 0) {
    const d = Math.min(10, workloadHealth.deployments.degraded * 2);
    workloadDeductions += d;
    deductions.push({ category: "Workload Health", reason: `${workloadHealth.deployments.degraded} degraded deployment(s)`, deduction: d });
  }
  if (workloadHealth.statefulSets.degraded > 0) {
    const d = Math.min(10, workloadHealth.statefulSets.degraded * 2);
    workloadDeductions += d;
    deductions.push({ category: "Workload Health", reason: `${workloadHealth.statefulSets.degraded} degraded statefulset(s)`, deduction: d });
  }
  if (workloadHealth.daemonSets.degraded > 0) {
    const d = Math.min(5, workloadHealth.daemonSets.degraded * 2);
    workloadDeductions += d;
    deductions.push({ category: "Workload Health", reason: `${workloadHealth.daemonSets.degraded} degraded daemonset(s)`, deduction: d });
  }
  score -= Math.min(20, workloadDeductions);

  const eventStats = aggregateRecentEvents(data.events || [], 15);
  if (eventStats.warnings > 0) {
    const d = Math.min(10, eventStats.warnings);
    score -= d;
    deductions.push({ category: "Recent Events", reason: `${eventStats.warnings} warning event(s) in last 15 minutes`, deduction: d });
  }

  const policiesCheck = findNamespacesWithoutPolicies(data.namespaces || [], data.resourceQuotas || [], data.limitRanges || []);
  const brokenServices = findServicesWithoutEndpoints(data.services || [], data.endpoints || []);
  let configDeductions = 0;
  if (policiesCheck.withoutQuota.length > 0) {
    configDeductions += 5;
    deductions.push({ category: "Configuration", reason: `${policiesCheck.withoutQuota.length} namespace(s) without ResourceQuota`, deduction: 5 });
  }
  if (brokenServices.length > 0) {
    configDeductions += 5;
    deductions.push({ category: "Networking", reason: `${brokenServices.length} service(s) without endpoints`, deduction: 5 });
  }
  score -= Math.min(10, configDeductions);

  score = Math.max(0, Math.min(100, score));

  let healthLabel = "Critical";
  if (score >= 90) healthLabel = "Healthy";
  else if (score >= 70) healthLabel = "Degraded";
  else if (score >= 50) healthLabel = "Unstable";

  return { score, healthLabel, deductions };
}
