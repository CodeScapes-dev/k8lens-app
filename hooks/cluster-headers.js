// Split out of hooks/use-k8s.js so hooks/use-k8s-subscription.js can import it without a
// use-k8s.js <-> use-k8s-subscription.js circular dependency. Re-exported from use-k8s.js so
// existing `import { clusterHeaders } from "@/hooks/use-k8s"` call sites are unaffected.
export function clusterHeaders(cluster) {
  if (!cluster) return {};
  return {
    ...(cluster.server && { "x-cluster-server": cluster.server }),
    ...(cluster.token && { "x-cluster-token": cluster.token }),
    ...(cluster.caData && { "x-cluster-ca-data": cluster.caData }),
    ...(cluster.certData && { "x-cluster-cert-data": cluster.certData }),
    ...(cluster.keyData && { "x-cluster-key-data": cluster.keyData }),
    ...(cluster.skipTLSVerify !== undefined && {
      "x-cluster-skip-tls": String(cluster.skipTLSVerify),
    }),
  };
}
