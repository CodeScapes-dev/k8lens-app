import { Metrics } from "@kubernetes/client-node";

export function createMetricsClient(kubeConfig) {
  return new Metrics(kubeConfig);
}

export async function detectMetricsServer(kubeConfig) {
  try {
    const metrics = createMetricsClient(kubeConfig);
    await metrics.getNodeMetrics();
    return { available: true };
  } catch (err) {
    const status = err?.response?.statusCode ?? err?.statusCode;
    if (status === 404 || status === 503) return { available: false };
    // Connection errors also mean unavailable
    if (err?.code === "ECONNREFUSED" || err?.code === "ENOTFOUND") return { available: false };
    // If it's a 401/403 the server exists but we lack permission — treat as available
    if (status === 401 || status === 403) return { available: true };
    return { available: false };
  }
}

// Parse CPU strings → millicores
// "250m" → 250, "2" → 2000, "196397628n" (nanocores) → ~196
export function parseCpu(cpuStr) {
  if (!cpuStr) return 0;
  if (cpuStr.endsWith("n")) return Math.round(parseInt(cpuStr, 10) / 1_000_000);
  if (cpuStr.endsWith("m")) return parseInt(cpuStr, 10);
  return Math.round(parseFloat(cpuStr) * 1000);
}

// Parse "512Mi" → bytes, "1Gi" → bytes, "500000k" → bytes, etc.
export function parseMemory(memStr) {
  if (!memStr) return 0;
  const units = { Ki: 1024, Mi: 1024 ** 2, Gi: 1024 ** 3, Ti: 1024 ** 4, k: 1000, M: 1000 ** 2, G: 1000 ** 3 };
  for (const [suffix, mult] of Object.entries(units)) {
    if (memStr.endsWith(suffix)) return Math.round(parseFloat(memStr) * mult);
  }
  return parseInt(memStr, 10);
}

export async function fetchAllNodeMetrics(kubeConfig) {
  const metrics = createMetricsClient(kubeConfig);
  const list = await metrics.getNodeMetrics();
  return list.items.map((item) => ({
    name: item.metadata.name,
    cpu: parseCpu(item.usage.cpu),
    memory: parseMemory(item.usage.memory),
    ts: Date.now(),
  }));
}

// Returns [{ name, namespace, containers: [{name, cpu, memory}], cpu, memory, ts }]
// namespace is optional; omit to fetch across all namespaces
export async function fetchAllPodMetrics(kubeConfig, namespace) {
  const metrics = createMetricsClient(kubeConfig);
  const list = namespace
    ? await metrics.getPodMetrics(namespace)
    : await metrics.getPodMetrics();
  return list.items.map((item) => {
    const containers = (item.containers ?? []).map((c) => ({
      name: c.name,
      cpu: parseCpu(c.usage?.cpu),
      memory: parseMemory(c.usage?.memory),
    }));
    return {
      name: item.metadata.name,
      namespace: item.metadata.namespace,
      containers,
      cpu: containers.reduce((s, c) => s + c.cpu, 0),
      memory: containers.reduce((s, c) => s + c.memory, 0),
      ts: Date.now(),
    };
  });
}
