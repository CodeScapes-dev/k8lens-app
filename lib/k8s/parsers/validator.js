export function validateKubeconfig(parsed) {
  const errors = [];

  if (!parsed.contexts.length) {
    errors.push('No contexts found in kubeconfig');
  }
  if (!parsed.clusters.length) {
    errors.push('No clusters found in kubeconfig');
  }
  if (!parsed.users.length) {
    errors.push('No users found in kubeconfig');
  }

  for (const ctx of parsed.contexts) {
    if (!ctx.cluster) {
      errors.push(`Context "${ctx.name}" is missing a cluster reference`);
    } else if (!parsed.clusters.find((c) => c.name === ctx.cluster)) {
      errors.push(
        `Context "${ctx.name}" references unknown cluster "${ctx.cluster}"`
      );
    }
    if (!ctx.user) {
      errors.push(`Context "${ctx.name}" is missing a user reference`);
    } else if (!parsed.users.find((u) => u.name === ctx.user)) {
      errors.push(
        `Context "${ctx.name}" references unknown user "${ctx.user}"`
      );
    }
  }

  for (const cluster of parsed.clusters) {
    if (!cluster.server) {
      errors.push(`Cluster "${cluster.name}" has no server URL`);
    }
  }

  if (
    parsed.currentContext &&
    !parsed.contexts.find((c) => c.name === parsed.currentContext)
  ) {
    errors.push(
      `current-context "${parsed.currentContext}" does not match any context`
    );
  }

  return { valid: errors.length === 0, errors };
}
