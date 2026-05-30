"use client";

import { useClusterStore } from "@/stores/clusterStore";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ServerIcon, TrashIcon, PlusIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function ClustersTab() {
  const { clusters, activeContext, removeCluster } = useClusterStore();
  const router = useRouter();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-base font-semibold mb-0.5">Connected Clusters</h3>
          <p className="text-sm text-muted-foreground">
            Manage your connected Kubernetes clusters.
          </p>
        </div>
        <Button size="sm" onClick={() => router.push("/connect")}>
          <PlusIcon className="size-3.5" />
          Add Cluster
        </Button>
      </div>

      <Separator />

      {clusters.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-10 text-center">
          <div className="flex size-12 items-center justify-center rounded-xl bg-muted">
            <ServerIcon className="size-5 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground">No clusters connected yet.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {clusters.map((cluster) => {
            const isActive = cluster.contextName === activeContext;
            const connectedAt = cluster.connectedAt
              ? new Date(cluster.connectedAt).toLocaleString()
              : null;

            return (
              <div
                key={cluster.contextName}
                className={cn(
                  "flex items-start gap-3 rounded-lg border p-3 transition-colors",
                  isActive ? "border-primary/40 bg-primary/5" : "border-border"
                )}
              >
                <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted mt-0.5">
                  <ServerIcon className="size-4 text-muted-foreground" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold font-mono truncate">
                      {cluster.contextName}
                    </span>
                    {isActive && (
                      <Badge
                        variant="outline"
                        className="text-xs text-green-700 border-green-300 bg-green-50 dark:bg-green-950 dark:text-green-400 dark:border-green-800"
                      >
                        Active
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">
                    {cluster.server ?? "—"}
                  </p>
                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                    <span>{cluster.namespaces?.length ?? 0} namespaces</span>
                    {connectedAt && <span>Connected {connectedAt}</span>}
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => removeCluster(cluster.contextName)}
                  >
                    <TrashIcon className="size-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
