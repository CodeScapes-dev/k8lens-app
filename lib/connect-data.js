import { FileIcon, ServerIcon, ShieldIcon } from "lucide-react";

export { CONNECT_STEPS, STEP_MS } from "@/lib/data";

export const METHODS = [
  { id: "kubeconfig", label: "kubeconfig", sub: "Recommended", Icon: FileIcon },
  { id: "incluster", label: "In-cluster", sub: "Service account", Icon: ServerIcon },
  { id: "token", label: "Token", sub: "Bearer token", Icon: ShieldIcon },
];

export function buildStepSubs(probe) {
  if (!probe) return null;

  const {
    clusterCount = 0,
    contextCount = 0,
    crdCount = 0,
    namespaceCount = 0,
    namespaces = [],
    server = "",
    serverVersion = "",
    skipTls = false,
    userCount = 0,
  } = probe;

  return [
    `${contextCount} context${contextCount !== 1 ? "s" : ""} · ${userCount} user${userCount !== 1 ? "s" : ""} · ${clusterCount} cluster${clusterCount !== 1 ? "s" : ""}`,
    server || "-",
    skipTls ? "TLS verification skipped" : "TLS verified",
    serverVersion || "version unknown",
    `${crdCount} CRDs found`,
    namespaces.length > 0
      ? `watching ${namespaces.slice(0, 3).join(", ")}${namespaces.length > 3 ? "..." : ""}`
      : `${namespaceCount} namespace${namespaceCount !== 1 ? "s" : ""} loaded`,
  ];
}
