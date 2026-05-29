import { FileIcon, ServerIcon, ShieldIcon } from "lucide-react";

export const METHODS = [
  { id: "kubeconfig", label: "kubeconfig", sub: "Recommended", Icon: FileIcon },
  { id: "incluster", label: "In-cluster", sub: "Service account", Icon: ServerIcon },
  { id: "token", label: "Token", sub: "Bearer token", Icon: ShieldIcon },
];

export const CONNECT_STEPS = [
  { n: "01", title: "Reading kubeconfig", defaultSub: "parsing contexts, users, clusters..." },
  { n: "02", title: "Resolving API endpoint", defaultSub: "looking up server address..." },
  { n: "03", title: "Verifying TLS", defaultSub: "checking certificate chain..." },
  { n: "04", title: "Probing API server", defaultSub: "fetching server version..." },
  { n: "05", title: "Loading API resources", defaultSub: "enumerating resource types..." },
  { n: "06", title: "Building informer cache", defaultSub: "watching pods, services, deployments..." },
];

export const STEP_MS = [600, 500, 500, 700, 600, 500];

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
