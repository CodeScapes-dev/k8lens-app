const OLD = "2020-01-01T00:00:00Z";
const youngTimestamp = () => new Date().toISOString();

const container = (name, extra = {}) => ({
  name,
  image: "nginx:alpine",
  resources: { limits: { cpu: "100m", memory: "128Mi" } },
  livenessProbe: {},
  readinessProbe: {},
  ...extra,
});

const pod = ({ name, phase = "Running", created = OLD, spec = {}, containerStatuses, initContainerStatuses, nodeName }) => ({
  metadata: { name, namespace: "demo", creationTimestamp: created },
  spec: { containers: [container("app")], ...(nodeName ? { nodeName } : {}), ...spec },
  status: { phase, containerStatuses, initContainerStatuses },
});

export const healthyPod = pod({
  name: "healthy",
  nodeName: "node-1",
  containerStatuses: [{ name: "app", restartCount: 0, state: { running: {} } }],
});

export const crashLoopAppPod = pod({
  name: "crash-app",
  nodeName: "node-1",
  containerStatuses: [
    {
      name: "app",
      restartCount: 25,
      state: { waiting: { reason: "CrashLoopBackOff" } },
      lastState: { terminated: { reason: "Error", exitCode: 1 } },
    },
  ],
});

export const oomPod = pod({
  name: "oom",
  nodeName: "node-1",
  containerStatuses: [
    {
      name: "app",
      restartCount: 7,
      state: { waiting: { reason: "CrashLoopBackOff" } },
      lastState: { terminated: { reason: "OOMKilled", exitCode: 137 } },
    },
  ],
});

export const oomEventOnlyPod = pod({
  name: "oom-event",
  nodeName: "node-1",
  containerStatuses: [{ name: "app", restartCount: 1, state: { running: {} } }],
});
export const oomEvents = [{ type: "Warning", reason: "OOMKilling", message: "Memory cgroup out of memory" }];

export const multiContainerPod = pod({
  name: "multi",
  nodeName: "node-1",
  spec: { containers: [container("web"), container("sidecar")] },
  containerStatuses: [
    { name: "web", restartCount: 2, state: { running: {} } },
    {
      name: "sidecar",
      restartCount: 9,
      state: { waiting: { reason: "CrashLoopBackOff" } },
      lastState: { terminated: { reason: "Error", exitCode: 2 } },
    },
  ],
});

export const configMissingPod = pod({
  name: "config-missing",
  nodeName: "node-1",
  spec: {
    containers: [container("app", { envFrom: [{ configMapRef: { name: "demo-config" } }] })],
  },
  containerStatuses: [
    {
      name: "app",
      restartCount: 4,
      state: { waiting: { reason: "CrashLoopBackOff" } },
      lastState: { terminated: { reason: "Error", exitCode: 1 } },
    },
  ],
});
export const configMissingEvents = [
  {
    type: "Warning",
    reason: "Failed",
    message: 'Error: couldn\'t find key GREETING in ConfigMap demo/demo-config',
  },
];

export const initCrashPod = pod({
  name: "init-crash",
  nodeName: "node-1",
  containerStatuses: [{ name: "app", restartCount: 0, state: { waiting: { reason: "PodInitializing" } } }],
  initContainerStatuses: [
    {
      name: "setup",
      restartCount: 5,
      state: { waiting: { reason: "CrashLoopBackOff" } },
      lastState: { terminated: { reason: "Error", exitCode: 3 } },
    },
  ],
});

export const cleanExitCrashPod = pod({
  name: "exit-zero",
  nodeName: "node-1",
  containerStatuses: [
    {
      name: "app",
      restartCount: 3,
      state: { waiting: { reason: "CrashLoopBackOff" } },
      lastState: { terminated: { reason: "Completed", exitCode: 0 } },
    },
  ],
});

export const pendingOldPod = pod({ name: "pending-old", phase: "Pending" });
export const pendingYoungPod = () => pod({ name: "pending-young", phase: "Pending", created: youngTimestamp() });
export const failedPod = pod({ name: "failed", phase: "Failed", nodeName: "node-1" });

export const pendingSelectorPod = pod({
  name: "pending-selector",
  phase: "Pending",
  spec: { nodeSelector: { disktype: "ssd" } },
});

export const pendingTaintPod = pod({ name: "pending-taint", phase: "Pending" });

export const pendingAffinityPod = pod({
  name: "pending-affinity",
  phase: "Pending",
  spec: {
    affinity: {
      nodeAffinity: {
        requiredDuringSchedulingIgnoredDuringExecution: {
          nodeSelectorTerms: [{ matchExpressions: [{ key: "zone", operator: "In", values: ["us-east-1a"] }] }],
        },
      },
    },
  },
});

export const pendingTolerationPod = pod({
  name: "pending-tolerated",
  phase: "Pending",
  spec: { tolerations: [{ key: "dedicated", operator: "Equal", value: "gpu", effect: "NoSchedule" }] },
});

const node = (name, labels = {}, taints = []) => ({
  metadata: { name, labels },
  spec: { taints },
});

export const plainNodes = [node("node-1", { zone: "us-east-1b" }), node("node-2", { zone: "us-east-1b" })];
export const ssdNodes = [node("node-1", { disktype: "ssd" }), node("node-2", {}), node("node-3", {})];
export const taintedNodes = [
  node("node-1", {}, [{ key: "dedicated", value: "gpu", effect: "NoSchedule" }]),
  node("node-2", {}, [{ key: "dedicated", value: "gpu", effect: "NoSchedule" }]),
  node("node-3", {}),
];
export const allTaintedNodes = [
  node("node-1", {}, [{ key: "dedicated", value: "gpu", effect: "NoSchedule" }]),
  node("node-2", {}, [{ key: "dedicated", value: "gpu", effect: "NoSchedule" }]),
];

export const failedSchedulingEvent = (message) => ({
  type: "Warning",
  reason: "FailedScheduling",
  message,
});

// ---------- pod failure shapes beyond crash loops ----------

export const imagePullPod = pod({
  name: "image-pull",
  phase: "Pending",
  nodeName: "node-1",
  spec: { containers: [container("app", { image: "registry.example/team/app:v9" })] },
  containerStatuses: [
    {
      name: "app",
      restartCount: 0,
      state: { waiting: { reason: "ImagePullBackOff", message: 'Back-off pulling image "registry.example/team/app:v9"' } },
    },
  ],
});
export const imagePullNotFoundEvents = [
  {
    type: "Warning",
    reason: "Failed",
    message: 'Failed to pull image "registry.example/team/app:v9": rpc error: code = NotFound desc = failed to resolve reference: registry.example/team/app:v9: not found',
  },
];
export const imagePullAuthEvents = [
  { type: "Warning", reason: "Failed", message: 'Failed to pull image "x": pull access denied, repository does not exist or may require authorization' },
];

export const startErrorConfigPod = pod({
  name: "start-config",
  phase: "Pending",
  nodeName: "node-1",
  containerStatuses: [
    {
      name: "app",
      restartCount: 0,
      state: { waiting: { reason: "CreateContainerConfigError", message: "couldn't find key GREETING in ConfigMap k8lens-demo/demo-config" } },
    },
  ],
});
export const startErrorRootPod = pod({
  name: "start-root",
  phase: "Pending",
  nodeName: "node-1",
  containerStatuses: [
    {
      name: "app",
      restartCount: 0,
      state: { waiting: { reason: "CreateContainerConfigError", message: "container has runAsNonRoot and image will run as root" } },
    },
  ],
});

export const stuckMountPod = pod({
  name: "stuck-mount",
  phase: "Pending",
  nodeName: "node-1",
  containerStatuses: [{ name: "app", restartCount: 0, state: { waiting: { reason: "ContainerCreating" } } }],
});
export const stuckMountEvents = [
  { type: "Warning", reason: "FailedMount", message: 'MountVolume.SetUp failed for volume "data" : persistentvolumeclaim "data-claim" not found' },
];
export const stuckMissingConfigMapEvents = [
  { type: "Warning", reason: "FailedMount", message: 'MountVolume.SetUp failed for volume "cfg" : configmap "app-cfg" not found' },
];
export const stuckSandboxEvents = [
  { type: "Warning", reason: "FailedCreatePodSandBox", message: "Failed to create pod sandbox: plugin type=\"calico\" failed" },
];

export const evictedPod = {
  metadata: { name: "evicted", namespace: "demo", creationTimestamp: OLD },
  spec: { nodeName: "node-1", containers: [container("app")] },
  status: {
    phase: "Failed",
    reason: "Evicted",
    message: "The node was low on resource: memory. Threshold quantity: 100Mi, available: 80Mi.",
  },
};

export const failedExitPod = pod({
  name: "failed-exit",
  phase: "Failed",
  nodeName: "node-1",
  containerStatuses: [{ name: "app", restartCount: 0, state: { terminated: { exitCode: 2, reason: "Error" } } }],
});

export const notReadyPod = pod({
  name: "not-ready",
  nodeName: "node-1",
  spec: {
    containers: [container("app", { readinessProbe: { httpGet: { path: "/healthz", port: 8080 } } })],
  },
  containerStatuses: [{ name: "app", restartCount: 0, ready: false, started: true, state: { running: {} } }],
});
export const notReadyEvents = [
  { type: "Warning", reason: "Unhealthy", message: "Readiness probe failed: HTTP probe failed with statuscode: 503" },
];

export const livenessPod = pod({
  name: "liveness",
  nodeName: "node-1",
  spec: {
    containers: [container("app", { livenessProbe: { httpGet: { path: "/live", port: 8080 } } })],
  },
  containerStatuses: [
    {
      name: "app",
      restartCount: 6,
      state: { waiting: { reason: "CrashLoopBackOff" } },
      lastState: { terminated: { exitCode: 137, reason: "Error" } },
    },
  ],
});
export const livenessEvents = [
  { type: "Warning", reason: "Unhealthy", message: "Liveness probe failed: Get \"http://10.0.0.5:8080/live\": connection refused" },
];

// crashing for hours, caught between restarts (state=terminated, not waiting)
export const oldFlappingPod = pod({
  name: "old-flapping",
  nodeName: "node-1",
  containerStatuses: [
    {
      name: "app",
      restartCount: 10,
      ready: false,
      state: { terminated: { exitCode: 1, reason: "Error" } },
      lastState: { terminated: { exitCode: 1, reason: "Error" } },
    },
  ],
});

// restarted a few times long ago, healthy now
export const recoveredPod = pod({
  name: "recovered",
  nodeName: "node-1",
  containerStatuses: [
    { name: "app", restartCount: 4, ready: true, state: { running: {} }, lastState: { terminated: { exitCode: 1, reason: "Error" } } },
  ],
});
