import { load } from 'js-yaml';

export function parseKubeconfig(raw) {
  const config = load(raw);

  if (!config || typeof config !== 'object') {
    throw new Error('Invalid kubeconfig: could not parse YAML');
  }

  const contexts = (config.contexts || []).map((c) => ({
    name: c.name,
    cluster: c.context?.cluster,
    user: c.context?.user,
    namespace: c.context?.namespace || null,
  }));

  const clusters = (config.clusters || []).map((c) => ({
    name: c.name,
    server: c.cluster?.server,
    caData: c.cluster?.['certificate-authority-data'] || null,
    insecure: c.cluster?.['insecure-skip-tls-verify'] || false,
  }));

  const users = (config.users || []).map((u) => ({
    name: u.name,
    token: u.user?.token || null,
    certData: u.user?.['client-certificate-data'] || null,
    keyData: u.user?.['client-key-data'] || null,
    exec: u.user?.exec || null,
  }));

  return {
    currentContext: config['current-context'] || null,
    contexts,
    clusters,
    users,
  };
}

export function getClusterForContext(parsed, contextName) {
  const ctx = parsed.contexts.find((c) => c.name === contextName);
  if (!ctx) return null;
  const cluster = parsed.clusters.find((c) => c.name === ctx.cluster);
  const user = parsed.users.find((u) => u.name === ctx.user);
  return { context: ctx, cluster, user };
}
