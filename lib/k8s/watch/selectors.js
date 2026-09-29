// In-memory evaluation of Kubernetes field and label selectors, so cached lists can
// honour the same `fieldSelector` / `labelSelector` arguments the handlers already pass.
// Anything we can't parse returns null and the caller falls back to the API server.

function getPath(obj, path) {
  let cur = obj;
  for (const part of path.split(".")) {
    if (cur == null) return undefined;
    cur = cur[part];
  }
  return cur;
}

// "a=b,c!=d,e==f" → [{ path, op, value }]
export function parseFieldSelector(selector) {
  if (!selector) return [];
  const terms = [];
  for (const raw of selector.split(",")) {
    const term = raw.trim();
    if (!term) continue;
    const m = term.match(/^([A-Za-z0-9_.-]+)\s*(==|!=|=)\s*(.*)$/);
    if (!m) return null;
    terms.push({ path: m[1], op: m[2] === "!=" ? "!=" : "=", value: m[3].trim() });
  }
  return terms;
}

export function matchesFieldSelector(obj, terms) {
  return terms.every(({ path, op, value }) => {
    const actual = getPath(obj, path);
    const str = actual == null ? "" : String(actual);
    return op === "=" ? str === value : str !== value;
  });
}

// Splits on commas that are not inside parentheses: "a in (x,y),b" → ["a in (x,y)", "b"]
function splitTerms(selector) {
  const out = [];
  let depth = 0;
  let cur = "";
  for (const ch of selector) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (ch === "," && depth === 0) {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  if (cur.trim()) out.push(cur);
  return out.map((t) => t.trim()).filter(Boolean);
}

const KEY = "[A-Za-z0-9_./-]+";

export function parseLabelSelector(selector) {
  if (!selector) return [];
  const terms = [];
  for (const term of splitTerms(selector)) {
    let m;
    if ((m = term.match(new RegExp(`^(${KEY})\\s+(in|notin)\\s*\\(([^)]*)\\)$`)))) {
      terms.push({ key: m[1], op: m[2], values: m[3].split(",").map((v) => v.trim()) });
    } else if ((m = term.match(new RegExp(`^(${KEY})\\s*(==|!=|=)\\s*(.*)$`)))) {
      terms.push({ key: m[1], op: m[2] === "!=" ? "!=" : "=", values: [m[3].trim()] });
    } else if ((m = term.match(new RegExp(`^!(${KEY})$`)))) {
      terms.push({ key: m[1], op: "!exists" });
    } else if ((m = term.match(new RegExp(`^(${KEY})$`)))) {
      terms.push({ key: m[1], op: "exists" });
    } else {
      return null;
    }
  }
  return terms;
}

export function matchesLabelSelector(obj, terms) {
  const labels = obj?.metadata?.labels ?? {};
  return terms.every(({ key, op, values }) => {
    const has = Object.prototype.hasOwnProperty.call(labels, key);
    const v = labels[key];
    switch (op) {
      case "=":
      case "in":
        return has && values.includes(v);
      case "!=":
      case "notin":
        return !has || !values.includes(v);
      case "exists":
        return has;
      case "!exists":
        return !has;
      default:
        return false;
    }
  });
}

// Returns a predicate, or null when either selector can't be evaluated locally.
export function compileSelectors({ fieldSelector, labelSelector } = {}) {
  const fields = parseFieldSelector(fieldSelector);
  const labels = parseLabelSelector(labelSelector);
  if (fields === null || labels === null) return null;
  if (!fields.length && !labels.length) return () => true;
  return (obj) => matchesFieldSelector(obj, fields) && matchesLabelSelector(obj, labels);
}
