export function detectClusterProvider(nodes) {
  if (!nodes || nodes.length === 0) return { provider: "Unknown Provider", clusterName: "unknown-cluster", providerType: "unknown" };

  const node = nodes[0];
  const labels = node?.metadata?.labels || {};
  const providerID = node?.spec?.providerID || "";

  if (labels["eks.amazonaws.com/nodegroup"] || labels["alpha.eksctl.io/cluster-name"] || providerID.startsWith("aws://")) {
    return { provider: "Amazon EKS", clusterName: labels["alpha.eksctl.io/cluster-name"] || "eks-cluster", providerType: "eks", region: labels["topology.kubernetes.io/region"] };
  }
  if (labels["cloud.google.com/gke-nodepool"] || providerID.startsWith("gce://")) {
    return { provider: "Google Kubernetes Engine", clusterName: "gke-cluster", providerType: "gke", region: labels["topology.kubernetes.io/region"] };
  }
  if (labels["kubernetes.azure.com/cluster"] || providerID.startsWith("azure://")) {
    return { provider: "Azure Kubernetes Service", clusterName: labels["kubernetes.azure.com/cluster"] || "aks-cluster", providerType: "aks" };
  }
  if (labels["minikube.k8s.io/name"]) {
    return { provider: "Minikube", clusterName: labels["minikube.k8s.io/name"] || "minikube", providerType: "minikube" };
  }
  if (providerID.startsWith("kind://") || (labels["node-role.kubernetes.io/control-plane"] && node?.metadata?.name?.includes("kind"))) {
    return { provider: "kind (Kubernetes in Docker)", clusterName: "kind", providerType: "kind" };
  }
  if (node?.status?.nodeInfo?.osImage?.toLowerCase().includes("k3s")) {
    return { provider: "K3s", clusterName: "k3s-cluster", providerType: "k3s" };
  }

  const hostname = node?.metadata?.name || labels["kubernetes.io/hostname"] || "unknown";
  return { provider: "Self-managed Kubernetes", clusterName: hostname, providerType: "generic" };
}

export function getClusterDisplayName(nodes) {
  const info = detectClusterProvider(nodes);
  return info.region ? `${info.clusterName} (${info.region})` : info.clusterName;
}
