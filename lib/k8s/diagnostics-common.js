// Shared, dependency-free helpers for the diagnostics rules. Pure functions only: no I/O.

export const PENDING_THRESHOLD_MS = 5 * 60 * 1000;

const IMAGE_PULL_REASONS = new Set(["ImagePullBackOff", "ErrImagePull"]);
const START_ERROR_REASONS = new Set(["CreateContainerConfigError", "CreateContainerError", "InvalidImageName"]);

export const eventTime = (e) => e?.lastTimestamp || e?.eventTime || e?.metadata?.creationTimestamp;
export const eventMessage = (e) => e?.message ?? e?.note ?? "";
export const eventTarget = (e) => e?.involvedObject ?? e?.regarding;

export const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

export function latestEvent(events, predicate) {
  return (events ?? [])
    .filter(predicate)
    .sort((a, b) => new Date(eventTime(b) ?? 0) - new Date(eventTime(a) ?? 0))[0];
}

export function ageMs(obj, now = Date.now()) {
  const created = obj?.metadata?.creationTimestamp;
  return created ? now - new Date(created).getTime() : null;
}

export function condition(obj, type) {
  return (obj?.status?.conditions ?? []).find((c) => c.type === type);
}

// ---------- Kubernetes quantities ("100m", "1Gi", "20") ----------

const QUANTITY_SUFFIX = {
  n: 1e-9, u: 1e-6, m: 1e-3, "": 1, k: 1e3, K: 1e3, M: 1e6, G: 1e9, T: 1e12, P: 1e15, E: 1e18,
  Ki: 1024, Mi: 1024 ** 2, Gi: 1024 ** 3, Ti: 1024 ** 4, Pi: 1024 ** 5, Ei: 1024 ** 6,
};

export function parseQuantity(value) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value === "number") return value;
  const m = String(value).trim().match(/^([+-]?\d*\.?\d+(?:[eE][+-]?\d+)?)([a-zA-Z]*)$/);
  if (!m) return null;
  const multiplier = QUANTITY_SUFFIX[m[2]];
  return multiplier === undefined ? null : Number(m[1]) * multiplier;
}

// ---------- label selectors / node selector expressions ----------

export function matchExpression(labels, expr) {
  const v = labels?.[expr.key];
  const values = expr.values ?? [];
  switch (expr.operator) {
    case "In":
      return v !== undefined && values.includes(v);
    case "NotIn":
      return v === undefined || !values.includes(v);
    case "Exists":
      return v !== undefined;
    case "DoesNotExist":
      return v === undefined;
    case "Gt":
      return v !== undefined && Number(v) > Number(values[0]);
    case "Lt":
      return v !== undefined && Number(v) < Number(values[0]);
    default:
      return false;
  }
}

/** Kubernetes LabelSelector ({matchLabels, matchExpressions}); an empty selector matches everything. */
export function selectorMatches(selector, labels) {
  const matchLabels = selector?.matchLabels ?? {};
  const matchExpressions = selector?.matchExpressions ?? [];
  return (
    Object.entries(matchLabels).every(([k, v]) => labels?.[k] === v) &&
    matchExpressions.every((e) => matchExpression(labels, e))
  );
}

// ---------- pods ----------

export function isCrashLoopBackOff(containerStatus) {
  return containerStatus?.state?.waiting?.reason === "CrashLoopBackOff";
}

export function totalRestarts(pod) {
  return (pod?.status?.containerStatuses ?? []).reduce((s, c) => s + (c.restartCount ?? 0), 0);
}

export function isOomKilled(containerStatuses = [], events = []) {
  return (
    containerStatuses.some((c) => c.lastState?.terminated?.reason === "OOMKilled") ||
    events.some((e) => e.reason === "OOMKilling" || (e.message ?? "").includes("OOMKilled"))
  );
}

export function podAgeMs(pod, now = Date.now()) {
  return ageMs(pod, now);
}

export function isStuckPending(pod, now = Date.now()) {
  if (pod?.status?.phase !== "Pending") return false;
  const age = podAgeMs(pod, now);
  return age !== null && age > PENDING_THRESHOLD_MS;
}

export function lastTermination(containerStatus) {
  return containerStatus?.lastState?.terminated ?? containerStatus?.state?.terminated;
}

/** A container that keeps dying: waiting in CrashLoopBackOff, or caught mid-restart after several failures. */
export function isCrashing(containerStatus) {
  if (isCrashLoopBackOff(containerStatus)) return true;
  const term = lastTermination(containerStatus);
  return (
    (containerStatus?.restartCount ?? 0) >= 3 &&
    !!term &&
    term.exitCode !== 0 &&
    containerStatus?.ready !== true &&
    !containerStatus?.state?.running
  );
}

export function waitingReason(containerStatus) {
  return containerStatus?.state?.waiting?.reason;
}

export const isImagePullFailure = (containerStatus) => IMAGE_PULL_REASONS.has(waitingReason(containerStatus));
export const isStartError = (containerStatus) => START_ERROR_REASONS.has(waitingReason(containerStatus));

/** Running for a while but a container is up and still failing its readiness (or startup) check. */
export function isRunningNotReady(pod, now = Date.now()) {
  if (pod?.status?.phase !== "Running") return false;
  const age = podAgeMs(pod, now);
  if (age === null || age <= PENDING_THRESHOLD_MS) return false;
  return (pod?.status?.containerStatuses ?? []).some((c) => c.ready === false && !!c.state?.running);
}

export function allContainerStatuses(pod) {
  return [
    ...(pod?.status?.initContainerStatuses ?? []).map((cs) => ({ cs, isInit: true })),
    ...(pod?.status?.containerStatuses ?? []).map((cs) => ({ cs, isInit: false })),
  ];
}

/**
 * One label for the most serious reason a pod is unhealthy, or null. Used wherever a
 * quick "is this pod failing, and why" answer is needed (health score, dashboard, node/namespace checks).
 */
export function podFailureReason(pod, now = Date.now()) {
  const phase = pod?.status?.phase;
  if (phase === "Failed") return pod?.status?.reason === "Evicted" ? "Evicted" : "Failed";
  const statuses = allContainerStatuses(pod).map((x) => x.cs);
  const pull = statuses.find(isImagePullFailure);
  if (pull) return waitingReason(pull);
  const startError = statuses.find(isStartError);
  if (startError) return waitingReason(startError);
  if (statuses.some(isCrashing)) return "CrashLoopBackOff";
  if (isRunningNotReady(pod, now)) return "NotReady";
  return null;
}
