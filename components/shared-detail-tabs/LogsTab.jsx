"use client";

import React from "react";
import { useClusterStore } from "@/stores/clusterStore";
import { clusterHeaders } from "@/hooks/use-k8s";
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { CopyIcon, DownloadIcon, ArrowDownIcon, ChevronDownIcon, CheckIcon } from "lucide-react";

const TAIL_OPTIONS = [
  { label: "Last 100",  value: 100 },
  { label: "Last 500",  value: 500 },
  { label: "Last 1000", value: 1000 },
  { label: "All",       value: 0 },
];

const SINCE_OPTIONS = [
  { label: "Last 15m",  value: 900 },
  { label: "Last 1h",   value: 3600 },
  { label: "Last 6h",   value: 21600 },
  { label: "Last 24h",  value: 86400 },
  { label: "All",       value: 0 },
];

const POD_COLORS = [
  "#6366f1", "#10b981", "#f59e0b", "#ef4444",
  "#8b5cf6", "#06b6d4", "#f97316", "#84cc16",
];

function lineStyle(text) {
  if (/\b(ERROR|FATAL)\b/.test(text)) return { borderLeft: "3px solid var(--kl-err)", paddingLeft: 8, background: "var(--kl-err)08" };
  if (/\bWARN(ING)?\b/.test(text)) return { borderLeft: "3px solid var(--kl-warn)", paddingLeft: 8, background: "var(--kl-warn)08" };
  return { paddingLeft: 11 };
}

function highlightLine(text, search) {
  if (!search) return text;
  const idx = text.toLowerCase().indexOf(search.toLowerCase());
  if (idx === -1) return <span style={{ opacity: 0.35 }}>{text}</span>;
  return (
    <>
      {text.slice(0, idx)}
      <mark style={{ background: "var(--kl-warn)44", color: "inherit", borderRadius: 2 }}>{text.slice(idx, idx + search.length)}</mark>
      {text.slice(idx + search.length)}
    </>
  );
}

function PodMultiSelect({ podNames, selected, onChange }) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef(null);

  React.useEffect(() => {
    function onClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const toggle = (name) => {
    onChange(selected.includes(name)
      ? selected.filter((n) => n !== name)
      : [...selected, name]
    );
  };

  const label = selected.length === 0
    ? "Select pods…"
    : selected.length === podNames.length
      ? `All pods (${podNames.length})`
      : selected.length === 1
        ? selected[0]
        : `${selected.length} pods selected`;

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs ring-offset-background focus:outline-none focus:ring-1 focus:ring-ring"
        style={{ minWidth: 200, height: 30, fontSize: 12, gap: 6 }}
      >
        <span style={{ flex: 1, textAlign: "left", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {label}
        </span>
        <ChevronDownIcon size={12} style={{ flexShrink: 0, opacity: 0.5, transform: open ? "rotate(180deg)" : "none", transition: "transform 0.15s" }} />
      </button>

      {open && (
        <div className="relative z-50 min-w-[8rem] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md"
          style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, zIndex: 50, minWidth: 240, maxHeight: 260, overflowY: "auto", padding: "4px 0" }}
        >
          <button
            onClick={() => onChange(selected.length === podNames.length ? [] : [...podNames])}
            className="relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-3 pr-8 text-xs outline-none hover:bg-accent hover:text-accent-foreground"
            style={{ border: "none", borderBottom: "1px solid var(--border)", marginBottom: 2, gap: 8 }}
          >
            <span style={{
              width: 14, height: 14, borderRadius: 3, flexShrink: 0,
              display: "flex", alignItems: "center", justifyContent: "center",
              background: selected.length === podNames.length ? "var(--kl-accent)" : "transparent",
              border: `1px solid ${selected.length === podNames.length ? "var(--kl-accent)" : "var(--kl-border)"}`,
            }}>
              {selected.length === podNames.length && <CheckIcon size={10} color="#fff" />}
            </span>
            {selected.length === podNames.length ? "Deselect all" : "Select all"}
          </button>

          {podNames.map((name, idx) => {
            const checked = selected.includes(name);
            return (
              <button
                key={name}
                onClick={() => toggle(name)}
                className="relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-3 pr-8 text-sm outline-none hover:bg-accent hover:text-accent-foreground"
                style={{ border: "none", gap: 8 }}
              >
                <span style={{
                  width: 14, height: 14, borderRadius: 3, flexShrink: 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  background: checked ? "var(--kl-accent)" : "transparent",
                  border: `1px solid ${checked ? "var(--kl-accent)" : "var(--kl-border)"}`,
                }}>
                  {checked && <CheckIcon size={10} color="#fff" />}
                </span>
                <span style={{ width: 8, height: 8, borderRadius: "50%", flexShrink: 0, background: POD_COLORS[idx % POD_COLORS.length] }} />
                <span style={{ fontFamily: "monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {name}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * Shared logs tab.
 *
 * Props:
 *   pods       - array of pod objects (required)
 *   singlePod  - when true, hides the pod selector (pod detail page)
 */
export function SharedLogsTab({ pods = [], singlePod = false }) {
  const activeContext = useClusterStore((s) => s.activeContext);
  const clusters = useClusterStore((s) => s.clusters);

  const podsRef = React.useRef(pods);
  React.useEffect(() => { podsRef.current = pods; }, [pods]);

  const podNames = React.useMemo(
    () => pods.map((p) => p.metadata?.name).filter(Boolean),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pods.map((p) => p.metadata?.name).join(",")]
  );

  const [selectedPods, setSelectedPods] = React.useState(() => podNames.slice(0, 1));

  const seededRef = React.useRef(false);
  React.useEffect(() => {
    if (!seededRef.current && podNames.length > 0) {
      seededRef.current = true;
      setSelectedPods((prev) => prev.length > 0 ? prev : podNames.slice(0, 1));
    }
  }, [podNames]);

  const firstPodObj = pods.find((p) => p.metadata?.name === selectedPods[0]);
  const allContainers = React.useMemo(() => [
    ...(firstPodObj?.spec?.initContainers ?? []).map((c) => ({ ...c, init: true })),
    ...(firstPodObj?.spec?.containers ?? []),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [selectedPods[0], pods]);

  const [container, setContainer] = React.useState(allContainers[0]?.name ?? "");
  const prevFirstPodRef = React.useRef(selectedPods[0]);
  React.useEffect(() => {
    if (prevFirstPodRef.current !== selectedPods[0]) {
      prevFirstPodRef.current = selectedPods[0];
      setContainer(allContainers[0]?.name ?? "");
    }
  }, [selectedPods[0], allContainers]);

  const [tailLines, setTailLines] = React.useState(100);
  const [sinceSeconds, setSinceSeconds] = React.useState(0);
  const [search, setSearch] = React.useState("");
  const [live, setLive] = React.useState(false);
  const [podLogs, setPodLogs] = React.useState({});
  const [userScrolled, setUserScrolled] = React.useState(false);
  const bottomRef = React.useRef(null);
  const scrollRef = React.useRef(null);

  const fetchOnePod = React.useCallback(async (podName, podIdx) => {
    const podObj = podsRef.current.find((p) => p.metadata?.name === podName);
    if (!podObj || !activeContext) return;
    const cluster = clusters.find((c) => c.contextName === activeContext);
    const ns = podObj.metadata?.namespace;
    const params = new URLSearchParams({ namespace: ns, pod: podName, context: activeContext, timestamps: "false" });
    if (container) params.set("container", container);
    if (tailLines > 0) params.set("tailLines", String(tailLines));
    if (sinceSeconds > 0) params.set("sinceSeconds", String(sinceSeconds));
    try {
      const res = await fetch(`/api/k8s/logs?${params}`, { headers: clusterHeaders(cluster) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed");
      const color = POD_COLORS[podIdx % POD_COLORS.length];
      const lines = (json.logs ?? "").split("\n").filter(Boolean).map((text) => ({ text, pod: podName, color }));
      setPodLogs((prev) => ({ ...prev, [podName]: { lines, error: null, loading: false } }));
    } catch (err) {
      setPodLogs((prev) => ({ ...prev, [podName]: { lines: [], error: err.message, loading: false } }));
    }
  }, [activeContext, clusters, container, tailLines, sinceSeconds]);

  const fetchAll = React.useCallback(() => {
    if (selectedPods.length === 0) return;
    setPodLogs((prev) => {
      const next = { ...prev };
      selectedPods.forEach((name) => { next[name] = { ...(next[name] ?? {}), loading: true }; });
      return next;
    });
    selectedPods.forEach((name) => fetchOnePod(name, podsRef.current.findIndex((p) => p.metadata?.name === name)));
  }, [selectedPods, fetchOnePod]);

  React.useEffect(() => { React.startTransition(() => { fetchAll(); }); }, [fetchAll]);
  React.useEffect(() => {
    if (!live) return;
    const id = setInterval(fetchAll, 4000);
    return () => clearInterval(id);
  }, [live, fetchAll]);

  React.useEffect(() => {
    if (!userScrolled && bottomRef.current) bottomRef.current.scrollIntoView({ behavior: "smooth" });
  }, [podLogs, userScrolled]);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    setUserScrolled(el.scrollHeight - el.scrollTop - el.clientHeight >= 40);
  };

  const isMulti = selectedPods.length > 1;
  const mergedLines = React.useMemo(
    () => selectedPods.flatMap((name) => podLogs[name]?.lines ?? []),
    [selectedPods, podLogs]
  );
  const anyLoading = selectedPods.some((n) => podLogs[n]?.loading);
  const errors = selectedPods.filter((n) => podLogs[n]?.error).map((n) => `${n}: ${podLogs[n].error}`);
  const allLogsText = mergedLines.map((l) => l.text).join("\n");

  const copyLogs = () => { navigator.clipboard.writeText(allLogsText).catch(() => {}); };
  const downloadLogs = () => {
    const ts = new Date().toISOString().replace(/[:.]/g, "-");
    const blob = new Blob([allLogsText], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `logs-${ts}.txt`; a.click();
    URL.revokeObjectURL(url);
  };

  if (podNames.length === 0) {
    return (
      <div style={{ padding: "40px 0", textAlign: "center", color: "var(--kl-text-muted)", fontSize: 13 }}>
        No pods available.
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 320px)", minHeight: 320 }}>
      {/* Toolbar */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", padding: "10px 0 12px", borderBottom: "1px solid var(--kl-border)" }}>

        {!singlePod && (
          <PodMultiSelect podNames={podNames} selected={selectedPods} onChange={setSelectedPods} />
        )}

        {/* Container selector: always shown for single-pod mode; shown in multi-pod only when 1 pod selected */}
        {(singlePod || !isMulti) && (
          <Select value={container} onValueChange={setContainer}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {allContainers.map((c) => {
                const statuses = [
                  ...(firstPodObj?.status?.initContainerStatuses ?? []),
                  ...(firstPodObj?.status?.containerStatuses ?? []),
                ];
                const state = statuses.find((s) => s.name === c.name)?.state;
                const stateStr = state?.running ? "Running" : state?.waiting ? `Waiting` : state?.terminated ? "Terminated" : "";
                return (
                  <SelectItem key={c.name} value={c.name}>
                    {c.init ? "[init] " : ""}{c.name}{stateStr ? ` · ${stateStr}` : ""}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        )}

        <Select value={String(tailLines)} onValueChange={(v) => setTailLines(Number(v))}>
          <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {TAIL_OPTIONS.map((o) => <SelectItem key={o.value} value={String(o.value)}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={String(sinceSeconds)} onValueChange={(v) => setSinceSeconds(Number(v))}>
          <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {SINCE_OPTIONS.map((o) => <SelectItem key={o.value} value={String(o.value)}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>

        <input
          type="text"
          placeholder="Search…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          style={{ width: 150, height: 30 }}
        />

        <button
          onClick={() => setLive((v) => !v)}
          style={{
            height: 30, padding: "0 12px", borderRadius: 6, fontSize: 12,
            border: `1px solid ${live ? "var(--kl-ok)" : "var(--kl-border)"}`,
            background: live ? "var(--kl-ok)18" : "var(--kl-surface-2)",
            color: live ? "var(--kl-ok)" : "var(--kl-text-muted)",
            cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
          }}
        >
          {live && <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--kl-ok)", animation: "kl-pulse 1s infinite" }} />}
          {live ? "Live" : "Live mode"}
        </button>

        <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
          <button onClick={copyLogs} title="Copy logs" style={actionBtn}><CopyIcon size={13} /></button>
          <button onClick={downloadLogs} title="Download logs" style={actionBtn}><DownloadIcon size={13} /></button>
        </div>
      </div>

      {errors.length > 0 && (
        <div style={{ padding: "8px 12px", background: "var(--kl-err)12", borderRadius: 6, fontSize: 12, color: "var(--kl-err)", margin: "8px 0" }}>
          {errors.join(" · ")}
        </div>
      )}

      {/* Log output */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        style={{
          flex: 1, overflowY: "auto", fontFamily: "monospace", fontSize: 11.5,
          lineHeight: 1.6, color: "var(--kl-text)", background: "var(--kl-surface-2)",
          borderRadius: 8, padding: "8px 0", marginTop: 8, position: "relative",
        }}
      >
        {anyLoading && mergedLines.length === 0 && (
          <div style={{ padding: "24px", color: "var(--kl-text-muted)", textAlign: "center" }}>Loading…</div>
        )}
        {!anyLoading && mergedLines.length === 0 && (
          <div style={{ padding: "24px", color: "var(--kl-text-muted)", textAlign: "center" }}>No log output.</div>
        )}
        {mergedLines.map((line, i) => (
          <div key={i} style={{ display: "flex", alignItems: "flex-start", minHeight: 20 }}>
            <span style={{
              flexShrink: 0, width: 46, textAlign: "right", paddingRight: 12,
              color: "var(--kl-text-muted)", fontSize: 10.5, paddingTop: 1, userSelect: "none",
            }}>
              {i + 1}
            </span>
            {isMulti && (
              <span style={{
                flexShrink: 0, fontSize: 10, paddingTop: 2, paddingRight: 8,
                color: line.color, fontWeight: 600, maxWidth: 120,
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", userSelect: "none",
              }}>
                {line.pod.split("-").slice(-2).join("-")}
              </span>
            )}
            <span style={{ flex: 1, whiteSpace: "pre-wrap", wordBreak: "break-all", ...lineStyle(line.text) }}>
              {highlightLine(line.text, search)}
            </span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {userScrolled && live && (
        <button
          onClick={() => { setUserScrolled(false); bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }}
          style={{
            position: "absolute", bottom: 80, right: 40,
            background: "var(--kl-accent)", color: "#fff", border: "none",
            borderRadius: 20, padding: "6px 14px", fontSize: 12, cursor: "pointer",
            display: "flex", alignItems: "center", gap: 6, boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
          }}
        >
          <ArrowDownIcon size={13} /> Jump to bottom
        </button>
      )}
    </div>
  );
}

const actionBtn = {
  height: 30, width: 30, borderRadius: 6, border: "1px solid var(--kl-border)",
  background: "var(--kl-surface-2)", color: "var(--kl-text-muted)",
  cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
};
