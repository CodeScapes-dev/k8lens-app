"use client";

import React from "react";
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
} from "@tanstack/react-table";
import { CardsView } from "./CardsView";
import { ComingSoon } from "./ComingSoon";
import { GraphView } from "./GraphView";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";

const LIMIT_OPTIONS = [5, 10, 20, 50];

// ─── Icons ────────────────────────────────────────────────────────────────────

function SearchIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
    >
      <circle cx="6.5" cy="6.5" r="4.5" />
      <line x1="10.5" y1="10.5" x2="14" y2="14" />
    </svg>
  );
}

function ChevronUpIcon() {
  return (
    <svg
      width="8"
      height="8"
      viewBox="0 0 10 10"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
    >
      <polyline points="2,7 5,3 8,7" />
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg
      width="8"
      height="8"
      viewBox="0 0 10 10"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
    >
      <polyline points="2,3 5,7 8,3" />
    </svg>
  );
}

function CaretIcon() {
  return (
    <svg
      width="8"
      height="8"
      viewBox="0 0 10 10"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
    >
      <polyline points="2,4 5,7 8,4" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 12 12"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
    >
      <line x1="6" y1="1" x2="6" y2="11" />
      <line x1="1" y1="6" x2="11" y2="6" />
    </svg>
  );
}

function TableIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
    >
      <rect x="1" y="1" width="14" height="14" rx="2" />
      <line x1="1" y1="5" x2="15" y2="5" />
      <line x1="1" y1="9" x2="15" y2="9" />
      <line x1="1" y1="13" x2="15" y2="13" />
      <line x1="5" y1="5" x2="5" y2="15" />
    </svg>
  );
}

function CardsIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
    >
      <rect x="1" y="1" width="6" height="6" rx="1.5" />
      <rect x="9" y="1" width="6" height="6" rx="1.5" />
      <rect x="1" y="9" width="6" height="6" rx="1.5" />
      <rect x="9" y="9" width="6" height="6" rx="1.5" />
    </svg>
  );
}

function GraphIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
    >
      <circle cx="8" cy="8" r="2" />
      <circle cx="2.5" cy="4" r="1.5" />
      <circle cx="13.5" cy="4" r="1.5" />
      <circle cx="2.5" cy="12" r="1.5" />
      <circle cx="13.5" cy="12" r="1.5" />
      <line x1="4" y1="4.5" x2="6.3" y2="6.7" />
      <line x1="12" y1="4.5" x2="9.7" y2="6.7" />
      <line x1="4" y1="11.5" x2="6.3" y2="9.3" />
      <line x1="12" y1="11.5" x2="9.7" y2="9.3" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 14 14"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <polyline points="2,7 5.5,10.5 12,3" />
    </svg>
  );
}

const VIEW_ICONS = {
  Table: <TableIcon />,
  Cards: <CardsIcon />,
  Graph: <GraphIcon />,
};

// ─── Filter Chip ──────────────────────────────────────────────────────────────

export function FilterChip({ label, value, plus, onChange, options = [] }) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef(null);

  React.useEffect(() => {
    if (!open) return;
    function handler(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <div
        onClick={() => !plus && setOpen((o) => !o)}
        style={{
          height: 32,
          padding: "0 10px",
          display: "flex",
          alignItems: "center",
          gap: 6,
          background: "var(--kl-surface)",
          border: "1px dashed var(--kl-border-strong)",
          borderRadius: 7,
          fontSize: 12,
          cursor: "pointer",
          userSelect: "none",
          borderStyle:
            value && value !== "all" && value !== "any" ? "solid" : "dashed",
        }}
      >
        {plus && <PlusIcon />}
        <span style={{ color: "var(--kl-text-muted)" }}>{label}</span>
        <span style={{ color: "var(--kl-text-faint)" }}>·</span>
        <span
          style={{
            color: "var(--kl-text)",
            fontWeight: 500,
            fontFamily: "var(--kl-mono)",
            fontSize: 11.5,
          }}
        >
          {value}
        </span>
        {!plus && <CaretIcon />}
      </div>
      {open && options.length > 0 && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            zIndex: 50,
            minWidth: 160,
            background: "var(--kl-surface)",
            border: "1px solid var(--kl-border-strong)",
            borderRadius: 8,
            boxShadow: "var(--kl-shadow)",
            overflow: "hidden",
          }}
        >
          {options.map((opt) => (
            <div
              key={opt.value}
              onClick={() => {
                onChange?.(opt.value);
                setOpen(false);
              }}
              style={{
                padding: "8px 12px",
                fontSize: 12.5,
                cursor: "pointer",
                color:
                  opt.value === value ? "var(--kl-accent)" : "var(--kl-text)",
                background:
                  opt.value === value ? "var(--kl-accent-tint)" : "transparent",
              }}
              onMouseEnter={(e) => {
                if (opt.value !== value)
                  e.currentTarget.style.background = "var(--kl-surface-2)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background =
                  opt.value === value ? "var(--kl-accent-tint)" : "transparent";
              }}
            >
              {opt.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Icon Segmented Toggle ────────────────────────────────────────────────────

export function SegmentedToggle({ options, active, onChange }) {
  return (
    <div
      style={{
        display: "flex",
        height: 32,
        background: "var(--kl-surface-2)",
        border: "1px solid var(--kl-border)",
        borderRadius: 8,
        padding: 2,
        gap: 1,
      }}
    >
      {options.map((opt) => (
        <button
          key={opt}
          onClick={() => onChange?.(opt)}
          title={opt}
          style={{
            height: "100%",
            padding: "0 10px",
            background: active === opt ? "var(--kl-surface)" : "transparent",
            border:
              active === opt
                ? "1px solid var(--kl-border)"
                : "1px solid transparent",
            borderRadius: 6,
            color: active === opt ? "var(--kl-text)" : "var(--kl-text-muted)",
            cursor: "pointer",
            boxShadow: active === opt ? "var(--kl-shadow-sm)" : "none",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {VIEW_ICONS[opt] ?? opt}
        </button>
      ))}
    </div>
  );
}

// ─── Column Visibility Dropdown ───────────────────────────────────────────────

function ColumnsDropdown({ table }) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef(null);

  React.useEffect(() => {
    if (!open) return;
    function handler(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const allColumns = table
    .getAllLeafColumns()
    .filter((col) => col.id !== "check");

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          height: 32,
          padding: "0 12px",
          display: "flex",
          alignItems: "center",
          gap: 6,
          background: open ? "var(--kl-surface-2)" : "var(--kl-surface)",
          border: "1px solid var(--kl-border-strong)",
          borderRadius: 7,
          fontSize: 12,
          fontFamily: "var(--kl-sans)",
          color: "var(--kl-text-2)",
          cursor: "pointer",
        }}
      >
        <svg
          width="11"
          height="11"
          viewBox="0 0 14 14"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
        >
          <line x1="1" y1="3" x2="13" y2="3" />
          <line x1="3" y1="7" x2="11" y2="7" />
          <line x1="5" y1="11" x2="9" y2="11" />
        </svg>
        Columns
      </button>
      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            right: 0,
            zIndex: 50,
            minWidth: 180,
            background: "var(--kl-surface)",
            border: "1px solid var(--kl-border-strong)",
            borderRadius: 8,
            boxShadow: "var(--kl-shadow)",
            overflow: "hidden",
            padding: "4px 0",
          }}
        >
          <div
            style={{
              padding: "6px 12px 4px",
              fontSize: 10.5,
              fontFamily: "var(--kl-mono)",
              color: "var(--kl-text-faint)",
              textTransform: "uppercase",
              letterSpacing: 1.2,
            }}
          >
            Columns
          </div>
          {allColumns.map((col) => {
            const visible = col.getIsVisible();
            const label =
              typeof col.columnDef.header === "string"
                ? col.columnDef.header
                : col.id.charAt(0).toUpperCase() + col.id.slice(1);
            return (
              <div
                key={col.id}
                onClick={() => col.toggleVisibility()}
                style={{
                  padding: "7px 12px",
                  fontSize: 12.5,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  color: "var(--kl-text)",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "var(--kl-surface-2)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                }}
              >
                <span
                  style={{
                    width: 16,
                    height: 16,
                    borderRadius: 4,
                    flexShrink: 0,
                    border: `1.5px solid ${visible ? "var(--kl-accent)" : "var(--kl-border-strong)"}`,
                    background: visible ? "var(--kl-accent)" : "transparent",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "white",
                  }}
                >
                  {visible && <CheckIcon />}
                </span>
                {label}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Main DataTable ───────────────────────────────────────────────────────────

export function DataTable({
  columns,
  data,
  loading,
  refreshing,
  pagination,
  listParams = {},
  onParamsChange,
  filterChips,
  footerText,
  viewMode,
  onViewModeChange,
  onRowClick,
  resourceKind,
}) {
  const [searchDraft, setSearchDraft] = React.useState(listParams.search || "");
  const [columnVisibility, setColumnVisibility] = React.useState({});
  const searchTimeout = React.useRef(null);
  const currentView = viewMode || "Table";

  const table = useReactTable({
    data,
    columns,
    state: {
      columnVisibility,
      pagination: {
        pageIndex: (listParams.page ?? 1) - 1,
        pageSize: listParams.limit ?? 5,
      },
      sorting: listParams.sortBy
        ? [{ id: listParams.sortBy, desc: listParams.sortOrder === "desc" }]
        : [],
    },
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    manualSorting: true,
    pageCount: pagination?.totalPages ?? -1,
  });

  // CSV export
  React.useEffect(() => {
    function handleExport() {
      const visibleCols = table.getVisibleLeafColumns();
      const headers = visibleCols.map((col) =>
        typeof col.columnDef.header === "string"
          ? col.columnDef.header
          : col.id,
      );
      const rows = data.map((row) =>
        visibleCols.map((col) => {
          const val = col.columnDef.accessorFn
            ? col.columnDef.accessorFn(row, 0)
            : "";
          return `"${String(val ?? "").replace(/"/g, '""')}"`;
        }),
      );
      const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join(
        "\n",
      );
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `K8Lens-export-${Date.now()}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    }
    window.addEventListener("kl:export-csv", handleExport);
    return () => window.removeEventListener("kl:export-csv", handleExport);
  }, [table, data]);

  const handleSearch = (val) => {
    setSearchDraft(val);
    clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => {
      onParamsChange?.({ ...listParams, search: val, page: 1 });
    }, 300);
  };

  const handleSort = (colId) => {
    const current = listParams.sortBy;
    const currentOrder = listParams.sortOrder || "asc";
    onParamsChange?.({
      ...listParams,
      sortBy: colId,
      sortOrder:
        current === colId ? (currentOrder === "asc" ? "desc" : "asc") : "asc",
      page: 1,
    });
  };

  const page = listParams.page ?? 1;
  const totalPages = pagination?.totalPages ?? 1;
  const totalItems = pagination?.totalItems ?? data.length;
  const limit = listParams.limit ?? 5;

  return (
    <>
      {/* Toolbar */}
      <div
        style={{
          display: "flex",
          gap: 8,
          alignItems: "center",
          marginBottom: 12,
          flexWrap: "wrap",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            height: 32,
            padding: "0 12px",
            minWidth: 200,
            flex: "1 1 200px",
            maxWidth: 320,
            background: "var(--kl-surface)",
            border: "1px solid var(--kl-border-strong)",
            borderRadius: 7,
            fontSize: 12.5,
            color: "var(--kl-text-muted)",
          }}
        >
          <SearchIcon />
          <input
            placeholder="Filter by name…"
            value={searchDraft}
            onChange={(e) => handleSearch(e.target.value)}
            style={{
              flex: 1,
              background: "transparent",
              border: "none",
              outline: "none",
              fontFamily: "var(--kl-sans)",
              fontSize: "inherit",
              color: "var(--kl-text)",
            }}
          />
          <kbd
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              height: 18,
              minWidth: 18,
              padding: "0 5px",
              background: "var(--kl-surface-2)",
              border: "1px solid var(--kl-border)",
              borderRadius: 4,
              fontSize: 10,
              fontFamily: "var(--kl-mono)",
              color: "var(--kl-text-faint)",
            }}
          >
            /
          </kbd>
        </div>

        {filterChips}

        <div style={{ flex: 1 }} />

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontSize: 12,
            color: "var(--kl-text-muted)",
          }}
        >
          <span>Rows</span>
          <Select
            value={String(limit)}
            onValueChange={(val) =>
              onParamsChange?.({ ...listParams, limit: Number(val), page: 1 })
            }
          >
            <SelectTrigger size="sm" className="w-16 font-mono text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LIMIT_OPTIONS.map((o) => (
                <SelectItem
                  key={o}
                  value={String(o)}
                  className="font-mono text-xs"
                >
                  {o}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <ColumnsDropdown table={table} />

        {onViewModeChange && (
          <SegmentedToggle
            options={["Table", "Cards", "Graph"]}
            active={currentView}
            onChange={onViewModeChange}
          />
        )}
      </div>

      {currentView === "Cards" ? (
        <>
          <CardsView table={table} loading={loading} onRowClick={onRowClick} />
          <style>{`@keyframes kl-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }`}</style>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginTop: 14,
            }}
          >
            <div
              className="font-mono"
              style={{ fontSize: 11, color: "var(--kl-text-muted)" }}
            >
              {footerText || `${totalItems} total`}
            </div>
            {!loading && totalItems > 0 && (
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <PagBtn
                  disabled={page <= 1}
                  onClick={() =>
                    onParamsChange?.({ ...listParams, page: page - 1 })
                  }
                >
                  ←
                </PagBtn>
                <span
                  className="font-mono"
                  style={{ fontSize: 11.5, color: "var(--kl-text-muted)" }}
                >
                  page {page} of {totalPages}
                </span>
                <PagBtn
                  disabled={page >= totalPages}
                  onClick={() =>
                    onParamsChange?.({ ...listParams, page: page + 1 })
                  }
                >
                  →
                </PagBtn>
              </div>
            )}
          </div>
        </>
      ) : currentView === "Graph" ? (
        <GraphView data={data} resourceKind={resourceKind} loading={loading} />
      ) : currentView !== "Table" ? (
        <ComingSoon view={currentView} />
      ) : (
        <>
          {/* shadcn Table — has overflow-x-auto built in */}
          <div className="rounded-md border border-border overflow-hidden">
            <Table>
              <TableHeader>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow
                    key={headerGroup.id}
                    className="bg-muted/50 hover:bg-muted/50"
                  >
                    {headerGroup.headers
                      .filter((h) => h.column.getIsVisible())
                      .map((header) => {
                        const isSorted = listParams.sortBy === header.id;
                        const canSort =
                          header.column.columnDef.meta?.sortable !== false &&
                          header.id !== "check";
                        const w = header.column.columnDef.meta?.w;
                        return (
                          <TableHead
                            key={header.id}
                            onClick={() => canSort && handleSort(header.id)}
                            style={{
                              width: w && w !== "1fr" ? w : undefined,
                              minWidth: w && w !== "1fr" ? w : 80,
                            }}
                            className={`font-mono text-[10.5px] uppercase tracking-wider text-muted-foreground/80 whitespace-nowrap ${canSort ? "cursor-pointer select-none" : ""} ${header.column.columnDef.meta?.align === "right" ? "text-right" : ""} ${isSorted ? "text-foreground" : ""}`}
                          >
                            <span className="inline-flex items-center gap-1">
                              {flexRender(
                                header.column.columnDef.header,
                                header.getContext(),
                              )}
                              {canSort &&
                                (isSorted ? (
                                  listParams.sortOrder === "desc" ? (
                                    <ChevronDownIcon />
                                  ) : (
                                    <ChevronUpIcon />
                                  )
                                ) : (
                                  <CaretIcon />
                                ))}
                            </span>
                          </TableHead>
                        );
                      })}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      {table.getVisibleLeafColumns().map((col, j) => (
                        <TableCell key={col.id}>
                          <div
                            style={{
                              height: 12,
                              borderRadius: 4,
                              background: "var(--kl-surface-2)",
                              animation: "kl-pulse 1.4s ease-in-out infinite",
                              width:
                                j === 0
                                  ? "70%"
                                  : j ===
                                      table.getVisibleLeafColumns().length - 1
                                    ? "40%"
                                    : "60%",
                            }}
                          />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : data.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={table.getVisibleLeafColumns().length}
                      className="text-center py-12 text-muted-foreground text-sm"
                    >
                      No resources found
                    </TableCell>
                  </TableRow>
                ) : (
                  table.getRowModel().rows.map((row) => (
                    <TableRow
                      key={row.id}
                      onClick={() => onRowClick?.(row.original)}
                      className={onRowClick ? "cursor-pointer" : ""}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <TableCell
                          key={cell.id}
                          style={{
                            minWidth:
                              cell.column.columnDef.meta?.w &&
                              cell.column.columnDef.meta?.w !== "1fr"
                                ? cell.column.columnDef.meta?.w
                                : undefined,
                          }}
                          className={[
                            "text-[12.5px]",
                            cell.column.columnDef.meta?.truncate
                              ? "max-w-0 truncate"
                              : "whitespace-nowrap",
                            cell.column.columnDef.meta?.mono ? "font-mono" : "",
                            cell.column.columnDef.meta?.muted
                              ? "text-muted-foreground"
                              : "",
                            cell.column.columnDef.meta?.align === "right"
                              ? "text-right"
                              : "",
                          ].join(" ")}
                        >
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext(),
                          )}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          <style>{`@keyframes kl-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }`}</style>

          {/* Footer */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginTop: 14,
            }}
          >
            <div
              className="font-mono"
              style={{ fontSize: 11, color: "var(--kl-text-muted)" }}
            >
              {footerText || `${totalItems} total`}
            </div>
            {!loading && totalItems > 0 && (
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <PagBtn
                  disabled={page <= 1}
                  onClick={() =>
                    onParamsChange?.({ ...listParams, page: page - 1 })
                  }
                >
                  ←
                </PagBtn>
                <span
                  className="font-mono"
                  style={{ fontSize: 11.5, color: "var(--kl-text-muted)" }}
                >
                  page {page} of {totalPages}
                </span>
                <PagBtn
                  disabled={page >= totalPages}
                  onClick={() =>
                    onParamsChange?.({ ...listParams, page: page + 1 })
                  }
                >
                  →
                </PagBtn>
              </div>
            )}
          </div>
        </>
      )}
    </>
  );
}

function PagBtn({ children, disabled, onClick }) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      style={{
        height: 28,
        minWidth: 28,
        padding: "0 8px",
        background: "var(--kl-surface)",
        border: "1px solid var(--kl-border-strong)",
        borderRadius: 6,
        fontSize: 13,
        fontFamily: "var(--kl-mono)",
        color: disabled ? "var(--kl-text-faint)" : "var(--kl-text)",
        cursor: disabled ? "not-allowed" : "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {children}
    </button>
  );
}
