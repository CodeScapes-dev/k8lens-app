"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

const DEFAULT_PREFERENCES = {
  autoRefresh: 0,
  dateFormat: "relative",
  defaultNamespaces: {},
  density: "comfortable",
  hiddenResources: {},
  hiddenSections: [],
  navStyle: "vertical",
  readOnly: false,
  theme: "system",
  timezone: "UTC",
};

function commitClusters(clusters) {
  const { addCluster } = useClusterStore.getState();
  const connectedClusters = clusters.filter((cluster) => cluster.status === "connected");

  if (connectedClusters.length === 0) {
    throw new Error("No reachable Kubernetes contexts were found. Stay on this page and reconnect when the API server is available.");
  }

  for (const cluster of connectedClusters) {
    addCluster({
      caData: cluster.caData,
      certData: cluster.certData,
      contextName: cluster.contextName,
      keyData: cluster.keyData,
      namespaces: cluster.namespaces ?? [],
      server: cluster.server ?? "",
      skipTLSVerify: cluster.skipTLSVerify,
      token: cluster.token,
    });
  }
}

export const useClusterStore = create(
  persist(
    (set) => ({
      activeContext: null,
      clusters: [],
      preferences: DEFAULT_PREFERENCES,

      addCluster: (info) =>
        set((state) => {
          const index = state.clusters.findIndex((cluster) => cluster.contextName === info.contextName);
          if (index >= 0) {
            const clusters = [...state.clusters];
            clusters[index] = info;
            return { activeContext: info.contextName, clusters };
          }
          return { activeContext: info.contextName, clusters: [...state.clusters, info] };
        }),

      clearClusters: () => set({ activeContext: null, clusters: [] }),

      connectViaAutoDetect: async () => {
        const response = await fetch("/api/cluster/auto-detect", { method: "POST" });
        const data = await response.json();
        if (!response.ok || !data.success) throw new Error(data.error ?? "Auto-detection failed.");

        return {
          probe: data.clusters?.find((cluster) => cluster.probe)?.probe ?? null,
          commit: () => commitClusters(data.clusters ?? []),
        };
      },

      connectViaToken: async ({ apiEndpoint, caData, skipTls, token }) => {
        const response = await fetch("/api/cluster/connect", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ apiEndpoint, caData: caData || undefined, skipTls, token }),
        });
        const data = await response.json();
        if (!response.ok || !data.success) throw new Error(data.error ?? "Connection failed.");

        return {
          probe: data.probe ?? null,
          commit: () => {
            useClusterStore.getState().addCluster({
              caData: data.caData,
              contextName: data.contextName,
              namespaces: data.namespaces,
              server: data.server ?? apiEndpoint,
              skipTLSVerify: data.skipTLSVerify,
              token: data.token,
            });
          },
        };
      },

      connectViaUpload: async (file) => {
        const formData = new FormData();
        formData.append("kubeconfig", file);
        const response = await fetch("/api/cluster/upload", { method: "POST", body: formData });
        const data = await response.json();
        if (!response.ok || !data.success) throw new Error(data.error ?? "Upload failed.");

        return {
          probe: data.clusters?.find((cluster) => cluster.probe)?.probe ?? null,
          commit: () => commitClusters(data.clusters ?? []),
        };
      },

      removeCluster: (contextName) =>
        set((state) => ({
          activeContext: state.activeContext === contextName ? null : state.activeContext,
          clusters: state.clusters.filter((cluster) => cluster.contextName !== contextName),
        })),

      setPreference: (patch) => set((state) => ({ preferences: { ...state.preferences, ...patch } })),

      switchCluster: (contextName) => set({ activeContext: contextName }),
    }),
    {
      name: "kulens-clusters",
      skipHydration: true,
      storage: createJSONStorage(() => localStorage),
    }
  )
);
