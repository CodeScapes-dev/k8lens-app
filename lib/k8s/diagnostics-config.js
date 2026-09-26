// Diagnostics for Configuration resources: ResourceQuota, LimitRange, ConfigMap, Secret.
// Only key NAMES are inspected, never ConfigMap or Secret values.
import { ageMs, parseQuantity, plural } from "./diagnostics-common.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const CONFIGMAP_SIZE_LIMIT = 1024 * 1024;
const ACTIVE_PHASES = new Set(["Running", "Pending", "Unknown", undefined]);

// ---------- ResourceQuota ----------

const QUOTA_NAMES = {
  pods: "pods",
  "requests.cpu": "CPU requests",
  "limits.cpu": "CPU limits",
  cpu: "CPU requests",
  "requests.memory": "memory requests",
  "limits.memory": "memory limits",
  memory: "memory requests",
  "requests.storage": "storage requests",
  persistentvolumeclaims: "volume claims",
  services: "services",
  "services.loadbalancers": "load balancers",
  "services.nodeports": "node ports",
  configmaps: "ConfigMaps",
  secrets: "secrets",
};

const quotaName = (key) => QUOTA_NAMES[key] ?? (key.startsWith("count/") ? key.slice(6) : key);
const joinList = (items) => (items.length <= 2 ? items.join(" and ") : `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`);

export function diagnoseResourceQuota(data) {
  const quota = data?.resourceQuota;
  if (!quota) return [];
  const hard = quota.status?.hard ?? quota.spec?.hard ?? {};
  const used = quota.status?.used ?? {};

  const rows = Object.entries(hard)
    .map(([key, hardValue]) => {
      const h = parseQuantity(hardValue);
      const u = parseQuantity(used[key]);
      return h && h > 0 && u !== null ? { key, hardValue, usedValue: used[key], ratio: u / h } : null;
    })
    .filter(Boolean);

  const full = rows.filter((r) => r.ratio >= 1);
  const near = rows.filter((r) => r.ratio >= 0.9 && r.ratio < 1);
  if (full.length === 0 && near.length === 0) return [];

  const line = (r) => `${r.key}: ${r.usedValue} of ${r.hardValue} used (${Math.round(r.ratio * 100)}%)`;
  const isFull = full.length > 0;
  const focus = isFull ? full : near;
  const names = joinList(focus.map((r) => quotaName(r.key)));
  return [
    {
      id: isFull ? "quota:full" : "quota:near",
      issue: isFull ? "Quota is full" : "Quota is almost full",
      technicalName: "ResourceQuota",
      severity: isFull ? "Critical" : "Warning",
      rootCause: isFull
        ? `This namespace has used up its allowance for ${names}. New pods or objects that need more of it will be rejected.`
        : `This namespace has used more than 90% of its allowance for ${names}. It will soon start rejecting new pods or objects.`,
      evidence: [...focus, ...rows.filter((r) => !focus.includes(r) && r.ratio >= 0.9)].map(line),
      remediation: [
        `Raise the limit: kubectl edit resourcequota ${quota.metadata?.name} -n ${quota.metadata?.namespace} (or ask your cluster admin).`,
        "Or free up room by scaling down or deleting workloads you no longer need, or lower CPU and memory requests.",
      ],
    },
  ];
}

// ---------- LimitRange ----------

export function diagnoseLimitRange(data) {
  const limitRange = data?.limitRange;
  if (!limitRange) return [];
  const containerLimits = (limitRange.spec?.limits ?? []).filter((l) => l.type === "Container");
  if (containerLimits.length === 0) return [];

  const violations = new Map();
  const add = (pod, text) => {
    if (!violations.has(pod)) violations.set(pod, []);
    violations.get(pod).push(text);
  };

  for (const pod of data?.pods ?? []) {
    if (!ACTIVE_PHASES.has(pod?.status?.phase)) continue;
    const podName = pod?.metadata?.name;
    for (const c of [...(pod?.spec?.initContainers ?? []), ...(pod?.spec?.containers ?? [])]) {
      for (const item of containerLimits) {
        for (const resource of ["cpu", "memory"]) {
          const max = parseQuantity(item.max?.[resource]);
          const min = parseQuantity(item.min?.[resource]);
          const limit = parseQuantity(c.resources?.limits?.[resource]);
          const request = parseQuantity(c.resources?.requests?.[resource]);
          if (max !== null && limit !== null && limit > max) add(podName, `${c.name}: ${resource} limit ${c.resources.limits[resource]} is above the maximum ${item.max[resource]}`);
          if (max !== null && request !== null && request > max) add(podName, `${c.name}: ${resource} request ${c.resources.requests[resource]} is above the maximum ${item.max[resource]}`);
          if (min !== null && request !== null && request < min) add(podName, `${c.name}: ${resource} request ${c.resources.requests[resource]} is below the minimum ${item.min[resource]}`);
        }
      }
    }
  }
  if (violations.size === 0) return [];

  const lines = [...violations].flatMap(([pod, texts]) => texts.map((t) => `${pod}: ${t}`));
  return [
    {
      id: "limitrange:violations",
      issue: "Some pods don't fit these limits",
      technicalName: "LimitRange",
      severity: "Warning",
      rootCause: `${plural(violations.size, "running pod")} ask for more or less CPU or memory than this LimitRange allows. They keep running, but Kubernetes will refuse to create replacements with the same settings.`,
      evidence: lines.slice(0, 10).concat(lines.length > 10 ? [`…and ${lines.length - 10} more`] : []),
      remediation: [
        "Change those pods' (or their workload's) requests and limits so they fall within the allowed range, or",
        "Adjust this LimitRange's min and max if the range is too tight.",
      ],
    },
  ];
}

// ---------- keys that pods ask for ----------

function missingKeyReferences(pods, kind, name, keys) {
  const refField = kind === "ConfigMap" ? "configMapKeyRef" : "secretKeyRef";
  const volumeName = (v) => (kind === "ConfigMap" ? v.configMap?.name : v.secret?.secretName);
  const refs = [];

  for (const pod of pods ?? []) {
    if (!ACTIVE_PHASES.has(pod?.status?.phase)) continue;
    const podName = pod?.metadata?.name;
    for (const c of [...(pod?.spec?.initContainers ?? []), ...(pod?.spec?.containers ?? [])]) {
      for (const env of c.env ?? []) {
        const ref = env.valueFrom?.[refField];
        if (ref?.name === name && !ref.optional && !keys.has(ref.key)) refs.push({ key: ref.key, where: `${podName}, container ${c.name} (environment variable ${env.name})` });
      }
    }
    for (const v of pod?.spec?.volumes ?? []) {
      const sources = [
        { name: volumeName(v), items: (kind === "ConfigMap" ? v.configMap : v.secret)?.items, optional: (kind === "ConfigMap" ? v.configMap : v.secret)?.optional },
        ...(v.projected?.sources ?? []).map((src) => {
          const s = kind === "ConfigMap" ? src.configMap : src.secret;
          return { name: s?.name, items: s?.items, optional: s?.optional };
        }),
      ];
      for (const src of sources) {
        if (src.name !== name || src.optional) continue;
        for (const item of src.items ?? []) {
          if (!keys.has(item.key)) refs.push({ key: item.key, where: `${podName}, volume ${v.name}` });
        }
      }
    }
  }
  return refs;
}

function missingKeysDiagnosis(kind, name, refs) {
  if (refs.length === 0) return null;
  const keys = [...new Set(refs.map((r) => r.key))];
  const podCount = new Set(refs.map((r) => r.where.split(",")[0])).size;
  const keyText = keys.length === 1 ? `the entry "${keys[0]}"` : `the entries ${joinList(keys.map((k) => `"${k}"`))}`;
  return {
    id: `${kind.toLowerCase()}:missing-keys`,
    issue: `Pods expect ${keys.length === 1 ? "a setting" : "settings"} this ${kind} doesn't have`,
    technicalName: "CreateContainerConfigError",
    severity: "Critical",
    rootCause: `${plural(podCount, "pod")} ask for ${keyText} from this ${kind}, but it isn't there, so those pods can't start.`,
    evidence: refs.slice(0, 10).map((r) => `"${r.key}" needed by ${r.where}`).concat(refs.length > 10 ? [`…and ${refs.length - 10} more`] : []),
    remediation: [
      `Add ${keys.length === 1 ? "the missing entry" : "the missing entries"} to this ${kind}, or`,
      `Change the pods (or their workload) to ask for entries that exist in ${kind} "${name}".`,
    ],
  };
}

// ---------- ConfigMap ----------

const utf8Length = (s) => new TextEncoder().encode(s ?? "").length;

export function diagnoseConfigMap(data) {
  const cm = data?.configMap;
  if (!cm) return [];
  const out = [];
  const plain = cm.data ?? {};
  const binary = cm.binaryData ?? {};
  const keys = new Set([...Object.keys(plain), ...Object.keys(binary)]);

  const missing = missingKeysDiagnosis("ConfigMap", cm.metadata?.name, missingKeyReferences(data?.pods, "ConfigMap", cm.metadata?.name, keys));
  if (missing) out.push(missing);

  if (keys.size === 0) {
    out.push({
      id: "configmap:empty",
      issue: "ConfigMap is empty",
      severity: "Warning",
      rootCause: "This ConfigMap has no entries, so anything that reads settings from it gets nothing.",
      evidence: ["No data or binaryData entries"],
      remediation: ["Add the settings your workloads expect, or delete this ConfigMap if it isn't needed."],
    });
  }

  const size =
    Object.entries(plain).reduce((sum, [k, v]) => sum + utf8Length(k) + utf8Length(v), 0) +
    Object.entries(binary).reduce((sum, [k, v]) => sum + utf8Length(k) + Math.floor((String(v ?? "").length * 3) / 4), 0);
  if (size > CONFIGMAP_SIZE_LIMIT * 0.9) {
    out.push({
      id: "configmap:size",
      issue: "Close to the size limit",
      severity: "Warning",
      rootCause: `This ConfigMap is about ${(size / 1024).toFixed(0)} KiB. Kubernetes rejects ConfigMaps larger than 1 MiB, so it can't grow much more.`,
      evidence: [`Approximate size: ${size} bytes of a 1,048,576 byte limit`],
      remediation: ["Split it into several ConfigMaps, or keep large files somewhere else, such as a volume or an object store."],
    });
  }
  return out;
}

// ---------- Secret ----------

const SECRET_REQUIRED_KEYS = {
  "kubernetes.io/tls": { all: ["tls.crt", "tls.key"] },
  "kubernetes.io/dockerconfigjson": { all: [".dockerconfigjson"] },
  "kubernetes.io/dockercfg": { all: [".dockercfg"] },
  "kubernetes.io/ssh-auth": { all: ["ssh-privatekey"] },
  "kubernetes.io/basic-auth": { any: ["username", "password"] },
};
const ROTATABLE_TYPES = new Set(["Opaque", "kubernetes.io/tls", "kubernetes.io/basic-auth", "kubernetes.io/ssh-auth", "kubernetes.io/dockerconfigjson"]);

export function diagnoseSecret(data, now = Date.now()) {
  const secret = data?.secret;
  if (!secret) return [];
  const out = [];
  const type = secret.type ?? "Opaque";
  const keys = new Set([...Object.keys(secret.data ?? {}), ...Object.keys(secret.stringData ?? {})]);

  const missing = missingKeysDiagnosis("Secret", secret.metadata?.name, missingKeyReferences(data?.pods, "Secret", secret.metadata?.name, keys));
  if (missing) out.push(missing);

  const required = SECRET_REQUIRED_KEYS[type];
  if (required) {
    const absent = required.all ? required.all.filter((k) => !keys.has(k)) : required.any.some((k) => keys.has(k)) ? [] : required.any;
    if (absent.length > 0) {
      out.push({
        id: "secret:type-keys",
        issue: "Secret is missing entries its type requires",
        technicalName: type,
        severity: "Critical",
        rootCause: `A ${type} Secret must contain ${required.all ? joinList(required.all.map((k) => `"${k}"`)) : `at least one of ${joinList(required.any.map((k) => `"${k}"`))}`}, but ${required.all ? `"${absent.join('", "')}" is` : "none of them are"} missing, so anything that uses it will fail.`,
        evidence: [`Type: ${type}`, `Entries present: ${keys.size === 0 ? "none" : [...keys].join(", ")}`],
        remediation: [`Recreate the Secret with the required ${required.all ? "entries" : "entry"}, or change its type if it's meant to hold something else.`],
      });
    }
  } else if (type === "Opaque" && keys.size === 0) {
    out.push({
      id: "secret:empty",
      issue: "Secret is empty",
      severity: "Warning",
      rootCause: "This Secret has no entries, so anything that reads from it gets nothing.",
      evidence: ["No data entries"],
      remediation: ["Add the values your workloads expect, or delete this Secret if it isn't needed."],
    });
  }

  const age = ageMs(secret, now);
  if (age !== null && age > 180 * DAY_MS && ROTATABLE_TYPES.has(type)) {
    out.push({
      id: "secret:stale",
      issue: "Not changed in over 180 days",
      severity: "Warning",
      rootCause: `This Secret was created ${Math.floor(age / DAY_MS)} days ago and hasn't been recreated since. Long-lived credentials are a security risk.`,
      evidence: [`Created: ${secret.metadata?.creationTimestamp}`],
      remediation: ["Rotate the credential it holds and update this Secret, ideally through an automated process."],
    });
  }
  return out;
}
