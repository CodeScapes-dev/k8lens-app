"use client";

import React from "react";
import {
  TerminalIcon,
  CopyIcon,
  CheckIcon,
  ExternalLinkIcon,
  BookOpenIcon,
  LayersIcon,
  XIcon,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
  DialogOverlay,
} from "@/components/ui/dialog";
import { getResourceInfo } from "./resource-info";

// ── Trigger button ──────────────────────────────────────────────────────────
function TriggerBtn({ onClick }) {
  const [hovered, setHovered] = React.useState(false);
  return (
    <button
      onClick={onClick}
      title="Show kubectl command"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 26,
        height: 26,
        borderRadius: 6,
        border: `1px solid ${hovered ? "var(--kl-accent)" : "var(--kl-border)"}`,
        background: hovered
          ? "color-mix(in srgb, var(--kl-accent) 8%, transparent)"
          : "var(--kl-surface-2)",
        color: hovered ? "var(--kl-accent)" : "var(--kl-text-muted)",
        cursor: "pointer",
        flexShrink: 0,
        transition: "all 0.15s",
      }}
    >
      <TerminalIcon size={13} />
    </button>
  );
}

// ── Detail row ──────────────────────────────────────────────────────────────
function DetailRow({ label, value }) {
  return (
    <div style={{ display: "flex", gap: 8, fontSize: 12 }}>
      <span
        style={{ color: "var(--kl-text-muted)", minWidth: 100, flexShrink: 0 }}
      >
        {label}
      </span>
      <span
        style={{
          fontFamily: "var(--kl-mono)",
          color: "var(--kl-text)",
          fontWeight: 500,
        }}
      >
        {value}
      </span>
    </div>
  );
}

// ── Main component ──────────────────────────────────────────────────────────
export function KubectlButton({ command, resourceKey }) {
  const [open, setOpen] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const [isMobile, setIsMobile] = React.useState(false);
  const info = getResourceInfo(resourceKey);

  React.useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const handleCopy = () => {
    navigator.clipboard.writeText(command).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <>
      <TriggerBtn onClick={() => setOpen(true)} />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogOverlay />
        <DialogContent
          showCloseButton={false}
          className="!max-w-3xl p-0 gap-0 overflow-hidden"
        >
          {/* ── Dialog header ── */}
          <DialogHeader className="px-6 pt-5 pb-4 border-b border-border">
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  background:
                    "color-mix(in srgb, var(--kl-accent) 12%, transparent)",
                  border:
                    "1px solid color-mix(in srgb, var(--kl-accent) 25%, transparent)",
                  flexShrink: 0,
                }}
              >
                <TerminalIcon size={15} style={{ color: "var(--kl-accent)" }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <DialogTitle
                  style={{
                    fontSize: 15,
                    fontWeight: 600,
                    color: "var(--kl-text)",
                    margin: 0,
                  }}
                >
                  {info.kind ?? resourceKey}
                </DialogTitle>
                {info.apiVersion && (
                  <p
                    style={{
                      fontSize: 11.5,
                      color: "var(--kl-text-muted)",
                      margin: "2px 0 0",
                      fontFamily: "var(--kl-mono)",
                    }}
                  >
                    {info.apiVersion} · {info.scope}
                  </p>
                )}
              </div>
              {/* Custom close button */}
              <DialogClose asChild>
                <button
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 28,
                    height: 28,
                    borderRadius: 7,
                    border: "1px solid var(--kl-border)",
                    background: "var(--kl-surface-2)",
                    color: "var(--kl-text-muted)",
                    cursor: "pointer",
                    flexShrink: 0,
                    transition: "all 0.15s",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "var(--kl-surface)";
                    e.currentTarget.style.color = "var(--kl-text)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "var(--kl-surface-2)";
                    e.currentTarget.style.color = "var(--kl-text-muted)";
                  }}
                >
                  <XIcon size={14} />
                </button>
              </DialogClose>
            </div>
          </DialogHeader>

          {/* ── Two-column body ── */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: isMobile ? "1fr" : "repeat(12, 1fr)",
              gap: 0,
              maxHeight: "65vh",
              overflowY: "auto",
            }}
          >
            {/* ── Left column — About this resource ── */}
            <div
              style={{
                gridColumn: isMobile ? "span 1" : "span 6",
                padding: "20px 24px",
                borderRight: isMobile ? "none" : "1px solid var(--kl-border)",
                borderBottom: isMobile ? "1px solid var(--kl-border)" : "none",
                display: "flex",
                flexDirection: "column",
                gap: 20,
              }}
            >
              {/* Description */}
              <div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    marginBottom: 8,
                  }}
                >
                  <BookOpenIcon
                    size={13}
                    style={{ color: "var(--kl-accent)" }}
                  />
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: 0.8,
                      color: "var(--kl-text-muted)",
                    }}
                  >
                    About
                  </span>
                </div>
                <p
                  style={{
                    fontSize: 12.5,
                    color: "var(--kl-text)",
                    lineHeight: 1.65,
                    margin: 0,
                  }}
                >
                  {info.description}
                </p>
              </div>

              {/* Details grid */}
              {info.details?.length > 0 && (
                <div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      marginBottom: 10,
                    }}
                  >
                    <LayersIcon
                      size={13}
                      style={{ color: "var(--kl-accent)" }}
                    />
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        textTransform: "uppercase",
                        letterSpacing: 0.8,
                        color: "var(--kl-text-muted)",
                      }}
                    >
                      Details
                    </span>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 6,
                      padding: "10px 12px",
                      background: "var(--kl-surface-2)",
                      borderRadius: 8,
                      border: "1px solid var(--kl-border)",
                    }}
                  >
                    {info.details.map((d) => (
                      <DetailRow
                        key={d.label}
                        label={d.label}
                        value={d.value}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Common use-cases */}
              {info.useCases?.length > 0 && (
                <div>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: 0.8,
                      color: "var(--kl-text-muted)",
                      display: "block",
                      marginBottom: 8,
                    }}
                  >
                    Common use cases
                  </span>
                  <ul
                    style={{
                      margin: 0,
                      padding: 0,
                      listStyle: "none",
                      display: "flex",
                      flexDirection: "column",
                      gap: 5,
                    }}
                  >
                    {info.useCases.map((u) => (
                      <li
                        key={u}
                        style={{
                          display: "flex",
                          alignItems: "flex-start",
                          gap: 7,
                          fontSize: 12,
                          color: "var(--kl-text)",
                        }}
                      >
                        <span
                          style={{
                            width: 4,
                            height: 4,
                            borderRadius: "50%",
                            background: "var(--kl-accent)",
                            flexShrink: 0,
                            marginTop: 5,
                          }}
                        />
                        {u}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Docs link */}
              {info.docsUrl && (
                <a
                  href={info.docsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 5,
                    fontSize: 12,
                    color: "var(--kl-accent)",
                    textDecoration: "none",
                    marginTop: "auto",
                  }}
                >
                  <ExternalLinkIcon size={11} />
                  Kubernetes docs
                </a>
              )}
            </div>

            {/* ── Right column — Page context + kubectl ── */}
            <div
              style={{
                gridColumn: isMobile ? "span 1" : "span 6",
                padding: "20px 24px",
                display: "flex",
                flexDirection: "column",
                gap: 20,
              }}
            >
              {/* Page context */}
              <div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    marginBottom: 8,
                  }}
                >
                  <LayersIcon size={13} style={{ color: "var(--kl-accent)" }} />
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: 0.8,
                      color: "var(--kl-text-muted)",
                    }}
                  >
                    Page context
                  </span>
                </div>
                <p
                  style={{
                    fontSize: 12.5,
                    color: "var(--kl-text)",
                    lineHeight: 1.65,
                    margin: 0,
                  }}
                >
                  {info.pageContext}
                </p>
              </div>

              {/* Divider */}
              <div style={{ height: 1, background: "var(--kl-border)" }} />

              {/* kubectl command */}
              <div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    marginBottom: 10,
                  }}
                >
                  <TerminalIcon
                    size={13}
                    style={{ color: "var(--kl-accent)" }}
                  />
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: 0.8,
                      color: "var(--kl-text-muted)",
                    }}
                  >
                    kubectl command
                  </span>
                </div>

                {/* Code block */}
                <div
                  style={{
                    position: "relative",
                    borderRadius: 8,
                    border: "1px solid var(--kl-border)",
                    background: "var(--kl-surface-2)",
                    overflow: "hidden",
                  }}
                >
                  {/* Code block top bar */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "7px 12px",
                      borderBottom: "1px solid var(--kl-border)",
                      background: "var(--kl-surface)",
                    }}
                  >
                    <div style={{ display: "flex", gap: 5 }}>
                      {["#ef4444", "#f59e0b", "#22c55e"].map((c) => (
                        <span
                          key={c}
                          style={{
                            width: 9,
                            height: 9,
                            borderRadius: "50%",
                            background: c,
                            opacity: 0.7,
                          }}
                        />
                      ))}
                    </div>
                    <span
                      style={{
                        fontSize: 10.5,
                        color: "var(--kl-text-muted)",
                        fontFamily: "var(--kl-mono)",
                      }}
                    >
                      bash
                    </span>
                  </div>

                  {/* Command */}
                  <pre
                    style={{
                      margin: 0,
                      padding: "14px 16px",
                      fontFamily: "var(--kl-mono, monospace)",
                      fontSize: 13,
                      color: "var(--kl-text)",
                      whiteSpace: "pre",
                      overflowX: "auto",
                      lineHeight: 1.6,
                    }}
                  >
                    <span
                      style={{
                        color: "var(--kl-text-muted)",
                        userSelect: "none",
                      }}
                    >
                      ${" "}
                    </span>
                    <code>{command}</code>
                  </pre>
                </div>

                {/* Copy button */}
                <button
                  onClick={handleCopy}
                  style={{
                    marginTop: 10,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "7px 14px",
                    borderRadius: 7,
                    border: "1px solid var(--kl-border)",
                    background: copied
                      ? "color-mix(in srgb, var(--kl-ok) 10%, transparent)"
                      : "var(--kl-surface-2)",
                    color: copied ? "var(--kl-ok)" : "var(--kl-text)",
                    cursor: "pointer",
                    fontSize: 12.5,
                    fontWeight: 500,
                    transition: "all 0.15s",
                    borderColor: copied
                      ? "color-mix(in srgb, var(--kl-ok) 40%, transparent)"
                      : "var(--kl-border)",
                  }}
                >
                  {copied ? (
                    <>
                      <CheckIcon size={13} /> Copied to clipboard
                    </>
                  ) : (
                    <>
                      <CopyIcon size={13} /> Copy command
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
