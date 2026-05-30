const DEFAULT_PRICING = {
  cpuPerCore: 0.04,
  memoryPerGB: 0.005,
};

export function parseMemoryToGB(mem) {
  if (!mem) return 0;
  const match = String(mem).match(/^([0-9.]+)([a-zA-Z]*)?$/);
  if (!match) return 0;
  const value = parseFloat(match[1]);
  const unit = match[2] || "";
  const multipliers = { Ki: 1 / (1024 * 1024), Mi: 1 / 1024, Gi: 1, Ti: 1024, K: 1 / 1e6, M: 1 / 1e3, G: 1, T: 1e3 };
  return value * (multipliers[unit] ?? 1 / (1024 * 1024 * 1024));
}

export function parseCPUToCores(cpu) {
  if (!cpu) return 0;
  const s = String(cpu);
  if (s.endsWith("m")) return parseFloat(s) / 1000;
  return parseFloat(s) || 0;
}

export function calculatePodMonthlyCost(pod, pricing = DEFAULT_PRICING) {
  let totalCpu = 0;
  let totalMemory = 0;
  (pod?.spec?.containers || []).forEach((c) => {
    const req = c?.resources?.requests || {};
    totalCpu += parseCPUToCores(req.cpu);
    totalMemory += parseMemoryToGB(req.memory);
  });
  const hourlyCost = totalCpu * pricing.cpuPerCore + totalMemory * pricing.memoryPerGB;
  return {
    cpu: totalCpu,
    memory: totalMemory,
    hourlyCost,
    monthlyCost: hourlyCost * 24 * 30,
    podName: pod?.metadata?.name || "unknown",
    namespace: pod?.metadata?.namespace || "unknown",
  };
}

export function calculateNamespaceCosts(pods = [], pricing = DEFAULT_PRICING) {
  const nsMap = {};
  pods.forEach((pod) => {
    const ns = pod?.metadata?.namespace || "unknown";
    if (!nsMap[ns]) nsMap[ns] = { namespace: ns, monthlyCost: 0, podCount: 0 };
    const { monthlyCost } = calculatePodMonthlyCost(pod, pricing);
    nsMap[ns].monthlyCost += monthlyCost;
    nsMap[ns].podCount++;
  });
  return Object.values(nsMap).sort((a, b) => b.monthlyCost - a.monthlyCost);
}

export function calculateClusterCost(pods = [], pricing = DEFAULT_PRICING) {
  return pods.reduce((sum, pod) => sum + calculatePodMonthlyCost(pod, pricing).monthlyCost, 0);
}

export function formatCurrency(amount) {
  if (amount >= 1000) return `$${(amount / 1000).toFixed(1)}k`;
  if (amount >= 1) return `$${amount.toFixed(2)}`;
  return `$${amount.toFixed(4)}`;
}
