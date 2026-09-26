import * as f from "./pods.js";

export function collect({ computeHealthScore, aggregatePodRestarts, buildUnhealthyWorkloads }) {
  const cases = {
    healthy: [f.healthyPod, []],
    crashLoopApp: [f.crashLoopAppPod, []],
    oom: [f.oomPod, []],
    oomEventOnly: [f.oomEventOnlyPod, f.oomEvents],
    multiContainer: [f.multiContainerPod, []],
    configMissing: [f.configMissingPod, f.configMissingEvents],
    initCrash: [f.initCrashPod, []],
    cleanExit: [f.cleanExitCrashPod, []],
    pendingOld: [f.pendingOldPod, []],
    pendingYoung: [f.pendingYoungPod(), []],
    failed: [f.failedPod, []],
    imagePull: [f.imagePullPod, f.imagePullNotFoundEvents],
    startError: [f.startErrorConfigPod, []],
    evicted: [f.evictedPod, []],
    failedExit: [f.failedExitPod, []],
    notReady: [f.notReadyPod, f.notReadyEvents],
    oldFlapping: [f.oldFlappingPod, []],
    recovered: [f.recoveredPod, []],
  };

  const health = {};
  for (const [key, [pod, events]] of Object.entries(cases)) {
    health[key] = computeHealthScore("pod", { pod, events });
  }

  const pods = Object.values(cases).map(([pod]) => pod);
  return {
    health,
    restarts: aggregatePodRestarts(pods),
    unhealthy: buildUnhealthyWorkloads(pods, [], [], []).map((item) =>
      item.name === "pending-young" ? { ...item, age: "<now>" } : item,
    ),
  };
}
