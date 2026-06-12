"use client";

import React from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { useClusterStore } from "@/stores/clusterStore";
import { useDashboardData } from "@/hooks/use-dashboard";
import { DashboardSkeleton } from "@/components/dashboard/DashboardSkeleton";
import { DashboardContent } from "@/components/dashboard/DashboardContent";

export default function DashboardPage() {
  const activeContext = useClusterStore((s) => s.activeContext);
  const { raw, loading, refreshing, error, refresh } = useDashboardData();
  if (loading || !raw) return <DashboardSkeleton />;
  if (error) {
    return (
      <div className="p-5">
        <div
          className="flex items-center gap-2 rounded-md p-3 text-sm"
          style={{ background: "var(--kl-err-tint)", color: "var(--kl-err)" }}
        >
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {error}
          <button
            onClick={refresh}
            className="ml-auto flex items-center gap-1 text-xs underline"
          >
            <RefreshCw size={11} /> Retry
          </button>
        </div>
      </div>
    );
  }
  return (
    <DashboardContent
      data={raw}
      activeContext={activeContext}
      refreshing={refreshing}
      onRefresh={refresh}
    />
  );
}
