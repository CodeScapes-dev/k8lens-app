const clusterMap = new Map();

export function storeCluster(contextName, config) {
  clusterMap.set(contextName, config);
}

export function getCluster(contextName) {
  return clusterMap.get(contextName) ?? null;
}

export function getAllClusters() {
  return Array.from(clusterMap.entries()).map(([contextName, config]) => ({
    contextName,
    ...config,
  }));
}
