"use client";

import React from "react";
import { useClusterStore } from "@/stores/clusterStore";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { APP_VERSION } from "@/lib/data";

export function AboutTab() {
  const { clusters, clearClusters } = useClusterStore();
  const [confirming, setConfirming] = React.useState(false);

  const handleClearAll = () => {
    if (!confirming) {
      setConfirming(true);
      return;
    }
    clearClusters();
    setConfirming(false);
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h3 className="text-base font-semibold mb-0.5">About</h3>
        <p className="text-sm text-muted-foreground">
          Application information and maintenance actions.
        </p>
      </div>

      <Separator />

      <div className="flex flex-col gap-3">
        <Row label="Application" value={`K8Lens v${APP_VERSION}`} />
        <Row label="Clusters connected" value={clusters.length} />
        <Row
          label="Source"
          value={
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline underline-offset-2 text-sm"
            >
              GitHub
            </a>
          }
        />
      </div>

      <Separator />

      <div className="flex flex-col gap-3">
        <div>
          <p className="text-sm font-medium text-destructive">Danger zone</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            These actions cannot be undone.
          </p>
        </div>

        <div className="flex items-center justify-between rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3">
          <div>
            <p className="text-sm font-medium">Clear all clusters</p>
            <p className="text-xs text-muted-foreground">
              Removes all connected cluster data from local storage.
            </p>
          </div>
          <Button
            variant={confirming ? "destructive" : "outline"}
            size="sm"
            className={
              confirming
                ? ""
                : "border-destructive/40 text-destructive hover:bg-destructive/10"
            }
            onClick={handleClearAll}
            onBlur={() => setConfirming(false)}
          >
            {confirming ? "Confirm clear" : "Clear all"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
