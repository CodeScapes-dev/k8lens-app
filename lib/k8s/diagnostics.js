/**
 * Deterministic, read-only diagnostics for broken pods and pod-owning workloads.
 * Pure functions over already-fetched Kubernetes objects: no I/O of any kind.
 *
 * @typedef {Object} Diagnosis
 * @property {string} id
 * @property {string} issue plain-language title
 * @property {string} [technicalName] Kubernetes term, shown as a small label
 * @property {"Critical"|"Warning"} severity
 * @property {string} rootCause
 * @property {string[]} evidence
 * @property {string[]} remediation
 * @property {string[]} [pods] affected pod names (workload views only)
 */

import {
  PENDING_THRESHOLD_MS,
  allContainerStatuses,
  condition,
  eventMessage,
  eventTarget,
  eventTime,
  isCrashLoopBackOff,
  isCrashing,
  isImagePullFailure,
  isOomKilled,
  isRunningNotReady,
  isStartError,
  isStuckPending,
  lastTermination,
  latestEvent,
  matchExpression,
  podAgeMs,
  totalRestarts,
  waitingReason,
} from "./diagnostics-common.js";
import { diagnoseConfigMap, diagnoseLimitRange, diagnoseResourceQuota, diagnoseSecret } from "./diagnostics-config.js";
import { diagnoseHpa } from "./diagnostics-autoscaling.js";
import { diagnoseNamespace, diagnoseNode } from "./diagnostics-cluster.js";
import {
  diagnoseClusterRole,
  diagnoseClusterRoleBinding,
  diagnoseRole,
  diagnoseRoleBinding,
  diagnoseServiceAccount,
} from "./diagnostics-access.js";
import { diagnosePv, diagnosePvc, diagnoseStorageClass } from "./diagnostics-storage.js";
import { diagnoseEndpoints, diagnoseIngress, diagnoseIngressClass, diagnoseNetworkPolicy, diagnoseService } from "./diagnostics-network.js";

// Shared detection helpers live in diagnostics-common.js; re-exported for existing callers.
export { PENDING_THRESHOLD_MS, isCrashLoopBackOff, isOomKilled, isStuckPending, podAgeMs, totalRestarts };

const CONFIG_EVENT_REASONS = new Set(["Failed", "FailedMount", "FailedCreatePodContainer"]);
const HARD_TAINT_EFFECTS = new Set(["NoSchedule", "NoExecute"]);
const SIGNALS = { 130: "SIGINT", 137: "SIGKILL", 139: "SIGSEGV", 143: "SIGTERM" };

/**
 * Classifies every container that keeps dying (init containers included).
 * @returns {Array<{container: string, isInit: boolean, kind: "oom"|"config"|"liveness"|"app", restarts: number,
 *   exitCode?: number, reason?: string, signal?: number, config?: object}>}
 */
export function classifyCrashLoop(pod, events = []) {
  const findings = [];
  for (const { cs, isInit } of allContainerStatuses(pod)) {
    if (!isCrashing(cs)) continue;
    const term = lastTermination(cs);
    const base = {
      container: cs.name,
      isInit,
      restarts: cs.restartCount ?? 0,
      exitCode: term?.exitCode,
      reason: term?.reason,
      signal: term?.signal,
    };
    if (term?.reason === "OOMKilled") {
      findings.push({ ...base, kind: "oom" });
      continue;
    }
    const config = findConfigSignal(pod, events, term);
    if (config) {
      findings.push({ ...base, kind: "config", config });
      continue;
    }
    findings.push({ ...base, kind: isLivenessKill(events, term) ? "liveness" : "app" });
  }
  return findings;
}

function isLivenessKill(events, term) {
  return (
    [137, 143].includes(term?.exitCode) &&
    events.some((e) => /liveness probe failed|failed liveness probe/i.test(eventMessage(e)))
  );
}

// ---------- ConfigMap / Secret signal detection (names and keys only, never values) ----------

const capitalize = (s) => (s.toLowerCase() === "configmap" ? "ConfigMap" : "Secret");
const stripPunct = (s) => s.replace(/[.,;:'"]+$/, "");

function referencedConfigSources(pod) {
  const refs = new Set();
  const add = (kind, name) => name && refs.add(`${kind}\u0000${name}`);
  const specs = [...(pod?.spec?.containers ?? []), ...(pod?.spec?.initContainers ?? [])];
  for (const c of specs) {
    for (const from of c.envFrom ?? []) {
      add("ConfigMap", from.configMapRef?.name);
      add("Secret", from.secretRef?.name);
    }
    for (const env of c.env ?? []) {
      add("ConfigMap", env.valueFrom?.configMapKeyRef?.name);
      add("Secret", env.valueFrom?.secretKeyRef?.name);
    }
  }
  for (const v of pod?.spec?.volumes ?? []) {
    add("ConfigMap", v.configMap?.name);
    add("Secret", v.secret?.secretName);
  }
  return [...refs].map((r) => {
    const [kind, name] = r.split("\u0000");
    return { kind, name };
  });
}

function matchConfigMessage(text, pod) {
  let m = text.match(/couldn't find key (\S+) in (ConfigMap|Secret) (?:\S+\/)?(\S+)/i);
  if (m) return { kind: capitalize(m[2]), name: stripPunct(m[3]), key: stripPunct(m[1]), problem: "missingKey" };

  m = text.match(/(configmap|secret) "([^"]+)" not found/i);
  if (m) return { kind: capitalize(m[1]), name: m[2], problem: "notFound" };

  if (/config\s?map|secret/i.test(text)) {
    const named = referencedConfigSources(pod).find((r) => text.includes(r.name));
    if (named) return { ...named, problem: "unknown" };
  }
  return null;
}

function findConfigSignal(pod, events, term) {
  const candidates = events
    .filter(
      (e) =>
        e?.type === "Warning" &&
        (CONFIG_EVENT_REASONS.has(e.reason) || /config\s?map|secret/i.test(eventMessage(e))),
    )
    .map((e) => ({ text: eventMessage(e), source: `event ${e.reason}` }));
  if (term?.message) candidates.push({ text: term.message, source: "termination message", hidden: true });

  for (const c of candidates) {
    const hit = matchConfigMessage(c.text, pod);
    if (hit) return { ...hit, source: c.source, evidenceText: c.hidden ? null : c.text };
  }
  return null;
}

// ---------- Rule 1: CrashLoopBackOff ----------

function containerSpec(pod, name) {
  return [...(pod?.spec?.containers ?? []), ...(pod?.spec?.initContainers ?? [])].find((c) => c.name === name);
}

function crashDiagnosis(pod, f) {
  const where = f.isInit ? `"${f.container}" startup step (an init container)` : `"${f.container}" container`;
  const initNote = f.isInit
    ? ["This step runs before the main app starts, so fix it in the workload's init container section, not the main container."]
    : [];
  const restartLine = `Restarted ${f.restarts} time${f.restarts === 1 ? "" : "s"}`;
  const ns = pod?.metadata?.namespace;
  const id = `crashloop:${f.kind}:${f.isInit ? "init:" : ""}${f.container}`;

  if (f.kind === "oom") {
    const limit = containerSpec(pod, f.container)?.resources?.limits?.memory;
    return {
      id,
      issue: "Ran out of memory",
      technicalName: "OOMKilled",
      severity: "Critical",
      rootCause: `The ${where} used more memory than it is allowed${limit ? ` (${limit})` : ""}, so Kubernetes stopped it.`,
      evidence: [
        `Last stop reason: OOMKilled${f.exitCode !== undefined ? ` (exit code ${f.exitCode})` : ""}`,
        restartLine,
        limit ? `Memory limit: ${limit}` : "No memory limit is set on this container",
      ],
      remediation: [
        `Give the ${where} more memory by raising its memory limit.`,
        "If it shouldn't need that much, look for a memory leak or a setting that lets it grow without bound.",
        ...initNote,
      ],
    };
  }

  if (f.kind === "config") {
    const c = f.config;
    const target = `${c.kind} "${c.name}"`;
    const rootCause =
      c.problem === "missingKey"
        ? `The ${where} needs a setting called "${c.key}", but ${target} doesn't have it.`
        : c.problem === "notFound"
          ? `The ${where} needs ${target}, but it doesn't exist.`
          : `The ${where} is failing because of a problem with ${target}.`;
    const remediation =
      c.problem === "missingKey"
        ? [`Add "${c.key}" to ${target}, or`, "Change the pod to use a setting that does exist."]
        : c.problem === "notFound"
          ? [`Create ${target}${ns ? ` in the "${ns}" namespace` : ""}, or`, "Fix the name the pod refers to."]
          : [`Check that ${target} exists and has everything the pod expects.`];
    return {
      id,
      issue: "Missing configuration",
      technicalName: f.technicalName ?? "CrashLoopBackOff",
      severity: "Critical",
      rootCause,
      evidence: [
        c.evidenceText ? `Kubernetes reported (${c.source}): ${c.evidenceText}` : `Detected from the ${c.source}`,
        `Needs: ${c.kind} ${c.name}${c.key ? `, setting ${c.key}` : ""}`,
        restartLine,
      ],
      remediation: [...remediation, ...initNote],
    };
  }

  if (f.kind === "liveness") {
    const probe = describeProbe(containerSpec(pod, f.container)?.livenessProbe);
    const probeEvent = latestEvent(f.events ?? [], (e) => /liveness probe failed/i.test(eventMessage(e)));
    return {
      id,
      issue: "Failing its health check",
      technicalName: "Liveness probe failed",
      severity: "Critical",
      rootCause: `Kubernetes keeps restarting the ${where} because it fails its liveness (health) check.`,
      evidence: [
        ...(probeEvent ? [`Kubernetes reported: ${eventMessage(probeEvent)}`] : []),
        probe ? `Health check: ${probe}` : "No liveness check details on the container spec",
        `Last stop: exit code ${f.exitCode}${SIGNALS[f.exitCode] ? `, ${SIGNALS[f.exitCode]}` : ""}`,
        restartLine,
      ],
      remediation: [
        "Make sure the health check's path and port match what the app really serves.",
        "If the app is just slow to start, raise initialDelaySeconds or timeoutSeconds, or add a startup probe.",
        "Open the Logs tab and read the previous run's output to see whether the app was actually unhealthy.",
        ...initNote,
      ],
    };
  }

  const haveTermination = f.exitCode !== undefined;
  const signal = SIGNALS[f.exitCode] ? `, ${SIGNALS[f.exitCode]}` : "";
  const rootCause = !haveTermination
    ? `The ${where} keeps crashing, but Kubernetes hasn't reported why yet.`
    : f.exitCode === 0
      ? `The ${where} finished without an error (exit code 0) but keeps being restarted. That's unusual.`
      : `The ${where} starts, then stops with an error (exit code ${f.exitCode}${signal}), and Kubernetes keeps restarting it.`;
  return {
    id,
    issue: "App keeps crashing",
    technicalName: "CrashLoopBackOff",
    severity: "Critical",
    rootCause,
    evidence: [
      haveTermination
        ? `Last stop: exit code ${f.exitCode}${f.reason ? ` (${f.reason})` : ""}`
        : "Kubernetes hasn't reported how it last stopped",
      restartLine,
      "No sign of a missing settings file or secret",
    ],
    remediation: [
      "Open the Logs tab and read the output from the last run. It usually says why the app stopped.",
      f.exitCode === 0
        ? "Check whether this container is meant to keep running. An app that finishes right away is restarted automatically."
        : "Check the container's start command and settings (environment variables).",
      ...initNote,
    ],
  };
}

// ---------- Rule: probes ----------

function describeProbe(probe) {
  if (!probe) return null;
  if (probe.httpGet) return `HTTP GET ${probe.httpGet.path ?? "/"} on port ${probe.httpGet.port}`;
  if (probe.tcpSocket) return `TCP connection to port ${probe.tcpSocket.port}`;
  if (probe.grpc) return `gRPC check on port ${probe.grpc.port}`;
  if (probe.exec) return `command: ${(probe.exec.command ?? []).join(" ").slice(0, 80)}`;
  return "custom check";
}

function notReadyDiagnoses(pod, events, now) {
  if (!isRunningNotReady(pod, now)) return [];
  return (pod?.status?.containerStatuses ?? [])
    .filter((cs) => cs.ready === false && cs.state?.running)
    .map((cs) => {
      const startup = cs.started === false;
      const spec = containerSpec(pod, cs.name);
      const probe = describeProbe(startup ? spec?.startupProbe : spec?.readinessProbe);
      const failure = latestEvent(events, (e) => e?.reason === "Unhealthy" && /readiness|startup/i.test(eventMessage(e)));
      const kind = startup ? "startup" : "readiness";
      return {
        id: `notready:${cs.name}`,
        issue: "Running but not ready",
        technicalName: startup ? "Startup probe failing" : "Readiness probe failing",
        severity: "Warning",
        rootCause: `The "${cs.name}" container is running but isn't passing its ${kind} check, so Kubernetes sends it no traffic.`,
        evidence: [
          ...(failure ? [`Kubernetes reported: ${eventMessage(failure)}`] : []),
          probe ? `${startup ? "Startup" : "Readiness"} check: ${probe}` : "No matching health check is defined on the container",
          `Restarted ${cs.restartCount ?? 0} time${(cs.restartCount ?? 0) === 1 ? "" : "s"}`,
        ],
        remediation: [
          "Open the Logs tab and check whether the app is up and listening on the port the check uses.",
          probe
            ? "Make sure the check's path and port match what the app really serves."
            : "Check the pod's readiness gates and conditions; the container reports it isn't ready.",
          "If the app is just slow to start, raise initialDelaySeconds or add a startup probe.",
        ],
      };
    });
}

// ---------- Rule: image pull failures ----------

function classifyPullError(text) {
  if (/toomanyrequests|rate limit/i.test(text)) return "rateLimit";
  if (/pull access denied|repository does not exist or may require/i.test(text)) return "accessOrMissing";
  if (/unauthorized|authentication required|incorrect username or password|forbidden|\b40[13]\b|denied/i.test(text)) return "auth";
  if (/not found|manifest unknown|no such image|does not exist/i.test(text)) return "notFound";
  if (/no such host|timeout|timed out|connection refused|network is unreachable|temporary failure|dial tcp|tls handshake/i.test(text)) return "network";
  return "unknown";
}

const PULL_TEXT = {
  notFound: {
    cause: (image) => `The image "${image}" doesn't exist, or its tag is wrong.`,
    fix: ["Check the image name and tag for typos.", "Make sure that tag was actually pushed to the registry."],
  },
  auth: {
    cause: (image) => `The registry refused to let Kubernetes download "${image}".`,
    fix: [
      "If the registry is private, create an image pull secret and list it under imagePullSecrets on the pod.",
      "If you already use one, check that its credentials haven't expired.",
    ],
  },
  accessOrMissing: {
    cause: (image) => `Kubernetes can't download "${image}". Either the image name is wrong or the registry needs a login.`,
    fix: [
      "Check the image name and tag for typos.",
      "If the registry is private, create an image pull secret and list it under imagePullSecrets on the pod.",
    ],
  },
  network: {
    cause: (image) => `Kubernetes can't reach the registry to download "${image}".`,
    fix: [
      "Check that the node can reach the registry (network, DNS, proxy or firewall).",
      "If it was a brief outage, Kubernetes retries automatically.",
    ],
  },
  rateLimit: {
    cause: (image) => `The registry is limiting how often "${image}" can be downloaded.`,
    fix: ["Use an image pull secret with a registry account to get a higher limit, or mirror the image to your own registry."],
  },
  unknown: {
    cause: (image) => `Kubernetes couldn't download the image "${image}".`,
    fix: ["Read the technical details for the registry's exact error.", "Try pulling the image by hand from a machine that can reach the registry."],
  },
};

function imagePullDiagnoses(pod, events) {
  const pullEvents = events.filter((e) => e?.type === "Warning" && /pull/i.test(eventMessage(e)));
  return allContainerStatuses(pod)
    .filter(({ cs }) => isImagePullFailure(cs))
    .map(({ cs, isInit }) => {
      const image = containerSpec(pod, cs.name)?.image ?? cs.image ?? "the image";
      const messages = [cs.state?.waiting?.message, ...pullEvents.map(eventMessage)].filter(Boolean);
      const kind = classifyPullError(messages.join(" "));
      const where = isInit ? `"${cs.name}" startup step (an init container)` : `"${cs.name}" container`;
      const latest = latestEvent(pullEvents, () => true);
      return {
        id: `imagepull:${isInit ? "init:" : ""}${cs.name}`,
        issue: "Can't download the container image",
        technicalName: waitingReason(cs),
        severity: "Critical",
        rootCause: `The ${where} can't start. ${PULL_TEXT[kind].cause(image)}`,
        evidence: [
          `Container state: ${waitingReason(cs)}`,
          `Image: ${image}`,
          ...(latest ? [`Kubernetes reported: ${eventMessage(latest)}`] : cs.state?.waiting?.message ? [`Kubernetes reported: ${cs.state.waiting.message}`] : []),
        ],
        remediation: PULL_TEXT[kind].fix,
      };
    });
}

// ---------- Rule: containers that can't be created ----------

const START_ERROR_HINTS = [
  [/runAsNonRoot/i, "Set runAsUser to a non-root user ID in the pod's securityContext, or use an image built to run as non-root."],
  [/executable file not found|no such file or directory|exec format error|permission denied/i, "Check the container's command and args. The program must exist in the image and match the node's CPU architecture."],
  [/invalid reference format|InvalidImageName/i, "The image name isn't valid. Use a valid registry/repository:tag with lowercase letters and no spaces."],
];

function startErrorDiagnoses(pod) {
  return allContainerStatuses(pod)
    .filter(({ cs }) => isStartError(cs))
    .map(({ cs, isInit }) => {
      const reason = waitingReason(cs);
      const message = cs.state?.waiting?.message ?? "";
      const hit = matchConfigMessage(message, pod);
      if (hit) {
        return crashDiagnosis(pod, {
          kind: "config",
          isInit,
          container: cs.name,
          restarts: cs.restartCount ?? 0,
          technicalName: reason,
          config: { ...hit, source: "container status", evidenceText: message },
        });
      }
      const where = isInit ? `"${cs.name}" startup step (an init container)` : `"${cs.name}" container`;
      const hints = START_ERROR_HINTS.filter(([re]) => re.test(`${reason} ${message}`)).map(([, text]) => text);
      return {
        id: `starterror:${isInit ? "init:" : ""}${cs.name}`,
        issue: "Container can't start",
        technicalName: reason,
        severity: "Critical",
        rootCause: `Kubernetes couldn't create the ${where}${message ? `: ${message}` : "."}`,
        evidence: [`Container state: ${reason}`, ...(message ? [`Kubernetes reported: ${message}`] : [])],
        remediation: [...hints, "Run kubectl describe pod on this pod and read the Events section for the full error."],
      };
    });
}

// ---------- Rule: scheduled but stuck starting ----------

const STARTUP_EVENT_REASONS = ["FailedMount", "FailedAttachVolume", "FailedMapVolume", "FailedCreatePodSandBox", "NetworkNotReady"];

function stuckStartingDiagnosis(pod, events, now) {
  if (pod?.status?.phase !== "Pending" || !pod?.spec?.nodeName || !isStuckPending(pod, now)) return null;
  if (allContainerStatuses(pod).some(({ cs }) => isImagePullFailure(cs) || isStartError(cs))) return null;

  const event = latestEvent(events, (e) => e?.type === "Warning" && STARTUP_EVENT_REASONS.includes(e.reason));
  const message = event ? eventMessage(event) : null;
  const base = { id: "starting:stuck", technicalName: "ContainerCreating", severity: "Critical" };

  if (event && ["FailedMount", "FailedAttachVolume", "FailedMapVolume"].includes(event.reason)) {
    const hit = matchConfigMessage(message, pod);
    if (hit && hit.problem !== "unknown") {
      return {
        ...base,
        issue: "Waiting for missing configuration",
        rootCause: `The pod mounts ${hit.kind} "${hit.name}" as a volume, but ${hit.key ? `it has no "${hit.key}" entry` : "it doesn't exist"}.`,
        evidence: [`Kubernetes reported: ${message}`],
        remediation: [
          hit.key ? `Add "${hit.key}" to ${hit.kind} "${hit.name}", or` : `Create ${hit.kind} "${hit.name}", or`,
          "Fix the name the pod refers to.",
        ],
      };
    }
    return {
      ...base,
      issue: "Can't attach its storage",
      rootCause: `The pod is scheduled, but a volume it needs can't be mounted: ${message}`,
      evidence: [`Kubernetes reported: ${message}`],
      remediation: [
        "Check that every volume the pod uses exists. For persistent volumes, open the claim under Storage and make sure it is Bound.",
        "If the volume is on another machine or zone, check that the pod and the volume can be placed together.",
      ],
    };
  }

  if (event) {
    return {
      ...base,
      issue: "Can't set up the pod's network",
      rootCause: `Kubernetes couldn't finish setting up this pod on its machine: ${message}`,
      evidence: [`Kubernetes reported: ${message}`],
      remediation: [
        "Check the machine's health under Cluster → Nodes.",
        "Check that the cluster's network plugin (CNI) pods are running, usually in the kube-system namespace.",
      ],
    };
  }

  return {
    ...base,
    severity: "Warning",
    issue: "Stuck starting up",
    rootCause: "This pod was placed on a machine more than 5 minutes ago, but its containers still haven't started, and there's no event explaining why.",
    evidence: [`Placed on machine: ${pod.spec.nodeName}`, "No warning events found (Kubernetes only keeps them for about an hour)"],
    remediation: [`Run: kubectl describe pod ${pod?.metadata?.name} -n ${pod?.metadata?.namespace} and read the Events section.`],
  };
}

// ---------- Rule: failed and evicted pods ----------

function failedPodDiagnosis(pod) {
  if (pod?.status?.phase !== "Failed") return null;
  const reason = pod?.status?.reason;
  const message = pod?.status?.message;

  if (reason === "Evicted") {
    const resource = message?.match(/low on resource: ([\w-]+)/i)?.[1];
    return {
      id: "failed:evicted",
      issue: "Pod was removed from its machine",
      technicalName: "Evicted",
      severity: "Warning",
      rootCause: resource
        ? `The machine ran low on ${resource}, so Kubernetes evicted (removed) this pod to protect the machine.`
        : "Kubernetes evicted (removed) this pod from its machine to protect the machine.",
      evidence: [...(message ? [`Kubernetes reported: ${message}`] : []), ...(pod?.spec?.nodeName ? [`Machine: ${pod.spec.nodeName}`] : [])],
      remediation: [
        "Check how busy the machine is under Cluster → Nodes.",
        "Set resource requests and limits on the containers so pods are placed where they fit.",
        `Evicted pods stay listed until deleted. Delete this one (kubectl delete pod ${pod?.metadata?.name} -n ${pod?.metadata?.namespace}) if a replacement is already running.`,
      ],
    };
  }

  const failedContainer = allContainerStatuses(pod).find(({ cs }) => (lastTermination(cs)?.exitCode ?? 0) !== 0);
  const term = failedContainer ? lastTermination(failedContainer.cs) : null;
  return {
    id: "failed:pod",
    issue: "Pod failed",
    technicalName: reason ?? "Failed",
    severity: "Critical",
    rootCause: term
      ? `The "${failedContainer.cs.name}" container stopped with an error (exit code ${term.exitCode}) and Kubernetes won't restart it.`
      : `The pod ended in a failed state${reason ? ` (${reason})` : ""} and won't run again.`,
    evidence: [
      ...(term ? [`Last stop: exit code ${term.exitCode}${term.reason ? ` (${term.reason})` : ""}`] : []),
      ...(message ? [`Kubernetes reported: ${message}`] : []),
    ],
    remediation: [
      "Open the Logs tab and read the container's output to see why it failed.",
      "Fix the cause, then let the owning workload create a replacement (or re-run the Job).",
    ],
  };
}

// ---------- Rule 2: Pending scheduling mismatch ----------

const describeExpression = (e) => `${e.key} ${e.operator}${e.values?.length ? ` [${e.values.join(", ")}]` : ""}`;
const nodeFieldLabels = (node) => ({ "metadata.name": node?.metadata?.name });

function termSatisfied(node, term) {
  return (
    (term.matchExpressions ?? []).every((e) => matchExpression(node?.metadata?.labels, e)) &&
    (term.matchFields ?? []).every((e) => matchExpression(nodeFieldLabels(node), e))
  );
}

function tolerates(tolerations, taint) {
  return tolerations.some((t) => {
    if (t.effect && t.effect !== taint.effect) return false;
    if (t.operator === "Exists") return !t.key || t.key === taint.key;
    return t.key === taint.key && (t.value ?? "") === (taint.value ?? "");
  });
}

const taintSignature = (t) => `${t.key}${t.value ? `=${t.value}` : ""}:${t.effect}`;

function latestFailedScheduling(events) {
  return events
    .filter((e) => e?.reason === "FailedScheduling")
    .sort((a, b) => new Date(eventTime(b) ?? 0) - new Date(eventTime(a) ?? 0))[0];
}

function podConstraintSummary(pod) {
  const lines = [];
  const sel = pod?.spec?.nodeSelector ?? {};
  for (const [k, v] of Object.entries(sel)) lines.push(`The pod asks for a machine labeled ${k}=${v}`);
  if (pod?.spec?.affinity?.nodeAffinity?.requiredDuringSchedulingIgnoredDuringExecution) {
    lines.push("The pod has required placement rules (node affinity)");
  }
  const tolerations = pod?.spec?.tolerations ?? [];
  if (tolerations.length) lines.push(`The pod is allowed onto ${tolerations.length} kind(s) of reserved machine (tolerations)`);
  return lines;
}

function diagnosePending(pod, events, nodes, nodesError, now) {
  if (pod?.status?.phase !== "Pending" || pod?.spec?.nodeName || !isStuckPending(pod, now)) return null;

  const podName = pod?.metadata?.name ?? "<pod>";
  const podNs = pod?.metadata?.namespace ?? "<namespace>";
  const schedEvent = latestFailedScheduling(events);
  const schedMessage = schedEvent ? eventMessage(schedEvent) : null;
  const eventEvidence = schedMessage ? [`Kubernetes scheduler said: ${schedMessage}`] : [];
  const base = { id: "pending:scheduling", issue: "Can't find a machine to run on", technicalName: "Pending" };

  if (nodesError || !Array.isArray(nodes) || nodes.length === 0) {
    return {
      ...base,
      severity: "Warning",
      rootCause: schedMessage
        ? `Kubernetes hasn't been able to start this pod. Its scheduler says: "${schedMessage}"`
        : "This pod has been waiting to start for over 5 minutes, and there is no scheduler message to explain why.",
      evidence: [
        "Couldn't check the cluster's machines against live data. This connection isn't allowed to list them.",
        ...podConstraintSummary(pod),
        ...eventEvidence,
      ],
      remediation: [
        `Run: kubectl describe pod ${podName} -n ${podNs} and read the Events section at the bottom.`,
        "For a full explanation here, allow this connection to list nodes.",
      ],
    };
  }

  const total = nodes.length;
  const tolerations = pod?.spec?.tolerations ?? [];
  const failing = [];
  const info = [];

  // nodeSelector
  for (const [k, v] of Object.entries(pod?.spec?.nodeSelector ?? {})) {
    const matching = nodes.filter((n) => n?.metadata?.labels?.[k] === v).length;
    info.push(`Machines labeled ${k}=${v}: ${matching} of ${total}`);
    if (matching < total) {
      failing.push({
        summary: `${matching} of ${total} machines have the label ${k}=${v} that the pod asks for`,
        remediation: [
          `Add the label to a machine: kubectl label node <node-name> ${k}=${v}, or`,
          `Remove the "${k}: ${v}" requirement from the pod.`,
        ],
      });
    }
  }

  // required nodeAffinity (terms are ORed, expressions within a term are ANDed)
  const terms =
    pod?.spec?.affinity?.nodeAffinity?.requiredDuringSchedulingIgnoredDuringExecution?.nodeSelectorTerms ?? [];
  terms.forEach((term, i) => {
    const rule = terms.length > 1 ? `placement rule (option ${i + 1})` : "placement rule";
    for (const e of term.matchExpressions ?? []) {
      const matching = nodes.filter((n) => matchExpression(n?.metadata?.labels, e)).length;
      info.push(`Pod's ${rule} "${describeExpression(e)}": ${matching} of ${total} machines match`);
      if (matching < total) {
        failing.push({
          summary: `${matching} of ${total} machines match the pod's ${rule} "${describeExpression(e)}"`,
          remediation: [
            `Label a machine so it satisfies "${describeExpression(e)}", or`,
            "Loosen the pod's required placement rule (node affinity).",
          ],
        });
      }
    }
    for (const e of term.matchFields ?? []) {
      const matching = nodes.filter((n) => matchExpression(nodeFieldLabels(n), e)).length;
      info.push(`Pod's ${rule} on ${describeExpression(e)}: ${matching} of ${total} machines match`);
    }
  });
  const affinityOk = (n) => terms.length === 0 || terms.some((t) => termSatisfied(n, t));

  // taints without a matching toleration
  const taintCounts = new Map();
  for (const n of nodes) {
    for (const t of n?.spec?.taints ?? []) {
      if (!HARD_TAINT_EFFECTS.has(t.effect) || tolerates(tolerations, t)) continue;
      const sig = taintSignature(t);
      taintCounts.set(sig, { taint: t, count: (taintCounts.get(sig)?.count ?? 0) + 1 });
    }
  }
  for (const [sig, { taint, count }] of taintCounts) {
    info.push(`Machines reserved with taint ${sig}: ${count} of ${total} (the pod has no matching toleration)`);
    failing.push({
      summary: `${count} of ${total} machines are reserved for other workloads (taint ${sig}) and the pod isn't allowed to run there`,
      remediation: [
        `Let the pod run there by adding a toleration for ${taintSignature(taint)}, or`,
        `Remove or change the reservation: kubectl taint nodes <node-name> ${taint.key}${taint.value ? `=${taint.value}` : ""}:${taint.effect}-`,
      ],
    });
  }

  const eligible = nodes.filter((n) => {
    const labels = n?.metadata?.labels ?? {};
    const selectorOk = Object.entries(pod?.spec?.nodeSelector ?? {}).every(([k, v]) => labels[k] === v);
    const taintsOk = (n?.spec?.taints ?? []).every(
      (t) => !HARD_TAINT_EFFECTS.has(t.effect) || tolerates(tolerations, t),
    );
    return selectorOk && affinityOk(n) && taintsOk;
  }).length;

  if (eligible === 0 && failing.length > 0) {
    return {
      ...base,
      severity: "Critical",
      rootCause: `None of the ${total} machines in the cluster can run this pod: ${failing
        .map((f) => f.summary)
        .join("; ")}.`,
      evidence: [...info, ...eventEvidence],
      remediation: failing.flatMap((f) => f.remediation),
    };
  }

  return {
    ...base,
    severity: "Warning",
    rootCause: schedMessage
      ? `Kubernetes hasn't been able to start this pod. Its scheduler says: "${schedMessage}"`
      : "This pod has been waiting for over 5 minutes. Its label and reservation rules don't rule out every machine, and there's no scheduler message to explain the delay.",
    evidence: [
      `${eligible} of ${total} machines pass the pod's label and reservation rules`,
      ...info,
      ...eventEvidence,
    ],
    remediation: [
      "Labels and reservations aren't what's blocking this pod. Check whether machines have enough free CPU and memory, whether the pod's storage (PVC) is ready, and the Events tab.",
      `Run: kubectl describe pod ${podName} -n ${podNs}`,
    ],
  };
}

// ---------- Owners: workloads that can't create or roll out pods ----------

function createFailureDiagnosis(message, owner) {
  const base = { id: "create:failed", severity: "Critical", evidence: [`Kubernetes reported: ${message}`] };

  const quota = message.match(/exceeded quota: ([\w.-]+)/i);
  if (quota) {
    return {
      ...base,
      issue: "Can't create pods: quota is full",
      technicalName: "ReplicaFailure",
      rootCause: `The namespace's resource quota "${quota[1]}" has no room left, so Kubernetes can't create the pods this ${owner} needs.`,
      remediation: [
        "Raise the quota (Configuration → Resource Quotas), or",
        "Free up room by scaling down or deleting workloads you don't need, or lower this workload's CPU and memory requests.",
      ],
    };
  }
  if (/violates PodSecurity/i.test(message)) {
    const level = message.match(/violates PodSecurity "([^"]+)"/i)?.[1];
    return {
      ...base,
      issue: "Blocked by the namespace's pod security rules",
      technicalName: "ReplicaFailure",
      rootCause: `The namespace enforces a pod security level${level ? ` ("${level}")` : ""} that this ${owner}'s pods don't meet.`,
      remediation: [
        "Adjust the pod's securityContext to meet the rule (the message above lists what to change), or",
        "Relax the namespace's pod-security.kubernetes.io/enforce label if the workload really needs the extra access.",
      ],
    };
  }
  if (/maximum .* usage per|minimum .* usage per|limit .* ratio/i.test(message)) {
    return {
      ...base,
      issue: "Pods don't fit the namespace's size limits",
      technicalName: "ReplicaFailure",
      rootCause: `A LimitRange in the namespace rejects the pods this ${owner} tries to create because their CPU or memory settings are outside its allowed range.`,
      remediation: ["Change the container's requests and limits to fit within the allowed range (Configuration → Limit Ranges), or adjust the LimitRange."],
    };
  }
  if (/service ?account .* not found|error looking up service account/i.test(message)) {
    return {
      ...base,
      issue: "Service account is missing",
      technicalName: "ReplicaFailure",
      rootCause: `The pods this ${owner} creates use a service account that doesn't exist.`,
      remediation: ["Create the service account in this namespace, or change serviceAccountName on the pod template."],
    };
  }
  if (/admission webhook|denied the request/i.test(message)) {
    return {
      ...base,
      issue: "Rejected by an admission rule",
      technicalName: "ReplicaFailure",
      rootCause: `An admission webhook or policy in the cluster is rejecting the pods this ${owner} tries to create.`,
      remediation: ["Read the message above for which rule rejected it, then change the pod template to comply (or ask the policy's owner)."],
    };
  }
  return {
    ...base,
    issue: "Can't create pods",
    technicalName: "ReplicaFailure",
    rootCause: `Kubernetes tried to create pods for this ${owner} and was refused.`,
    remediation: ["Read the message above for the reason, fix the pod template or the namespace setting it points at, and Kubernetes retries automatically."],
  };
}

const OWNER_LABEL = {
  deployment: "Deployment",
  replicaset: "ReplicaSet",
  replicationcontroller: "Replication Controller",
  statefulset: "StatefulSet",
  daemonset: "DaemonSet",
  job: "Job",
};

function ownerObject(resourceType, data) {
  switch (resourceType) {
    case "deployment": return data?.deployment;
    case "replicaset": return data?.replicaSet;
    case "replicationcontroller": return data?.replicationController;
    case "statefulset": return data?.statefulSet;
    case "daemonset": return data?.daemonSet;
    case "job": return data?.job;
    default: return null;
  }
}

function ownerDiagnoses(resourceType, data) {
  const owner = ownerObject(resourceType, data);
  if (!owner) return [];
  const label = OWNER_LABEL[resourceType];
  const out = [];

  const replicaFailure = condition(owner, "ReplicaFailure");
  const createEvent = latestEvent(data?.events ?? [], (e) => e?.type === "Warning" && ["FailedCreate", "FailedDaemonPod"].includes(e.reason));
  const failureMessage =
    replicaFailure?.status === "True" ? (replicaFailure.message ?? "") : createEvent ? eventMessage(createEvent) : null;
  if (failureMessage !== null) out.push(createFailureDiagnosis(failureMessage, label));

  if (resourceType === "deployment") {
    const progressing = condition(owner, "Progressing");
    if (progressing?.status === "False" && progressing.reason === "ProgressDeadlineExceeded") {
      const s = owner.status ?? {};
      const deadline = owner.spec?.progressDeadlineSeconds ?? 600;
      out.push({
        id: "rollout:stuck",
        issue: "Update is stuck",
        technicalName: "ProgressDeadlineExceeded",
        severity: "Critical",
        rootCause: `The rollout didn't finish within its ${deadline}-second deadline, so Kubernetes stopped waiting for it.`,
        evidence: [
          ...(progressing.message ? [`Kubernetes reported: ${progressing.message}`] : []),
          `Pods: ${s.readyReplicas ?? 0} ready, ${s.updatedReplicas ?? 0} updated, ${owner.spec?.replicas ?? 0} wanted`,
        ],
        remediation: [
          "Look at the pods listed below or in the Overview tab and open their diagnostics to see why new pods aren't becoming ready.",
          `To go back to the last working version: kubectl rollout undo deployment/${owner.metadata?.name} -n ${owner.metadata?.namespace}`,
          "Once the cause is fixed, the rollout continues on its own.",
        ],
      });
    }
  }

  if (resourceType === "job") {
    const failed = condition(owner, "Failed");
    if (failed?.status === "True") {
      const attempts = owner.status?.failed ?? 0;
      const byDeadline = failed.reason === "DeadlineExceeded";
      out.push({
        id: "job:failed",
        issue: byDeadline ? "Job ran too long" : "Job gave up after repeated failures",
        technicalName: failed.reason,
        severity: "Critical",
        rootCause: byDeadline
          ? `The Job passed its time limit (${owner.spec?.activeDeadlineSeconds ?? "?"} seconds) before finishing, so Kubernetes stopped it.`
          : `The Job's pods failed ${attempts} time${attempts === 1 ? "" : "s"}, which used up its retry limit${owner.spec?.backoffLimit !== undefined ? ` (${owner.spec.backoffLimit})` : ""}.`,
        evidence: [
          ...(failed.message ? [`Kubernetes reported: ${failed.message}`] : []),
          `Failed attempts: ${attempts}, succeeded: ${owner.status?.succeeded ?? 0}`,
        ],
        remediation: [
          "Open one of the failed pods and read its logs to see why it failed.",
          "Jobs can't be edited once created. Fix the cause, then delete this Job and create it again.",
          ...(byDeadline ? ["If the work legitimately takes longer, raise activeDeadlineSeconds."] : []),
        ],
      });
    }
  }
  return out;
}

const jobFailed = (job) => condition(job, "Failed")?.status === "True";

function diagnoseCronJob(data) {
  const cron = data?.cronJob;
  if (!cron) return [];
  const out = [];

  if (cron.spec?.suspend === true) {
    out.push({
      id: "cron:suspended",
      issue: "Paused, so it won't run",
      technicalName: "suspend",
      severity: "Warning",
      rootCause: "This CronJob is suspended. Kubernetes skips its schedule until it is resumed.",
      evidence: ["spec.suspend is true", ...(cron.status?.lastScheduleTime ? [`Last ran: ${cron.status.lastScheduleTime}`] : [])],
      remediation: [`To resume it: kubectl patch cronjob ${cron.metadata?.name} -n ${cron.metadata?.namespace} -p '{"spec":{"suspend":false}}'`],
    });
  }

  const recent = [...(data?.jobs ?? [])]
    .sort((a, b) => new Date(b?.metadata?.creationTimestamp ?? 0) - new Date(a?.metadata?.creationTimestamp ?? 0))
    .slice(0, 3);
  const failedJobs = recent.filter(jobFailed);
  if (failedJobs.length > 0) {
    const latestFailed = jobFailed(recent[0]);
    out.push({
      id: "cron:failing",
      issue: latestFailed ? "The latest run failed" : "Some recent runs failed",
      technicalName: condition(failedJobs[0], "Failed")?.reason,
      severity: latestFailed ? "Critical" : "Warning",
      rootCause: latestFailed
        ? `The most recent run (${recent[0].metadata?.name}) failed. ${failedJobs.length} of the last ${recent.length} runs failed.`
        : `${failedJobs.length} of the last ${recent.length} runs failed, though the latest one succeeded.`,
      evidence: failedJobs.map((j) => {
        const c = condition(j, "Failed");
        return `${j.metadata?.name}: failed${c?.reason ? ` (${c.reason})` : ""}${c?.message ? `, ${c.message}` : ""}`;
      }),
      remediation: [
        `Open the failed run under Workloads → Jobs (${failedJobs[0].metadata?.name}) and check its pods' logs and diagnostics.`,
        "Fix the cause; the next scheduled run picks it up automatically.",
      ],
    });
  }
  return out;
}

// ---------- Entry point ----------

function diagnosePod(pod, { events, nodes, nodesError, now }) {
  const out = [
    ...classifyCrashLoop(pod, events).map((f) => crashDiagnosis(pod, { ...f, events })),
    ...imagePullDiagnoses(pod, events),
    ...startErrorDiagnoses(pod),
    ...notReadyDiagnoses(pod, events, now),
  ];
  for (const extra of [
    diagnosePending(pod, events, nodes, nodesError, now),
    stuckStartingDiagnosis(pod, events, now),
    failedPodDiagnosis(pod),
  ]) {
    if (extra) out.push(extra);
  }
  return out;
}

function mergeByCause(entries) {
  const merged = new Map();
  for (const { podName, diagnosis } of entries) {
    const key = `${diagnosis.id}|${diagnosis.rootCause}`;
    const existing = merged.get(key);
    if (existing) existing.pods.push(podName);
    else merged.set(key, { ...diagnosis, pods: [podName] });
  }
  return [...merged.values()];
}

const severityRank = { Critical: 0, Warning: 1 };

// Non-workload resources: one rule function per detail-route type.
const DOMAIN_RULES = {
  resourcequota: diagnoseResourceQuota,
  limitrange: diagnoseLimitRange,
  configmap: diagnoseConfigMap,
  secret: diagnoseSecret,
  service: diagnoseService,
  endpoints: diagnoseEndpoints,
  ingress: diagnoseIngress,
  ingressclass: diagnoseIngressClass,
  networkpolicy: diagnoseNetworkPolicy,
  pvc: diagnosePvc,
  pv: diagnosePv,
  storageclass: diagnoseStorageClass,
  role: diagnoseRole,
  clusterrole: diagnoseClusterRole,
  rolebinding: diagnoseRoleBinding,
  clusterrolebinding: diagnoseClusterRoleBinding,
  serviceaccount: diagnoseServiceAccount,
  node: diagnoseNode,
  namespace: diagnoseNamespace,
  hpa: diagnoseHpa,
};

const POD_OWNER_TYPES = new Set(["deployment", "statefulset", "daemonset", "replicaset", "replicationcontroller", "job"]);

/**
 * @param {string} resourceType detail route type, e.g. "pod", "deployment", "service"
 * @param {object} data detail payload as returned by /api/k8s/detail
 * @returns {Diagnosis[]}
 */
export function diagnoseResource(resourceType, data, now = Date.now()) {
  const nodes = data?.nodes;
  const nodesError = Boolean(data?.nodesError);

  if (resourceType === "pod") {
    const pod = data?.pod ?? data;
    if (!pod?.metadata) return [];
    return diagnosePod(pod, { events: data?.events ?? [], nodes, nodesError, now });
  }

  if (POD_OWNER_TYPES.has(resourceType)) {
    const allEvents = [...(data?.podEvents ?? []), ...(data?.events ?? [])];
    const entries = [];
    for (const pod of data?.pods ?? []) {
      const podName = pod?.metadata?.name;
      const events = allEvents.filter((e) => eventTarget(e)?.name === podName);
      for (const diagnosis of diagnosePod(pod, { events, nodes, nodesError, now })) {
        entries.push({ podName, diagnosis });
      }
    }
    return [...ownerDiagnoses(resourceType, data), ...mergeByCause(entries)].sort(
      (a, b) => severityRank[a.severity] - severityRank[b.severity],
    );
  }

  if (resourceType === "cronjob") return diagnoseCronJob(data);

  const rules = DOMAIN_RULES[resourceType];
  return rules ? rules(data, now).sort((a, b) => severityRank[a.severity] - severityRank[b.severity]) : [];
}
