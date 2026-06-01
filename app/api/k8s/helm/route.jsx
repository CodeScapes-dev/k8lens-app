import { NextResponse } from "next/server";
import zlib from "zlib";
import { getClientsFromRequest } from "@/lib/k8s/client";
import { applyListPipeline, parseListParams } from "@/lib/k8s/list-pipeline";
import { extractK8sError } from "@/lib/k8s/utils";

function decodeHelmRelease(secretData) {
  try {
    // Helm 3 encodes as base64(gzip(json)). K8s then base64-encodes the secret value
    // for transport, so what arrives as secretData is base64(ascii_of_base64(gzip(json))).
    // Step 1: outer base64 decode → ASCII bytes of inner base64 string
    const innerB64 = Buffer.from(secretData, "base64").toString("utf8");
    // Step 2: inner base64 decode → raw gzip bytes
    const gzipBytes = Buffer.from(innerB64, "base64");
    // Step 3: gunzip → JSON string
    const jsonStr = zlib.gunzipSync(gzipBytes).toString("utf8");
    return JSON.parse(jsonStr);
  } catch {
    return null;
  }
}

function parseManifestResources(manifest) {
  if (!manifest) return [];
  const resources = [];
  const docs = manifest.split(/\n---\n/).filter((d) => d.trim());
  for (const doc of docs) {
    const kindMatch = doc.match(/^kind:\s*(.+)$/m);
    const nameMatch = doc.match(/^\s+name:\s*(.+)$/m);
    const nsMatch = doc.match(/^\s+namespace:\s*(.+)$/m);
    if (kindMatch) {
      resources.push({
        kind: kindMatch[1].trim(),
        name: nameMatch ? nameMatch[1].trim() : "—",
        namespace: nsMatch ? nsMatch[1].trim() : null,
      });
    }
  }
  return resources;
}

function normalizeRelease(raw) {
  const chartMeta = raw?.chart?.metadata ?? {};
  const info = raw?.info ?? {};
  return {
    metadata: {
      name: raw.name,
      namespace: raw.namespace,
      creationTimestamp: info.last_deployed,
      labels: {},
    },
    spec: {
      chart: chartMeta.name ?? raw.name,
      chartVersion: chartMeta.version ?? "—",
      appVersion: chartMeta.appVersion ?? "—",
      revision: raw.version ?? 1,
      description: chartMeta.description ?? "",
      chartHome: chartMeta.home ?? null,
      keywords: chartMeta.keywords ?? [],
    },
    status: {
      phase: info.status ?? "unknown",
      description: info.description ?? "",
      firstDeployed: info.first_deployed ?? null,
    },
    config: raw.config ?? {},
    manifest: raw.manifest ?? "",
    resources: parseManifestResources(raw.manifest),
  };
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const resource = searchParams.get("resource");
  const namespace = searchParams.get("namespace");
  const name = searchParams.get("name");

  if (!resource || resource.toLowerCase() !== "releases") {
    return NextResponse.json({ error: `Unknown resource: ${resource}` }, { status: 400 });
  }

  try {
    const clients = getClientsFromRequest(request);
    const params = parseListParams(request);

    // Fetch all Helm release secrets across all namespaces
    const res = await clients.core.listSecretForAllNamespaces({
      labelSelector: "owner=helm",
    });
    const secrets = res.items ?? [];

    // Group by release key (namespace/name), keep only highest revision per release
    const latestMap = new Map();
    for (const secret of secrets) {
      const labels = secret.metadata?.labels ?? {};
      const releaseName = labels["name"];
      const releaseNs = secret.metadata?.namespace;
      if (!releaseName || !releaseNs) continue;

      const key = `${releaseNs}/${releaseName}`;
      const revision = parseInt(labels["version"] ?? "0", 10);
      const existing = latestMap.get(key);
      if (!existing || revision > existing.revision) {
        latestMap.set(key, { secret, revision });
      }
    }

    // Decode and normalize releases
    const releases = [];
    for (const { secret } of latestMap.values()) {
      const releaseData = secret.data?.release;
      if (!releaseData) continue;
      const raw = decodeHelmRelease(releaseData);
      if (!raw) continue;
      // Fill namespace from secret if missing in decoded data
      if (!raw.namespace) raw.namespace = secret.metadata?.namespace;
      const normalized = normalizeRelease(raw);
      releases.push(normalized);
    }

    // Filter by namespace/name for single fetch
    if (name && namespace) {
      const found = releases.find(
        (r) => r.metadata.namespace === namespace && r.metadata.name === name
      );
      if (!found) {
        return NextResponse.json({ error: `Helm release ${namespace}/${name} not found` }, { status: 404 });
      }
      return NextResponse.json({ item: found });
    }

    const filtered = namespace
      ? releases.filter((r) => r.metadata.namespace === namespace)
      : releases;

    const result = applyListPipeline(filtered, params);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: extractK8sError(err, "Failed to fetch Helm releases") }, { status: 500 });
  }
}
