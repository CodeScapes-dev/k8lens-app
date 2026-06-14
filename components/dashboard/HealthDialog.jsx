"use client";

import React from "react";
import {
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertTriangle,
  CheckCircle,
  AlertCircle,
  XCircle,
  ChevronDown,
} from "lucide-react";
import { KLBadge } from "@/components/kl/Badge";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible";

const SCORE_CATEGORIES = [
  {
    label: "Node Health",
    max: 30,
    checks: [
      "Not ready nodes (−5 each, max −15)",
      "Disk pressure (−10)",
      "Memory pressure (−10)",
      "PID pressure (−5)",
    ],
  },
  {
    label: "Pod Health",
    max: 30,
    checks: [
      "Failed pods (−1 each, max −10)",
      "Pending pods (−1 each, max −10)",
      "CrashLoopBackOff pods (−10)",
    ],
  },
  {
    label: "Workload Health",
    max: 20,
    checks: [
      "Degraded deployments (−2 each, max −10)",
      "Degraded statefulsets (−2 each, max −10)",
      "Degraded daemonsets (−2 each, max −5)",
    ],
  },
  {
    label: "Recent Events",
    max: 10,
    checks: ["Warning events in last 15 min (−1 each, max −10)"],
  },
  {
    label: "Config & Networking",
    max: 10,
    checks: [
      "Namespaces without ResourceQuota (−5)",
      "Services without endpoints (−5)",
    ],
  },
];

export function HealthDialog({ healthScore }) {
  const { score, healthLabel, deductions = [] } = healthScore;

  const deducted = SCORE_CATEGORIES.map((cat) => {
    const catDeductions = deductions.filter((d) =>
      cat.label === "Config & Networking"
        ? d.category === "Configuration" || d.category === "Networking"
        : d.category === cat.label,
    );
    return catDeductions.reduce((s, d) => s + d.deduction, 0);
  });

  return (
    <DialogContent className="sm:max-w-4xl p-0 overflow-hidden">
      <DialogHeader
        className="px-5 pt-4 pb-3"
        style={{ borderBottom: "1px solid var(--kl-border)" }}
      >
        <DialogTitle className="flex items-center gap-3">
          {score >= 90 && (
            <CheckCircle className="h-5 w-5" style={{ color: "var(--kl-ok)" }} />
          )}
          {score >= 70 && score < 90 && (
            <AlertTriangle className="h-5 w-5" style={{ color: "var(--kl-warn)" }} />
          )}
          {score >= 50 && score < 70 && (
            <AlertCircle className="h-5 w-5" style={{ color: "var(--kl-warn)" }} />
          )}
          {score < 50 && (
            <XCircle className="h-5 w-5" style={{ color: "var(--kl-err)" }} />
          )}
          Cluster Health Report
        </DialogTitle>
      </DialogHeader>

      <div
        className="grid grid-cols-2 max-h-[75vh]"
        style={{ borderBottom: "1px solid var(--kl-border)" }}
      >
        {/* Left column — score + active issues */}
        <div
          className="flex flex-col gap-3 overflow-y-auto p-4"
          style={{ borderRight: "1px solid var(--kl-border)" }}
        >
          <div
            className="flex items-center justify-between rounded-lg p-4"
            style={{ background: "var(--kl-surface-2)" }}
          >
            <div>
              <p className="text-xs" style={{ color: "var(--kl-text-muted)" }}>
                Overall score
              </p>
              <p className="mt-1 text-3xl font-bold">{score}/100</p>
            </div>
            <KLBadge tone={score >= 90 ? "ok" : score >= 70 ? "warn" : "err"}>
              {healthLabel}
            </KLBadge>
          </div>

          <p
            className="text-xs font-semibold uppercase tracking-wide"
            style={{ color: "var(--kl-text-muted)" }}
          >
            Active issues
          </p>

          {deductions.length > 0 ? (
            <div className="space-y-2">
              {deductions.map((d, i) => (
                <div
                  key={i}
                  className="rounded-lg border p-3"
                  style={{ background: "var(--kl-err-tint)" }}
                >
                  <div className="mb-1 flex items-center gap-2">
                    <span
                      className="inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-medium"
                      style={{ background: "var(--kl-err)", color: "#fff" }}
                    >
                      −{d.deduction}
                    </span>
                    <span className="text-sm font-medium">{d.category}</span>
                  </div>
                  <p className="text-xs" style={{ color: "var(--kl-text-muted)" }}>
                    {d.reason}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div
              className="rounded-lg border p-8 text-center"
              style={{ background: "var(--kl-ok-tint)" }}
            >
              <CheckCircle
                className="mx-auto mb-2 h-10 w-10"
                style={{ color: "var(--kl-ok)" }}
              />
              <p className="font-medium" style={{ color: "var(--kl-ok)" }}>
                No issues detected
              </p>
            </div>
          )}
        </div>

        {/* Right column — score breakdown */}
        <div className="overflow-y-auto p-4">
          <p
            className="mb-3 text-xs font-semibold uppercase tracking-wide"
            style={{ color: "var(--kl-text-muted)" }}
          >
            Score breakdown
          </p>
          <div className="space-y-2">
            {SCORE_CATEGORIES.map((cat, i) => {
              const lost = deducted[i];
              const pct = lost / cat.max;
              return (
                <Collapsible key={i} defaultOpen={lost > 0}>
                  <div
                    className="rounded-lg border text-xs"
                    style={{ background: "var(--kl-surface-2)" }}
                  >
                    <CollapsibleTrigger className="flex w-full items-center justify-between p-3 [&[data-state=open]>div>svg]:rotate-180">
                      <span className="font-medium" style={{ color: "var(--kl-text)" }}>
                        {cat.label}
                      </span>
                      <div className="flex items-center gap-2">
                        <span style={{ color: "var(--kl-text-muted)" }}>
                          max −{cat.max}
                        </span>
                        <span
                          className="inline-block rounded px-1.5 py-0.5 font-semibold tabular-nums"
                          style={{
                            background:
                              lost === 0
                                ? "var(--kl-ok-tint)"
                                : pct >= 0.7
                                  ? "var(--kl-err-tint)"
                                  : "var(--kl-warn-tint)",
                            color:
                              lost === 0
                                ? "var(--kl-ok)"
                                : pct >= 0.7
                                  ? "var(--kl-err)"
                                  : "var(--kl-warn)",
                          }}
                        >
                          {lost === 0 ? "−0" : `−${lost}`}
                        </span>
                        <ChevronDown
                          className="h-3.5 w-3.5 transition-transform duration-200"
                          style={{ color: "var(--kl-text-muted)" }}
                        />
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="px-3 pb-3">
                        <div
                          className="mb-2 h-1 w-full overflow-hidden rounded-full"
                          style={{ background: "var(--kl-border)" }}
                        >
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${pct * 100}%`,
                              background:
                                lost === 0
                                  ? "var(--kl-ok)"
                                  : pct >= 0.7
                                    ? "var(--kl-err)"
                                    : "var(--kl-warn)",
                            }}
                          />
                        </div>
                        <ul className="space-y-0.5" style={{ color: "var(--kl-text-muted)" }}>
                          {cat.checks.map((c, j) => (
                            <li key={j}>{c}</li>
                          ))}
                        </ul>
                      </div>
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              );
            })}
          </div>
        </div>
      </div>
    </DialogContent>
  );
}
