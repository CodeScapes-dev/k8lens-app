'use server';

import { k8sGetVersion, k8sListNamespaces } from '@/lib/k8s/client';

export async function testConnection({ server, token, insecure }) {
  const creds = { server, token, insecure };
  const start = Date.now();

  let version;
  try {
    version = await k8sGetVersion(creds);
  } catch (err) {
    return { ok: false, error: err.message };
  }

  const latency = Date.now() - start;

  let namespaceCount = null;
  try {
    const ns = await k8sListNamespaces(creds);
    namespaceCount = ns.items?.length ?? null;
  } catch {
    // non-fatal
  }

  return {
    ok: true,
    latency,
    serverVersion: version.gitVersion || version.major + '.' + version.minor,
    namespaceCount,
  };
}

export async function fetchClusterInfo({ server, token, insecure }) {
  const creds = { server, token, insecure };

  try {
    const [version, namespaces] = await Promise.all([
      k8sGetVersion(creds),
      k8sListNamespaces(creds),
    ]);

    return {
      ok: true,
      serverVersion: version.gitVersion,
      namespaceCount: namespaces.items?.length ?? 0,
    };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}
