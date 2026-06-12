export function formatMemory(bytes) {
  if (!bytes) return "0 GiB";
  const gb = bytes / (1024 * 1024 * 1024);
  return gb >= 1
    ? `${gb.toFixed(1)} GiB`
    : `${(bytes / (1024 * 1024)).toFixed(0)} MiB`;
}

export function formatAge(ts) {
  if (!ts) return "N/A";
  const diff = Date.now() - new Date(ts).getTime();
  const d = Math.floor(diff / 86400000);
  if (d > 0) return `${d}d`;
  const h = Math.floor(diff / 3600000);
  if (h > 0) return `${h}h`;
  return `${Math.floor(diff / 60000)}m`;
}

export function synced(ts) {
  if (!ts) return "just now";
  const s = Math.round((Date.now() - ts) / 1000);
  return s < 60 ? `${s}s ago` : `${Math.floor(s / 60)}m ago`;
}
