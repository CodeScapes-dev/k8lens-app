/**
 * Deterministic, read-only diagnostics for broken pods and pod-owning workloads.
 * Pure functions over already-fetched Kubernetes objects: no I/O of any kind.
 *
 * @typedef {Object} Diagnosis
 * @property {string} id
 * @property {string} issue
 * @property {"Critical"|"Warning"} severity
 * @property {string} rootCause
 * @property {string[]} evidence
 * @property {string[]} remediation
 * @property {string[]} [pods] affected pod names (workload views only)
 */

export const PENDING_THRESHOLD_MS = 5 * 60 * 1000;
const RECENT_POD_MS = 30 * 60 * 1000;
const CONFIG_EVENT_REASONS = new Set(["Failed", "FailedMount", "FailedCreatePodContainer"]);
const HARD_TAINT_EFFECTS = new Set(["NoSchedule", "NoExecute"]);
const SIGNALS = { 130: "SIGINT", 137: "SIGKILL", 139: "SIGSEGV", 143: "SIGTERM" };

const eventTime = (e) => e?.lastTimestamp || e?.eventTime || e?.metadata?.creationTimestamp;
const eventMessage = (e) => e?.message ?? e?.note ?? "";
const eventTarget = (e) => e?.involvedObject?.name ?? e?.regarding?.name;

// ---------- Shared detection helpers (also used by health-score / dashboard-aggregations) ----------

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
  const created = pod?.metadata?.creationTimestamp;
  return created ? now - new Date(created).getTime() : null;
}

export function isStuckPending(pod, now = Date.now()) {
  if (pod?.status?.phase !== "Pending") return false;
  const age = podAgeMs(pod, now);
  return age !== null && age > PENDING_THRESHOLD_MS;
}

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
  const where = f.isInit ? `init container "${f.container}"` : `container "${f.container}"`;
  const initNote = f.isInit
    ? [`This is an init container: fix it in spec.initContainers of the owning workload, not the main containers.`]
    : [];
  const restartLine = `Restart count: ${f.restarts}`;
  const ns = pod?.metadata?.namespace;
  const id = `crashloop:${f.kind}:${f.isInit ? "init:" : ""}${f.container}`;

  if (f.kind === "oom") {
    const limit = containerSpec(pod, f.container)?.resources?.limits?.memory;
    return {
      id,
      issue: "OOMKilled",
      severity: "Critical",
      rootCause: `${where} was killed for exceeding its memory limit${limit ? ` (${limit})` : ""}.`,
      evidence: [
        `Last termination: reason OOMKilled${f.exitCode !== undefined ? `, exit code ${f.exitCode}` : ""}`,
        restartLine,
        limit ? `Memory limit: ${limit}` : "No memory limit set on this container spec",
      ],
      remediation: [
        `Raise resources.limits.memory for ${where}, or`,
        "Investigate the memory growth (leak, unbounded cache, heap/runtime settings) if usage should not be this high.",
        ...initNote,
      ],
    };
  }

  if (f.kind === "config") {
    const c = f.config;
    const target = `${c.kind} "${c.name}"${ns ? ` in namespace "${ns}"` : ""}`;
    const rootCause =
      c.problem === "missingKey"
        ? `${where} needs key "${c.key}", which does not exist in ${target}.`
        : c.problem === "notFound"
          ? `${where} references ${target}, which could not be found.`
          : `${where} is failing on a problem involving ${target}.`;
    const remediation =
      c.problem === "missingKey"
        ? [
            `Add key "${c.key}" to ${c.kind} "${c.name}", or`,
            `Fix the pod spec reference so it names a key that exists.`,
          ]
        : c.problem === "notFound"
          ? [
              `Create ${c.kind} "${c.name}" in namespace "${ns ?? "the pod's namespace"}", or`,
              "Correct the name referenced in the pod spec.",
            ]
          : [`Verify ${c.kind} "${c.name}" exists and contains everything the pod spec references.`];
    return {
      id,
      issue: "CrashLoopBackOff",
      severity: "Critical",
      rootCause,
      evidence: [
        c.evidenceText ? `${c.source}: ${c.evidenceText}` : `Signal detected in ${c.source}`,
        `Referenced ${c.kind}: ${c.name}${c.key ? `, key: ${c.key}` : ""}`,
        restartLine,
      ],
      remediation: [...remediation, ...initNote],
    };
  }

  const haveTermination = f.exitCode !== undefined;
  const signal = SIGNALS[f.exitCode] ? ` (${SIGNALS[f.exitCode]})` : "";
  const rootCause = !haveTermination
    ? `${where} is in CrashLoopBackOff but no termination details have been reported yet.`
    : f.exitCode === 0
      ? `${where} exited with code 0 (a clean exit) yet keeps restarting. This is unusual.`
      : `${where} keeps exiting with code ${f.exitCode}${signal}${f.reason ? ` (${f.reason})` : ""}.`;
  return {
    id,
    issue: "CrashLoopBackOff",
    severity: "Critical",
    rootCause,
    evidence: [
      haveTermination
        ? `Last termination: exit code ${f.exitCode}${f.reason ? `, reason ${f.reason}` : ""}`
        : "No lastState.terminated reported",
      restartLine,
      "No ConfigMap/Secret-related warning found",
    ],
    remediation: [
      "Open the Logs tab and read the previous container's logs to see why the process exits.",
      f.exitCode === 0
        ? "Check whether the container command is meant to be long-running; a process that finishes immediately is restarted by the default restart policy."
        : "Check the container command/args and environment for this container.",
      ...initNote,
    ],
  };
}

// ---------- Rule 2: Pending scheduling mismatch ----------

function matchExpression(labels, expr) {
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
  for (const [k, v] of Object.entries(sel)) lines.push(`Pod nodeSelector: ${k}=${v}`);
  if (pod?.spec?.affinity?.nodeAffinity?.requiredDuringSchedulingIgnoredDuringExecution) {
    lines.push("Pod has required nodeAffinity terms");
  }
  const tolerations = pod?.spec?.tolerations ?? [];
  if (tolerations.length) lines.push(`Pod tolerations: ${tolerations.length}`);
  return lines;
}

function diagnosePending(pod, events, nodes, nodesError, now) {
  if (pod?.status?.phase !== "Pending" || pod?.spec?.nodeName || !isStuckPending(pod, now)) return null;

  const podName = pod?.metadata?.name ?? "<pod>";
  const podNs = pod?.metadata?.namespace ?? "<namespace>";
  const schedEvent = latestFailedScheduling(events);
  const schedMessage = schedEvent ? eventMessage(schedEvent) : null;
  const eventEvidence = schedMessage ? [`FailedScheduling event: ${schedMessage}`] : [];
  const base = { id: "pending:scheduling", issue: "Pod stuck in Pending" };

  if (nodesError || !Array.isArray(nodes) || nodes.length === 0) {
    return {
      ...base,
      severity: "Warning",
      rootCause: schedMessage
        ? `The scheduler has not placed this pod: "${schedMessage}"`
        : "The pod has been Pending for more than 5 minutes and no scheduler event is available.",
      evidence: [
        "Couldn't verify against live node state (the node list is unavailable to this connection).",
        ...podConstraintSummary(pod),
        ...eventEvidence,
      ],
      remediation: [
        `Run: kubectl describe pod ${podName} -n ${podNs} and read the Events section.`,
        "To enable node-level checks here, grant this connection permission to list nodes.",
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
    const line = `nodeSelector ${k}=${v}: matched ${matching} of ${total} nodes`;
    info.push(line);
    if (matching < total) {
      failing.push({
        summary: `nodeSelector ${k}=${v} matches ${matching} of ${total} nodes`,
        remediation: [
          `Label a node: kubectl label node <node-name> ${k}=${v}, or`,
          `Remove or relax "${k}: ${v}" from the pod's nodeSelector.`,
        ],
      });
    }
  }

  // required nodeAffinity (terms are ORed, expressions within a term are ANDed)
  const terms =
    pod?.spec?.affinity?.nodeAffinity?.requiredDuringSchedulingIgnoredDuringExecution?.nodeSelectorTerms ?? [];
  terms.forEach((term, i) => {
    const prefix = terms.length > 1 ? `nodeAffinity (term ${i + 1})` : "nodeAffinity";
    for (const e of term.matchExpressions ?? []) {
      const matching = nodes.filter((n) => matchExpression(n?.metadata?.labels, e)).length;
      info.push(`${prefix} ${describeExpression(e)}: matched ${matching} of ${total} nodes`);
      if (matching < total) {
        failing.push({
          summary: `${prefix} "${describeExpression(e)}" matches ${matching} of ${total} nodes`,
          remediation: [
            `Label a node so it satisfies "${describeExpression(e)}", or`,
            "Relax the required nodeAffinity term in the pod spec.",
          ],
        });
      }
    }
    for (const e of term.matchFields ?? []) {
      const matching = nodes.filter((n) => matchExpression(nodeFieldLabels(n), e)).length;
      info.push(`${prefix} field ${describeExpression(e)}: matched ${matching} of ${total} nodes`);
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
    info.push(`Taint ${sig}: ${count} of ${total} nodes excluded (no matching toleration)`);
    failing.push({
      summary: `${count} of ${total} nodes carry taint ${sig} with no matching toleration`,
      remediation: [
        `Add a toleration for ${taintSignature(taint)} to the pod spec, or`,
        `Remove or adjust the taint: kubectl taint nodes <node-name> ${taint.key}${taint.value ? `=${taint.value}` : ""}:${taint.effect}-`,
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
      rootCause: `No node satisfies this pod's scheduling constraints (0 of ${total} nodes eligible): ${failing
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
      ? `The scheduler reports: "${schedMessage}"`
      : "The pod has been Pending for more than 5 minutes. Its nodeSelector, affinity and tolerations do not rule out every node, and no scheduler event is available to explain the delay.",
    evidence: [
      `${eligible} of ${total} nodes pass the pod's label and taint constraints`,
      ...info,
      ...eventEvidence,
    ],
    remediation: [
      "Label/taint constraints are not what blocks this pod. Check node capacity (CPU/memory requests), volume binding (PVCs) and the Events tab.",
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
      const events = allEvents.filter((e) => eventTarget(e) === podName);
      for (const diagnosis of diagnosePod(pod, { events, nodes, nodesError, now })) {
        entries.push({ podName, diagnosis });
      }
    }
    return mergeByCause(entries).sort((a, b) => severityRank[a.severity] - severityRank[b.severity]);
  }

  return [];
}
