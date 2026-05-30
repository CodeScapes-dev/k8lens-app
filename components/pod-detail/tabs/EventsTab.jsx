"use client";

import React from "react";
import { DataTable } from "@/components/data-table";
import { eventColumns } from "@/lib/k8s/columns/cluster";

const DEFAULT_LIMIT = 20;

export function EventsTab({ events }) {
  const [listParams, setListParams] = React.useState({ page: 1, limit: DEFAULT_LIMIT });

  const sorted = [...(events ?? [])].sort((a, b) => {
    const ta = a.lastTimestamp ?? a.firstTimestamp ?? a.metadata?.creationTimestamp ?? 0;
    const tb = b.lastTimestamp ?? b.firstTimestamp ?? b.metadata?.creationTimestamp ?? 0;
    return new Date(tb) - new Date(ta);
  });

  const { page, limit } = listParams;
  const totalItems = sorted.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / limit));
  const paged = sorted.slice((page - 1) * limit, page * limit);

  return (
    <DataTable
      columns={eventColumns}
      data={paged}
      loading={false}
      pagination={{ totalItems, totalPages, page, limit, hasNextPage: page < totalPages, hasPreviousPage: page > 1 }}
      listParams={listParams}
      onParamsChange={setListParams}
      footerText={`${totalItems} event${totalItems !== 1 ? "s" : ""}`}
    />
  );
}
