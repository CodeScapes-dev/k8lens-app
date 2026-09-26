"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

// Browsers still report some legacy IANA aliases (e.g. Chrome says Asia/Calcutta for India).
const TIMEZONE_ALIASES = {
  "Asia/Calcutta": "Asia/Kolkata",
  "Asia/Saigon": "Asia/Ho_Chi_Minh",
  "Asia/Katmandu": "Asia/Kathmandu",
  "Asia/Rangoon": "Asia/Yangon",
  "Asia/Dacca": "Asia/Dhaka",
  "Europe/Kiev": "Europe/Kyiv",
};

export function getBrowserTimezone() {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    return TIMEZONE_ALIASES[tz] ?? tz;
  } catch {
    return "UTC";
  }
}

const DEFAULT_PREFERENCES = {
  autoRefresh: 0,
  dateFormat: "relative",
  defaultNamespaces: {},
  density: "comfortable",
  developerMode: true,
  hiddenResources: {},
  hiddenSections: [],
  navStyle: "vertical",
  readOnly: false,
  theme: "system",
  timezone: getBrowserTimezone(),
  timezoneAuto: true,
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

      clearClusters: () => {
        localStorage.clear();
        set({ activeContext: null, clusters: [], preferences: DEFAULT_PREFERENCES });
      },

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
        set((state) => {
          const remaining = state.clusters.filter((c) => c.contextName !== contextName);
          if (remaining.length === 0) localStorage.clear();
          return {
            activeContext: state.activeContext === contextName ? (remaining[0]?.contextName ?? null) : state.activeContext,
            clusters: remaining,
          };
        }),

      setPreference: (patch) =>
        set((state) => ({
          preferences: {
            ...state.preferences,
            ...patch,
            // Picking a timezone by hand stops it following the browser; `timezoneAuto` in the patch wins.
            ...("timezone" in patch && !("timezoneAuto" in patch) ? { timezoneAuto: false } : {}),
          },
        })),

      switchCluster: (contextName) => set({ activeContext: contextName }),
    }),
    {
      name: "K8Lens-clusters",
      skipHydration: true,
      merge: (persisted, current) => {
        const stored = persisted?.preferences ?? {};
        const preferences = { ...current.preferences, ...stored };
        // Older saves have no `timezoneAuto`; their "UTC" was just the old default, so treat it as unset.
        preferences.timezoneAuto = stored.timezoneAuto ?? (stored.timezone === undefined || stored.timezone === "UTC");
        if (preferences.timezoneAuto) preferences.timezone = getBrowserTimezone();
        return { ...current, ...persisted, preferences };
      },
      storage: createJSONStorage(() => localStorage),
    }
  )
);
