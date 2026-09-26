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
  eventMessage,
  eventTarget,
  eventTime,
  isCrashLoopBackOff,
  isOomKilled,
  isStuckPending,
  matchExpression,
  podAgeMs,
  totalRestarts,
} from "./diagnostics-common.js";

// Shared detection helpers live in diagnostics-common.js; re-exported for existing callers.
export { PENDING_THRESHOLD_MS, isCrashLoopBackOff, isOomKilled, isStuckPending, podAgeMs, totalRestarts };

const RECENT_POD_MS = 30 * 60 * 1000;
const CONFIG_EVENT_REASONS = new Set(["Failed", "FailedMount", "FailedCreatePodContainer"]);
const HARD_TAINT_EFFECTS = new Set(["NoSchedule", "NoExecute"]);
const SIGNALS = { 130: "SIGINT", 137: "SIGKILL", 139: "SIGSEGV", 143: "SIGTERM" };

/**
 * Classifies every crash-looping container (init containers included).
 * @returns {Array<{container: string, isInit: boolean, kind: "oom"|"config"|"app", restarts: number,
 *   exitCode?: number, reason?: string, signal?: number, config?: object}>}
 */
export function classifyCrashLoop(pod, events = [], now = Date.now()) {
  const age = podAgeMs(pod, now);
  const findings = [];
  const groups = [
    [pod?.status?.containerStatuses ?? [], false],
    [pod?.status?.initContainerStatuses ?? [], true],
  ];

  for (const [statuses, isInit] of groups) {
    for (const cs of statuses) {
      const term = cs.lastState?.terminated ?? cs.state?.terminated;
      const restarts = cs.restartCount ?? 0;
      const flapping = restarts >= 3 && term && term.exitCode !== 0 && age !== null && age < RECENT_POD_MS;
      if (!isCrashLoopBackOff(cs) && !flapping) continue;

      const base = {
        container: cs.name,
        isInit,
        restarts,
        exitCode: term?.exitCode,
        reason: term?.reason,
        signal: term?.signal,
      };
      if (term?.reason === "OOMKilled") {
        findings.push({ ...base, kind: "oom" });
        continue;
      }
      const config = findConfigSignal(pod, events, term);
      findings.push(config ? { ...base, kind: "config", config } : { ...base, kind: "app" });
    }
  }
  return findings;
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
      technicalName: "CrashLoopBackOff",
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

// ---------- Entry point ----------

function diagnosePod(pod, { events, nodes, nodesError, now }) {
  const out = classifyCrashLoop(pod, events, now).map((f) => crashDiagnosis(pod, f));
  const pending = diagnosePending(pod, events, nodes, nodesError, now);
  if (pending) out.push(pending);
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

/**
 * @param {"pod"|"deployment"|"statefulset"|"daemonset"} resourceType
 * @param {object} data detail payload ({pod, events, nodes?} or {<workload>, pods, events, nodes?})
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

  if (resourceType === "deployment" || resourceType === "statefulset" || resourceType === "daemonset") {
    const allEvents = [...(data?.podEvents ?? []), ...(data?.events ?? [])];
    const entries = [];
    for (const pod of data?.pods ?? []) {
      const podName = pod?.metadata?.name;
      const events = allEvents.filter((e) => eventTarget(e)?.name === podName);
      for (const diagnosis of diagnosePod(pod, { events, nodes, nodesError, now })) {
        entries.push({ podName, diagnosis });
      }
    }
    return mergeByCause(entries).sort((a, b) => severityRank[a.severity] - severityRank[b.severity]);
  }

  return [];
}
