"use client";

import React from "react";
import { useK8sDetail } from "@/hooks/use-k8s";
import { LockIcon, AlertTriangleIcon } from "lucide-react";

function parseCertExpiry(base64Pem) {
  try {
    const pem = atob(base64Pem);
    const matches = pem.match(/-----BEGIN CERTIFICATE-----([\s\S]+?)-----END CERTIFICATE-----/);
    if (!matches) return null;

    const der = atob(matches[1].replace(/\s/g, ""));
    const str = der;
    const timeMatches = [];

    for (let i = 0; i < str.length - 13; i++) {
      if (str.charCodeAt(i) === 0x17 || str.charCodeAt(i) === 0x18) {
        const len = str.charCodeAt(i + 1);
        if (len >= 12 && len <= 15) {
          const timeStr = str.slice(i + 2, i + 2 + len);
          if (/^\d{12,14}Z$/.test(timeStr)) {
            timeMatches.push({ tag: str.charCodeAt(i), value: timeStr });
          }
        }
      }
    }

    if (timeMatches.length >= 2) {
      const notAfterRaw = timeMatches[1].value;
      let parsed;
      if (timeMatches[1].tag === 0x17) {
        const year = parseInt(notAfterRaw.slice(0, 2));
        const fullYear = year >= 50 ? 1900 + year : 2000 + year;
        parsed = new Date(`${fullYear}-${notAfterRaw.slice(2, 4)}-${notAfterRaw.slice(4, 6)}T${notAfterRaw.slice(6, 8)}:${notAfterRaw.slice(8, 10)}:${notAfterRaw.slice(10, 12)}Z`);
      } else {
        parsed = new Date(`${notAfterRaw.slice(0, 4)}-${notAfterRaw.slice(4, 6)}-${notAfterRaw.slice(6, 8)}T${notAfterRaw.slice(8, 10)}:${notAfterRaw.slice(10, 12)}:${notAfterRaw.slice(12, 14)}Z`);
      }
      if (!isNaN(parsed.getTime())) return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

function daysUntil(date) {
  return Math.ceil((date.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

function expiryColor(days) {
  if (days <= 7) return "var(--kl-err)";
  if (days <= 30) return "var(--kl-warn)";
  return "var(--kl-ok)";
}

function expiryLabel(days) {
  if (days <= 0) return `Expired ${Math.abs(days)} day${Math.abs(days) !== 1 ? "s" : ""} ago`;
  if (days <= 7) return "Critical";
  if (days <= 30) return "Expiring soon";
  return "Valid";
}

function CertEntry({ secretName, namespace, hosts }) {
  const { data, loading, error } = useK8sDetail("secret", namespace, secretName);
  const secret = data?.secret ?? null;
  const certB64 = secret?.data?.["tls.crt"];

  if (loading) {
    return (
      <div style={{ padding: 16, borderRadius: 10, border: "1px solid var(--kl-border)", background: "var(--kl-surface-2)" }}>
        <div style={{ height: 80, borderRadius: 6, background: "var(--kl-surface)", animation: "kl-pulse 1.4s ease-in-out infinite" }} />
      </div>
    );
  }

  if (error || !secret) {
    return (
      <div style={{ padding: 14, borderRadius: 10, border: "1px solid var(--kl-err)50", background: "var(--kl-err)08" }}>
        <div style={{ fontSize: 12, color: "var(--kl-err)", display: "flex", gap: 6, alignItems: "center" }}>
          <AlertTriangleIcon size={13} />
          Referenced Secret <code>{secretName}</code> does not exist in namespace <code>{namespace}</code>.
        </div>
      </div>
    );
  }

  if (!certB64) {
    return (
      <div style={{ padding: 14, borderRadius: 10, border: "1px solid var(--kl-warn)50", background: "var(--kl-warn)08" }}>
        <div style={{ fontSize: 12, color: "var(--kl-warn)" }}>Secret does not contain a TLS certificate (missing tls.crt key).</div>
      </div>
    );
  }

  const expiry = parseCertExpiry(certB64);
  const days = expiry ? daysUntil(expiry) : null;
  const color = days != null ? expiryColor(days) : "var(--kl-text-muted)";

  return (
    <div style={{ padding: 16, borderRadius: 10, border: "1px solid var(--kl-border)", background: "var(--kl-surface)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: "var(--kl-ok)18", border: "1px solid var(--kl-ok)40", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <LockIcon size={14} style={{ color: "var(--kl-ok)" }} />
        </div>
        <div>
          <div className="kl-mono" style={{ fontSize: 13, fontWeight: 600 }}>{secretName}</div>
          <div style={{ fontSize: 11, color: "var(--kl-text-muted)" }}>{namespace}</div>
        </div>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
        {(hosts ?? []).map((h) => (
          <span key={h} style={{ padding: "2px 8px", borderRadius: 4, fontSize: 11, background: "var(--kl-surface-2)", border: "1px solid var(--kl-border)", fontFamily: "monospace" }}>
            {h}
          </span>
        ))}
      </div>

      {days != null ? (
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 36, fontWeight: 800, fontFamily: "monospace", color, lineHeight: 1 }}>{Math.abs(days)}</div>
            <div style={{ fontSize: 11, color, fontWeight: 600, marginTop: 2 }}>{days <= 0 ? "days ago" : "days left"}</div>
          </div>
          <div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 10px", borderRadius: 10, background: color + "18", border: `1px solid ${color}`, fontSize: 11, fontWeight: 700, color }}>{expiryLabel(days)}</div>
            {expiry && (
              <div style={{ fontSize: 11, color: "var(--kl-text-muted)", marginTop: 4 }}>
                Expires {expiry.toISOString().replace("T", " ").slice(0, 19)} UTC
              </div>
            )}
          </div>
        </div>
      ) : (
        <div style={{ fontSize: 12, color: "var(--kl-warn)" }}>Could not read certificate data.</div>
      )}
    </div>
  );
}

export function TLSTab({ ingress }) {
  const tlsEntries = ingress?.spec?.tls ?? [];
  const namespace = ingress?.metadata?.namespace;

  if (tlsEntries.length === 0) {
    return (
      <div style={{ padding: "40px 0", textAlign: "center", color: "var(--kl-text-muted)", fontSize: 13 }}>
        No TLS configuration found on this Ingress.
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {tlsEntries.map((entry, i) => (
        <CertEntry key={i} secretName={entry.secretName} namespace={namespace} hosts={entry.hosts ?? []} />
      ))}
    </div>
  );
}
