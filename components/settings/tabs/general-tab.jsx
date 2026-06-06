"use client";

import { useClusterStore } from "@/stores/clusterStore";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { InfoIcon, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { REFRESH_OPTIONS, DATE_OPTIONS, TIMEZONES } from "@/lib/data";
import { useMetrics } from "@/hooks/use-metrics";

function SettingSelect({ options, storeValue, onChange, placeholder, className }) {
  const currentValue = String(options.find((o) => o.value == storeValue)?.value ?? "");

  return (
    <Select
      value={currentValue}
      onValueChange={(v) => {
        const opt = options.find((o) => String(o.value) === v);
        if (opt) onChange(opt.value);
      }}
    >
      <SelectTrigger className={className}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={String(o.value)} value={String(o.value)}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function SettingRow({ label, description, tooltip, children }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex flex-col gap-0.5">
        <div className="flex items-center gap-1">
          <Label className="text-sm font-medium">{label}</Label>
          {tooltip && (
            <Tooltip delayDuration={400}>
              <TooltipTrigger asChild>
                <InfoIcon className="size-3.5 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent className="max-w-56 text-xs">{tooltip}</TooltipContent>
            </Tooltip>
          )}
        </div>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
      </div>
      {children}
    </div>
  );
}

export function GeneralTab() {
  const { preferences, setPreference } = useClusterStore();
  const { available: metricsAvailable, loading: metricsLoading } = useMetrics("/api/k8s/metrics/detect");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h3 className="text-base font-semibold mb-0.5">General</h3>
        <p className="text-sm text-muted-foreground">
          Dashboard behaviour and data display preferences.
        </p>
      </div>

      <Separator />

      <div className="flex flex-col gap-5">
        {/* Auto-refresh */}
        <SettingRow
          label="Auto-refresh interval"
          description="Automatically reload resource lists at this interval."
          tooltip="When enabled, resource list pages will refetch data at the chosen interval without a manual reload."
        >
          <SettingSelect
            options={REFRESH_OPTIONS}
            storeValue={preferences.autoRefresh}
            onChange={(v) => setPreference({ autoRefresh: v })}
            placeholder="Select interval"
            className="w-44"
          />
        </SettingRow>

        <Separator />

        {/* Date format */}
        <SettingRow
          label="Date format"
          description="How timestamps are displayed across the dashboard."
          tooltip='Relative format shows human-friendly durations (e.g. "3 minutes ago"). Absolute shows the exact date and time.'
        >
          <SettingSelect
            options={DATE_OPTIONS}
            storeValue={preferences.dateFormat}
            onChange={(v) => setPreference({ dateFormat: v })}
            placeholder="Select format"
            className="w-56"
          />
        </SettingRow>

        <Separator />

        {/* Timezone */}
        <SettingRow
          label="Timezone"
          description="All timestamps will be converted to this timezone."
          tooltip="Kubernetes stores times in UTC. This setting converts displayed timestamps to your local or preferred timezone."
        >
          <SettingSelect
            options={TIMEZONES}
            storeValue={preferences.timezone ?? "UTC"}
            onChange={(v) => setPreference({ timezone: v })}
            placeholder="Select timezone"
            className="w-64"
          />
        </SettingRow>

        <Separator />

        {/* Read-only mode */}
        <SettingRow
          label="Read-only mode"
          description="Disable all mutating actions (create, delete, edit) in the UI."
          tooltip="When enabled, action buttons like Delete Pod, Scale Deployment, or Edit ConfigMap will be hidden or disabled."
        >
          <Tooltip delayDuration={400}>
            <TooltipTrigger asChild>
              <button
                role="switch"
                aria-checked={preferences.readOnly ?? false}
                onClick={() => setPreference({ readOnly: !(preferences.readOnly ?? false) })}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  (preferences.readOnly ?? false) ? "bg-primary" : "bg-input"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block size-4 rounded-full bg-background shadow-lg ring-0 transition-transform ${
                    (preferences.readOnly ?? false) ? "translate-x-4" : "translate-x-0"
                  }`}
                />
              </button>
            </TooltipTrigger>
            <TooltipContent className="text-xs">
              {(preferences.readOnly ?? false)
                ? "Read-only mode is ON — mutating actions are disabled"
                : "Read-only mode is OFF — click to protect production clusters"}
            </TooltipContent>
          </Tooltip>
        </SettingRow>
      </div>

      <Separator />

      <div>
        <h3 className="text-base font-semibold mb-0.5">Integrations</h3>
        <p className="text-sm text-muted-foreground">
          Optional Kubernetes components detected in the active cluster.
        </p>
      </div>

      <Separator />

      <div className="flex flex-col gap-5">
        <SettingRow
          label="Metrics Server"
          description="Provides live CPU and memory usage for nodes and pods."
        >
          <div className="flex items-center gap-1.5">
            {metricsLoading || metricsAvailable === null ? (
              <Loader2 className="size-4 animate-spin text-muted-foreground" />
            ) : metricsAvailable ? (
              <>
                <CheckCircle2 className="size-4 text-green-500" />
                <span className="text-xs text-green-600 dark:text-green-400">Available</span>
              </>
            ) : (
              <>
                <XCircle className="size-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Not installed</span>
              </>
            )}
          </div>
        </SettingRow>
      </div>
    </div>
  );
}
