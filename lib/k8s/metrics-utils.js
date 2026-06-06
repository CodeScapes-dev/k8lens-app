// CPU display: always cores
export function fmtCores(m) {
  if (m == null) return "—";
  const c = m / 1000;
  if (c >= 1) return `${c.toFixed(1)} cores`;
  if (c >= 0.1) return `${c.toFixed(2)} cores`;
  return `${c.toFixed(3)} cores`;
}

// CPU display (from nanocores) → always cores
export function fmtNano(n) {
  if (n == null) return "—";
  return fmtCores(Math.round(n / 1_000_000));
}

// CPU display (from millicores) → always cores
export function fmtMilli(m) {
  if (m == null) return "—";
  return fmtCores(m);
}

// CPU hover: millicores string
export function fmtMilliStr(m) {
  if (m == null) return "—";
  return `${Math.round(m)}m`;
}

// CPU hover from nanocores
export function fmtNanoStr(n) {
  if (n == null) return "—";
  return `${Math.round(n / 1_000_000)}m`;
}

// Memory/Storage display: always GB
export function fmtGB(b) {
  if (b == null) return "—";
  const gb = b / 1024 ** 3;
  if (gb >= 10) return `${gb.toFixed(0)} GB`;
  if (gb >= 1) return `${gb.toFixed(1)} GB`;
  return `${gb.toFixed(2)} GB`;
}

// Memory/Storage hover: MB
export function fmtMB(b) {
  if (b == null) return "—";
  return `${Math.round(b / 1024 ** 2)} MB`;
}

// Legacy alias — prefer fmtGB
export function fmtBytes(b) {
  return fmtGB(b);
}

// Parse Kubernetes allocatable CPU string → millicores
export function parseAllocCpu(s) {
  if (!s) return null;
  if (s.endsWith("m")) return parseInt(s, 10);
  return Math.round(parseFloat(s) * 1000);
}

// Parse Kubernetes allocatable memory string → bytes
export function parseAllocMem(s) {
  if (!s) return null;
  const units = { Ki: 1024, Mi: 1024 ** 2, Gi: 1024 ** 3, Ti: 1024 ** 4 };
  for (const [sfx, mult] of Object.entries(units)) {
    if (s.endsWith(sfx)) return Math.round(parseFloat(s) * mult);
  }
  return parseInt(s, 10);
}

// Traffic-light color for a utilization percentage
export function pctColor(pct, base = "hsl(210 100% 50%)") {
  if (pct > 90) return "hsl(0 70% 50%)";
  if (pct > 70) return "hsl(38 92% 50%)";
  return base;
}
