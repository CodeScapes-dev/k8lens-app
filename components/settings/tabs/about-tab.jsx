"use client";

import React from "react";
import { useClusterStore } from "@/stores/clusterStore";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { APP_VERSION } from "@/lib/data";
import { formatDistanceToNow } from "date-fns";

export function AboutTab() {
  const { clusters, clearClusters } = useClusterStore();
  const [confirming, setConfirming] = React.useState(false);
  const [telemetry, setTelemetry] = React.useState(null);
  const [showPayload, setShowPayload] = React.useState(false);

  React.useEffect(() => {
    fetch("/api/telemetry/status")
      .then((r) => r.json())
      .then(setTelemetry)
      .catch(() => {});
  }, []);

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

      {/* Telemetry */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Telemetry</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Anonymous usage data sent to help improve K8Lens. Set{" "}
              <code className="font-mono text-xs bg-muted px-1 py-0.5 rounded">TELEMETRY_DISABLED=true</code>{" "}
              to opt out.
            </p>
          </div>
          {telemetry && (
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${telemetry.enabled ? "border-green-500/40 bg-green-500/10 text-green-600" : "border-border text-muted-foreground"}`}>
              {telemetry.enabled ? "Enabled" : "Disabled"}
            </span>
          )}
        </div>

        {telemetry && (
          <div className="flex flex-col gap-2 text-sm">
            <Row label="Install ID" value={<span className="font-mono text-xs">{telemetry.installId?.slice(0, 8)}…</span>} />
            <Row
              label="Last ping"
              value={telemetry.lastPingAt
                ? formatDistanceToNow(new Date(telemetry.lastPingAt), { addSuffix: true })
                : "Not yet sent"}
            />
            {telemetry.lastPayload && (
              <div>
                <button
                  onClick={() => setShowPayload((v) => !v)}
                  className="text-xs text-primary underline underline-offset-2"
                >
                  {showPayload ? "Hide" : "Show"} last payload
                </button>
                {showPayload && (
                  <pre className="mt-2 p-3 rounded-md bg-muted text-[10.5px] font-mono overflow-auto max-h-48 text-muted-foreground">
                    {JSON.stringify(telemetry.lastPayload, null, 2)}
                  </pre>
                )}
              </div>
            )}
          </div>
        )}
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
