"use client";

import React from "react";
import { Handle, Position } from "@xyflow/react";
import { KIND_COLOR } from "@/lib/k8s/kind-config";

const STATUS_DOT = {
  Running: "#22c55e",
  Healthy: "#22c55e",
  Ready: "#22c55e",
  Completed: "#3b82f6",
  Scheduled: "#3b82f6",
  Active: "#22c55e",
  Available: "#94a3b8",
  Degraded: "#f59e0b",
  Failed: "#ef4444",
  NotReady: "#ef4444",
  Pending: "#f59e0b",
  Idle: "#94a3b8",
  Unknown: "#94a3b8",
  Bound: "#22c55e",
};

// Simple SVG icon per kind
function KindIcon({ kind, color, size = 16 }) {
  const icons = {
    Pod: (
      <circle cx="8" cy="8" r="6" fill="none" stroke={color} strokeWidth="1.8" />
    ),
    Deployment: (
      <rect x="2" y="4" width="12" height="9" rx="2" fill="none" stroke={color} strokeWidth="1.8" />
    ),
    ReplicaSet: (
      <>
        <rect x="2" y="5" width="10" height="7" rx="1.5" fill="none" stroke={color} strokeWidth="1.6" />
        <rect x="5" y="3" width="10" height="7" rx="1.5" fill="none" stroke={color} strokeWidth="1.2" opacity="0.5" />
      </>
    ),
    StatefulSet: (
      <>
        <rect x="2" y="2" width="12" height="4" rx="1" fill="none" stroke={color} strokeWidth="1.6" />
        <rect x="2" y="9" width="12" height="4" rx="1" fill="none" stroke={color} strokeWidth="1.6" />
      </>
    ),
    DaemonSet: (
      <>
        <circle cx="4" cy="8" r="2.5" fill={color} opacity="0.7" />
        <circle cx="8" cy="8" r="2.5" fill={color} opacity="0.85" />
        <circle cx="12" cy="8" r="2.5" fill={color} />
      </>
    ),
    Service: (
      <>
        <path d="M8 3 L13 6.5 L13 10.5 L8 14 L3 10.5 L3 6.5 Z" fill="none" stroke={color} strokeWidth="1.7" />
      </>
    ),
    Ingress: (
      <>
        <path d="M2 8 L14 8" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
        <path d="M10 4 L14 8 L10 12" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </>
    ),
    ConfigMap: (
      <>
        <rect x="3" y="2" width="10" height="13" rx="1.5" fill="none" stroke={color} strokeWidth="1.7" />
        <line x1="5" y1="6" x2="11" y2="6" stroke={color} strokeWidth="1.2" />
        <line x1="5" y1="9" x2="11" y2="9" stroke={color} strokeWidth="1.2" />
        <line x1="5" y1="12" x2="8" y2="12" stroke={color} strokeWidth="1.2" />
      </>
    ),
    Secret: (
      <>
        <rect x="4" y="8" width="8" height="6" rx="1" fill="none" stroke={color} strokeWidth="1.7" />
        <path d="M5.5 8 V6 a2.5 2.5 0 0 1 5 0 V8" fill="none" stroke={color} strokeWidth="1.7" />
      </>
    ),
    PersistentVolumeClaim: (
      <>
        <ellipse cx="8" cy="6" rx="5" ry="2.5" fill="none" stroke={color} strokeWidth="1.6" />
        <line x1="3" y1="6" x2="3" y2="11" stroke={color} strokeWidth="1.6" />
        <line x1="13" y1="6" x2="13" y2="11" stroke={color} strokeWidth="1.6" />
        <ellipse cx="8" cy="11" rx="5" ry="2.5" fill="none" stroke={color} strokeWidth="1.6" />
      </>
    ),
    PersistentVolume: (
      <>
        <ellipse cx="8" cy="5" rx="5" ry="2.5" fill="none" stroke={color} strokeWidth="1.6" />
        <line x1="3" y1="5" x2="3" y2="11" stroke={color} strokeWidth="1.6" />
        <line x1="13" y1="5" x2="13" y2="11" stroke={color} strokeWidth="1.6" />
        <ellipse cx="8" cy="11" rx="5" ry="2.5" fill={color} fillOpacity="0.2" stroke={color} strokeWidth="1.6" />
      </>
    ),
    Node: (
      <>
        <rect x="2" y="3" width="12" height="10" rx="2" fill="none" stroke={color} strokeWidth="1.7" />
        <line x1="5" y1="3" x2="5" y2="13" stroke={color} strokeWidth="1" opacity="0.4" />
        <line x1="2" y1="8" x2="14" y2="8" stroke={color} strokeWidth="1" opacity="0.4" />
      </>
    ),
    StorageClass: (
      <>
        <ellipse cx="8" cy="4" rx="5" ry="2" fill="none" stroke={color} strokeWidth="1.6" />
        <line x1="3" y1="4" x2="3" y2="12" stroke={color} strokeWidth="1.6" />
        <line x1="13" y1="4" x2="13" y2="12" stroke={color} strokeWidth="1.6" />
        <ellipse cx="8" cy="8" rx="5" ry="2" fill="none" stroke={color} strokeWidth="1.2" opacity="0.5" />
        <ellipse cx="8" cy="12" rx="5" ry="2" fill="none" stroke={color} strokeWidth="1.6" />
      </>
    ),
    HorizontalPodAutoscaler: (
      <>
        <path d="M2 12 L6 6 L10 9 L14 3" stroke={color} strokeWidth="1.7" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="14" cy="3" r="1.5" fill={color} />
      </>
    ),
    Job: (
      <>
        <rect x="3" y="4" width="10" height="8" rx="1.5" fill="none" stroke={color} strokeWidth="1.7" />
        <path d="M6 8 L7.5 9.5 L10 6.5" stroke={color} strokeWidth="1.5" fill="none" strokeLinecap="round" />
      </>
    ),
    CronJob: (
      <>
        <circle cx="8" cy="8" r="5.5" fill="none" stroke={color} strokeWidth="1.7" />
        <path d="M8 5 L8 8 L10.5 8" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      </>
    ),
    ClusterRole: (
      <>
        <circle cx="8" cy="6" r="2.5" fill="none" stroke={color} strokeWidth="1.7" />
        <path d="M3 13.5 a5 5 0 0 1 10 0" fill="none" stroke={color} strokeWidth="1.7" />
        <circle cx="13" cy="4" r="2" fill={color} fillOpacity="0.35" stroke={color} strokeWidth="1.2" />
      </>
    ),
    ClusterRoleBinding: (
      <>
        <circle cx="5" cy="7" r="2.2" fill="none" stroke={color} strokeWidth="1.5" />
        <circle cx="11" cy="7" r="2.2" fill="none" stroke={color} strokeWidth="1.5" />
        <path d="M7.2 7 L8.8 7" stroke={color} strokeWidth="1.4" />
        <path d="M3 13 a2.2 2.2 0 0 1 4.4 0" fill="none" stroke={color} strokeWidth="1.3" />
        <path d="M8.8 13 a2.2 2.2 0 0 1 4.4 0" fill="none" stroke={color} strokeWidth="1.3" />
      </>
    ),
    IngressClass: (
      <>
        <path d="M2 8 L14 8" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
        <path d="M10 4 L14 8 L10 12" stroke={color} strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="5" cy="8" r="1.5" fill={color} />
      </>
    ),
  };

  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
      {icons[kind] ?? <circle cx="8" cy="8" r="5" fill="none" stroke={color} strokeWidth="1.7" />}
    </svg>
  );
}

export function ResourceNode({ data, selected }) {
  const { node } = data;
  const color = KIND_COLOR[node.kind] ?? "#94a3b8";
  const statusColor = STATUS_DOT[node.status] ?? "#94a3b8";

  const subline = node.replicas != null
    ? `${node.replicas} replica${node.replicas !== 1 ? "s" : ""}`
    : node.status ?? "";

  return (
    <div
      style={{
        background: "var(--kl-surface)",
        border: `1.5px solid ${selected ? color : "var(--kl-border)"}`,
        borderLeft: `3px solid ${color}`,
        borderRadius: 8,
        padding: "7px 10px 7px 8px",
        width: 180,
        minHeight: 72,
        display: "flex",
        flexDirection: "column",
        gap: 3,
        cursor: "pointer",
        boxShadow: selected
          ? `0 0 0 2px ${color}30, 0 2px 8px rgba(0,0,0,0.12)`
          : "0 1px 4px rgba(0,0,0,0.08)",
        transition: "border-color 0.15s, box-shadow 0.15s",
      }}
    >
      <Handle
        type="target"
        position={Position.Top}
        style={{ background: color, width: 7, height: 7, top: -4 }}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        style={{ background: color, width: 7, height: 7, bottom: -4 }}
      />
      <Handle
        type="target"
        position={Position.Left}
        id="left"
        style={{ background: color, width: 6, height: 6, left: -3 }}
      />
      <Handle
        type="source"
        position={Position.Right}
        id="right"
        style={{ background: color, width: 6, height: 6, right: -3 }}
      />

      {/* Kind row */}
      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
        <KindIcon kind={node.kind} color={color} size={14} />
        <span
          style={{
            fontSize: 9.5,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: 0.7,
            color,
            flex: 1,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {node.kind}
        </span>
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: statusColor,
            flexShrink: 0,
          }}
        />
      </div>

      {/* Name */}
      <div
        title={node.name}
        style={{
          fontSize: 11.5,
          fontWeight: 600,
          color: "var(--kl-text)",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          fontFamily: "monospace",
          lineHeight: 1.3,
        }}
      >
        {node.name}
      </div>

      {/* Subline */}
      {subline && (
        <div
          style={{
            fontSize: 10,
            color: "var(--kl-text-muted)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {subline}
        </div>
      )}
    </div>
  );
}
