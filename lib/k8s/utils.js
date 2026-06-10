export function serializeK8sObjects(obj) {
  return JSON.parse(JSON.stringify(obj));
}

export function calculateAge(timestamp) {
  if (!timestamp) return "N/A";
  const now = new Date();
  const created = new Date(timestamp);
  const diff = now - created;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days}d`;
  if (hours > 0) return `${hours}h`;
  if (minutes > 0) return `${minutes}m`;
  return `${seconds}s`;
}

export function formatTimestamp(timestamp, format = "relative", timezone = "UTC") {
  if (!timestamp) return "N/A";
  const date = new Date(timestamp);

  if (format === "absolute") {
    try {
      return new Intl.DateTimeFormat("en-US", {
        timeZone: timezone,
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(date);
    } catch {
      return date.toLocaleString();
    }
  }

  const now = new Date();
  const diff = now - date;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return `${seconds}s ago`;
}

export function extractBody(res) {
  return res?.body ?? res;
}

export function extractItems(res) {
  return res?.body?.items ?? res?.items ?? [];
}

// Kubernetes' API server returns a structured `Status` object on error
// ({ message, reason, code, ... }), but @kubernetes/client-node's ApiException
// sometimes hands it back as a raw JSON *string* rather than a parsed object —
// so `err.body.message` is undefined and we'd otherwise fall through to the
// library's "HTTP-Code: 403 Message: Unknown API Status Code! Body: ..." dump.
// Normalize it here so we can read the actual server-provided message/reason.
function parseStatusBody(body) {
  if (body && typeof body === 'object') return body;
  if (typeof body === 'string') {
    try {
      const parsed = JSON.parse(body);
      if (parsed && typeof parsed === 'object') return parsed;
    } catch {
      // not JSON — leave unparsed
    }
  }
  return null;
}

// Rewrites the API server's terse RBAC denial —
//   `nodes is forbidden: User "system:serviceaccount:default:k8lens-viewer"
//    cannot list resource "nodes" in API group "" at the cluster scope`
// — into something a person can act on without knowing Kubernetes internals.
function friendlyForbiddenMessage(statusMessage) {
  if (!statusMessage) return null;
  const m = statusMessage.match(
    /User "([^"]+)" cannot (\w+) resource "([^"]+)"(?: in API group "([^"]*)")?(?: in the namespace "([^"]+)")?/
  );
  if (!m) return null;
  const [, user, verb, resource, group, namespace] = m;
  const account = user.split(':').pop();
  const where = namespace ? ` in namespace "${namespace}"` : '';
  const groupSuffix = group ? ` (API group "${group}")` : '';
  return `Access denied: "${account}" doesn't have permission to ${verb} ${resource}${groupSuffix}${where}. Ask your cluster admin to grant the appropriate RBAC role (e.g. "view") to this account.`;
}

export function extractK8sError(err, fallbackMessage = "Kubernetes API error") {
  const code = err?.code ?? err?.cause?.code;
  if (code === 'ECONNREFUSED' || code === 'ENOTFOUND' || code === 'ETIMEDOUT') {
    return { code: 'CLUSTER_UNREACHABLE', message: 'Cluster is unreachable. Please reconnect.' };
  }

  const body = parseStatusBody(err?.body) ?? parseStatusBody(err?.response?.body);
  const statusCode = err?.code ?? err?.statusCode ?? err?.response?.statusCode;

  if (statusCode === 403 || body?.reason === 'Forbidden') {
    return {
      code: 'FORBIDDEN',
      message: friendlyForbiddenMessage(body?.message) ?? body?.message ?? "You don't have permission to access this resource.",
    };
  }

  if (statusCode === 404 || body?.reason === 'NotFound') {
    return { code: 'NOT_FOUND', message: body?.message ?? 'Resource not found.' };
  }

  const message =
    body?.message ??
    err?.message ??
    fallbackMessage;
  return { code: 'K8S_ERROR', message };
}

export function kiToGB(ki) {
  if (!ki) return 0;
  const value = typeof ki === "string" ? parseFloat(ki.replace(/Ki$/i, "")) : ki;
  return +((value * 1024) / 1e9).toFixed(2);
}

export function parseK8sResourceValue(value, type = "memory") {
  if (typeof value === "number") return value;
  if (!value || typeof value !== "string") return 0;
  if (type === "cpu") {
    if (value.endsWith("m")) return parseFloat(value.replace(/m$/, "")) / 1000;
    return parseFloat(value);
  }
  const units = {
    Ki: 1024, Mi: 1024 ** 2, Gi: 1024 ** 3, Ti: 1024 ** 4, Pi: 1024 ** 5, Ei: 1024 ** 6,
    K: 1000, M: 1000 ** 2, G: 1000 ** 3, T: 1000 ** 4, P: 1000 ** 5, E: 1000 ** 6,
  };
  const match = value.match(/^([0-9.]+)([a-zA-Z]+)?$/);
  if (!match) return 0;
  const num = parseFloat(match[1]);
  const unit = match[2];
  if (!unit) return num;
  if (units[unit]) return num * units[unit];
  return num;
}

export function formatLabel(str) {
  if (!str) return "";
  return str.replace(/([a-z])([A-Z])/g, "$1 $2");
}

export function getPodStatus(item) {
  const containerStatuses = item?.status?.containerStatuses || [];
  let status = item?.status?.phase || "Unknown";
  for (const cs of containerStatuses) {
    if (cs?.state?.waiting?.reason) { status = cs.state.waiting.reason; break; }
    if (cs?.state?.terminated?.reason) { status = cs.state.terminated.reason; break; }
    if (cs?.state?.terminated && cs.state.terminated.exitCode !== 0) { status = "Error"; break; }
  }
  return status;
}

export function getPodRestarts(item) {
  return (item?.status?.containerStatuses || []).reduce(
    (sum, cs) => sum + (cs?.restartCount || 0),
    0,
  );
}
