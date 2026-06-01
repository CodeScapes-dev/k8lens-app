"use client";

import React from "react";
import { KLStatus } from "@/components/kl/Status";
import { Badge } from "@/components/ui/badge";
import { ageCol } from "./_shared";

function helmStatusTone(phase) {
  if (phase === "deployed") return "ok";
  if (phase === "failed") return "err";
  return "warn";
}

export const helmReleaseColumns = [
  {
    id: "name",
    header: "Release",
    accessorFn: (r) => r.metadata?.name,
    meta: { w: "minmax(0, 1.8fr)", sortable: true },
    cell: (info) => {
      const row = info.row.original;
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          <span style={{ fontFamily: "var(--kl-mono)", fontWeight: 500 }}>{info.getValue()}</span>

        </div>
      );
    },
  },
  {
    id: "namespace",
    header: "Namespace",
    accessorFn: (r) => r.metadata?.namespace,
    meta: { w: "minmax(0, 1.8fr)", sortable: true },
    cell: (info) => {
      const row = info.row.original;
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>

          {row.metadata.namespace}

        </div>
      );
    },
  },
  {
    id: "chart",
    header: "Chart",
    accessorFn: (r) => r.spec?.chart,
    meta: { w: "1fr", sortable: true },
    cell: (info) => (
      <Badge variant="outline" className="font-mono text-[10.5px] font-normal">
        {info.getValue() ?? "—"}
      </Badge>
    ),
  },
  {
    id: "chartVersion",
    header: "Version",
    accessorFn: (r) => r.spec?.chartVersion,
    meta: { mono: true, w: "0.7fr", sortable: true },
  },
  {
    id: "appVersion",
    header: "App Version",
    accessorFn: (r) => r.spec?.appVersion,
    meta: { mono: true, muted: true, w: "0.7fr", sortable: true },
  },
  {
    id: "revision",
    header: "Rev",
    accessorFn: (r) => r.spec?.revision,
    meta: { mono: true, muted: true, w: "0.4fr", sortable: true },
  },
  {
    id: "status",
    header: "Status",
    accessorFn: (r) => r.status?.phase,
    meta: { w: "0.8fr", sortable: true },
    cell: (info) => {
      const phase = info.getValue() ?? "unknown";
      return (
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <KLStatus kind={helmStatusTone(phase)} dotOnly />
          <span style={{ fontFamily: "var(--kl-mono)", fontSize: 12, textTransform: "capitalize" }}>
            {phase}
          </span>
        </div>
      );
    },
  },
  {
    ...ageCol(),
    accessorFn: (r) => r.metadata?.creationTimestamp,
    header: "Updated",
  },
];
