"use client";

import React from "react";
import { useClusterStore } from "@/stores/clusterStore";
import { calculateAge, formatTimestamp } from "@/lib/k8s/utils";

export function TimestampCell({ ts }) {
  const dateFormat = useClusterStore((s) => s.preferences?.dateFormat ?? "relative");
  const timezone = useClusterStore((s) => s.preferences?.timezone ?? "UTC");
  if (!ts) return <span style={{ color: "var(--kl-text-faint)" }}>—</span>;
  if (dateFormat === "absolute") {
    return <span title={ts}>{formatTimestamp(ts, "absolute", timezone)}</span>;
  }
  return <span title={new Date(ts).toISOString()}>{calculateAge(ts)}</span>;
}

export function ageCol() {
  return {
    id: "age",
    header: "Age",
    accessorFn: (row) => row.metadata?.creationTimestamp,
    meta: { mono: true, muted: true, w: "0.5fr", sortable: true },
    cell: (info) => <TimestampCell ts={info.getValue()} />,
  };
}

export function nameCol(w = "minmax(0, 2fr)") {
  return {
    id: "name",
    header: "Name",
    accessorFn: (row) => row.metadata?.name,
    meta: { w, sortable: true },
    cell: (info) => (
      <span style={{ fontFamily: "var(--kl-mono)", fontWeight: 500 }}>{info.getValue()}</span>
    ),
  };
}

export function nsCol(w = "0.9fr") {
  return {
    id: "namespace",
    header: "Namespace",
    accessorFn: (row) => row.metadata?.namespace,
    meta: { mono: true, muted: true, w, sortable: true },
  };
}
