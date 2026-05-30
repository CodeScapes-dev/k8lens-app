"use client";

import React from "react";
import { useClusterStore } from "@/stores/clusterStore";
import { clusterHeaders } from "@/hooks/use-k8s";
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { CopyIcon, DownloadIcon, ArrowDownIcon, WifiOffIcon } from "lucide-react";

const TAIL_OPTIONS = [
  { label: "Last 100", value: 100 },
  { label: "Last 500", value: 500 },
  { label: "Last 1000", value: 1000 },
  { label: "All", value: 0 },
];

const SINCE_OPTIONS = [
  { label: "Last 15m", value: 900 },
  { label: "Last 1h", value: 3600 },
  { label: "Last 6h", value: 21600 },
  { label: "Last 24h", value: 86400 },
  { label: "All", value: 0 },
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

export function LogsTab({ pod }) {
  const activeContext = useClusterStore((s) => s.activeContext);
  const clusters = useClusterStore((s) => s.clusters);

  const allContainers = [
    ...(pod?.spec?.initContainers ?? []).map((c) => ({ ...c, init: true })),
    ...(pod?.spec?.containers ?? []),
  ];
  const [container, setContainer] = React.useState(allContainers[0]?.name ?? "");
  const [tailLines, setTailLines] = React.useState(100);
  const [sinceSeconds, setSinceSeconds] = React.useState(0);
  const [search, setSearch] = React.useState("");
  const [live, setLive] = React.useState(false);
  const [logs, setLogs] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(null);
  const [lostConnection, setLostConnection] = React.useState(false);
  const [userScrolled, setUserScrolled] = React.useState(false);
  const bottomRef = React.useRef(null);
  const scrollRef = React.useRef(null);

  const namespace = pod?.metadata?.namespace;
  const name = pod?.metadata?.name;
  const phase = pod?.status?.phase;
  const notRunning = phase && phase !== "Running" && phase !== "Succeeded";

  const fetchLogs = React.useCallback(async () => {
    if (!namespace || !name || !activeContext) return;
    setLoading(true);
    setLostConnection(false);
    try {
      const cluster = clusters.find((c) => c.contextName === activeContext);
      const params = new URLSearchParams({
        namespace, pod: name, context: activeContext,
        timestamps: "false",
      });
      if (container) params.set("container", container);
      if (tailLines > 0) params.set("tailLines", String(tailLines));
      if (sinceSeconds > 0) params.set("sinceSeconds", String(sinceSeconds));
      const res = await fetch(`/api/k8s/logs?${params}`, { headers: clusterHeaders(cluster) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to fetch logs");
      setLogs(json.logs ?? "");
      setError(null);
    } catch (err) {
      if (live) setLostConnection(true);
      else setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [namespace, name, activeContext, clusters, container, tailLines, sinceSeconds, live]);

  React.useEffect(() => { fetchLogs(); }, [fetchLogs]);

  React.useEffect(() => {
    if (!live) return;
    const id = setInterval(fetchLogs, 4000);
    return () => clearInterval(id);
  }, [live, fetchLogs]);

  React.useEffect(() => {
    if (!userScrolled && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs, userScrolled]);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    setUserScrolled(!atBottom);
  };

  const lines = logs.split("\n").filter(Boolean);

  const copyLogs = () => {
    navigator.clipboard.writeText(logs).catch(() => {});
  };

  const downloadLogs = () => {
    const ts = new Date().toISOString().replace(/[:.]/g, "-");
    const fname = `${name}-${container}-${ts}.txt`;
    const blob = new Blob([logs], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = fname; a.click();
    URL.revokeObjectURL(url);
  };

  const containerStatus = (cName) => {
    const all = [
      ...(pod?.status?.initContainerStatuses ?? []),
      ...(pod?.status?.containerStatuses ?? []),
    ];
    return all.find((s) => s.name === cName)?.state;
  };

  if (notRunning && !logs) {
    return (
      <div style={{ padding: "40px 0", textAlign: "center", color: "var(--kl-text-muted)", fontSize: 13 }}>
        Pod is not in a running state. Logs are unavailable.
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0, height: "calc(100vh - 220px)", minHeight: 400 }}>
      {/* Toolbar */}
      <div style={{
        display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center",
        padding: "10px 0 12px", borderBottom: "1px solid var(--kl-border)",
      }}>
        {/* Container selector */}
        <Select value={container} onValueChange={setContainer}>
          <SelectTrigger style={{ width: 180, height: 30, fontSize: 12 }}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {allContainers.map((c) => {
              const state = containerStatus(c.name);
              const stateStr = state?.running ? "Running" : state?.waiting ? `Waiting (${state.waiting.reason ?? ""})` : state?.terminated ? `Terminated` : "";
              return (
                <SelectItem key={c.name} value={c.name}>
                  {c.init ? "[init] " : ""}{c.name}{stateStr ? ` · ${stateStr}` : ""}
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>

        {/* Tail */}
        <Select value={String(tailLines)} onValueChange={(v) => setTailLines(Number(v))}>
          <SelectTrigger style={{ width: 120, height: 30, fontSize: 12 }}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TAIL_OPTIONS.map((o) => <SelectItem key={o.value} value={String(o.value)}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>

        {/* Since */}
        <Select value={String(sinceSeconds)} onValueChange={(v) => setSinceSeconds(Number(v))}>
          <SelectTrigger style={{ width: 120, height: 30, fontSize: 12 }}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SINCE_OPTIONS.map((o) => <SelectItem key={o.value} value={String(o.value)}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>

        {/* Search */}
        <input
          type="text"
          placeholder="Search…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            height: 30, padding: "0 10px", borderRadius: 6, fontSize: 12,
            border: "1px solid var(--kl-border)", background: "var(--kl-surface-2)",
            color: "var(--kl-text)", outline: "none", width: 160,
          }}
        />

        {/* Live toggle */}
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
          <button onClick={copyLogs} title="Copy logs" style={actionBtn}>
            <CopyIcon size={13} />
          </button>
          <button onClick={downloadLogs} title="Download logs" style={actionBtn}>
            <DownloadIcon size={13} />
          </button>
        </div>
      </div>

      {/* Lost connection banner */}
      {lostConnection && (
        <div style={{
          display: "flex", alignItems: "center", gap: 8,
          padding: "8px 12px", background: "var(--kl-err)12",
          border: "1px solid var(--kl-err)40", borderRadius: 6, margin: "8px 0",
          fontSize: 12, color: "var(--kl-err)",
        }}>
          <WifiOffIcon size={13} />
          Connection lost — existing log buffer preserved.
          <button onClick={fetchLogs} style={{ marginLeft: "auto", background: "none", border: "1px solid var(--kl-err)", borderRadius: 4, padding: "2px 8px", color: "var(--kl-err)", cursor: "pointer", fontSize: 11 }}>
            Reconnect
          </button>
        </div>
      )}

      {error && (
        <div style={{ padding: "8px 12px", background: "var(--kl-err)12", borderRadius: 6, fontSize: 12, color: "var(--kl-err)", margin: "8px 0" }}>
          {error}
        </div>
      )}

      {/* Log output */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        style={{
          flex: 1, overflowY: "auto", fontFamily: "monospace", fontSize: 11.5,
          lineHeight: 1.6, color: "var(--kl-text)", background: "var(--kl-surface-2)",
          borderRadius: 8, padding: "8px 0", marginTop: 8,
          position: "relative",
        }}
      >
        {loading && lines.length === 0 && (
          <div style={{ padding: "24px", color: "var(--kl-text-muted)", textAlign: "center" }}>Loading…</div>
        )}
        {!loading && lines.length === 0 && (
          <div style={{ padding: "24px", color: "var(--kl-text-muted)", textAlign: "center" }}>No log output.</div>
        )}
        {lines.map((line, i) => (
          <div
            key={i}
            style={{
              display: "flex", alignItems: "flex-start", gap: 0,
              minHeight: 20,
            }}
          >
            <span style={{
              flexShrink: 0, width: 46, textAlign: "right", paddingRight: 12,
              color: "var(--kl-text-muted)", fontSize: 10.5, paddingTop: 1, userSelect: "none",
            }}>
              {i + 1}
            </span>
            <span style={{ flex: 1, whiteSpace: "pre-wrap", wordBreak: "break-all", ...lineStyle(line) }}>
              {highlightLine(line, search)}
            </span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Jump to bottom */}
      {userScrolled && live && (
        <button
          onClick={() => { setUserScrolled(false); bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }}
          style={{
            position: "absolute", bottom: 80, right: 40,
            background: "var(--kl-accent)", color: "#fff",
            border: "none", borderRadius: 20, padding: "6px 14px",
            fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
            boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
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
