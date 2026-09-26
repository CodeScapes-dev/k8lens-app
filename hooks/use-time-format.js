"use client";

import React from "react";
import { useClusterStore } from "@/stores/clusterStore";
import { formatDateTime, formatTimestamp } from "@/lib/k8s/utils";

/**
 * Formats times the way the user asked in Settings.
 * - timestamp: follows the relative/absolute preference (for compact places such as lists)
 * - dateTime, date, clock, time: always absolute, in the chosen timezone
 */
export function useTimeFormat() {
  const timezone = useClusterStore((s) => s.preferences?.timezone ?? "UTC");
  const dateFormat = useClusterStore((s) => s.preferences?.dateFormat ?? "relative");
  return React.useMemo(
    () => ({
      timezone,
      timestamp: (ts) => formatTimestamp(ts, dateFormat, timezone),
      dateTime: (ts) => formatDateTime(ts, timezone, "datetime"),
      date: (ts) => formatDateTime(ts, timezone, "date"),
      clock: (ts) => formatDateTime(ts, timezone, "clock"),
      time: (ts) => formatDateTime(ts, timezone, "time"),
    }),
    [timezone, dateFormat],
  );
}
