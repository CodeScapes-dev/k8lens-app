// Diagnostics for Network resources: Service, Endpoints, Ingress, IngressClass, NetworkPolicy.
import { PENDING_THRESHOLD_MS, ageMs, condition, eventMessage, latestEvent, plural, podFailureReason, selectorMatches } from "./diagnostics-common.js";

const isReady = (pod) => condition(pod, "Ready")?.status === "True";
const selectorText = (selector) => Object.entries(selector ?? {}).map(([k, v]) => `${k}=${v}`).join(", ");

// ---------- Service ----------

function servicePortDiagnoses(svc, pods) {
  const containerPorts = pods.flatMap((p) => (p?.spec?.containers ?? []).flatMap((c) => c.ports ?? []));
  const out = [];
  for (const port of svc.spec?.ports ?? []) {
    const target = port.targetPort ?? port.port;
    if (typeof target === "string") {
      if (!containerPorts.some((cp) => cp.name === target)) {
        out.push({
          id: `service:named-port:${target}`,
          issue: "Service points at a port name no pod defines",
          severity: "Critical",
          rootCause: `The Service sends traffic to the port called "${target}", but none of its pods define a port with that name, so nothing is delivered.`,
          evidence: [`Service port ${port.port} → targetPort "${target}"`, `Port names on matching pods: ${[...new Set(containerPorts.map((c) => c.name).filter(Boolean))].join(", ") || "none"}`],
          remediation: [`Name a container port "${target}" in the pod template, or change targetPort to the port number the app listens on.`],
        });
      }
    } else if (containerPorts.length > 0 && !containerPorts.some((cp) => cp.containerPort === target)) {
      out.push({
        id: `service:port:${target}`,
        issue: "Port may not match what the pods listen on",
        severity: "Warning",
        rootCause: `The Service sends traffic to port ${target}, but the matching pods only declare ${[...new Set(containerPorts.map((c) => c.containerPort))].join(", ")}.`,
        evidence: [`Service port ${port.port} → targetPort ${target}`],
        remediation: [`Check which port the app really listens on and set targetPort to it. (Pods don't have to declare their ports, so this can be a false alarm if the app does listen on ${target}.)`],
      });
    }
  }
  return out;
}

export function diagnoseService(data, now = Date.now()) {
  const svc = data?.service;
  if (!svc) return [];
  const out = [];
  const type = svc.spec?.type ?? "ClusterIP";
  const selector = svc.spec?.selector ?? {};
  const hasSelector = Object.keys(selector).length > 0;
  const pods = data?.podsUsingService ?? [];
  const subsets = data?.endpoints?.subsets ?? [];
  const readyAddresses = subsets.flatMap((s) => s.addresses ?? []).length;

  if (type !== "ExternalName") {
    if (hasSelector && readyAddresses === 0) {
      if (pods.length === 0) {
        out.push({
          id: "service:no-pods",
          issue: "No pods match this Service",
          technicalName: "No endpoints",
          severity: "Critical",
          rootCause: `The Service looks for pods labeled ${selectorText(selector)}, but no pod in this namespace has those labels, so traffic goes nowhere.`,
          evidence: [`Selector: ${selectorText(selector)}`, "Pods with matching labels: 0", "Ready endpoints: 0"],
          remediation: [
            "Check the Service's selector for typos.",
            "Check the labels on the pods it should reach. For a Deployment, they come from the pod template's labels, not the Deployment's own.",
          ],
        });
      } else {
        const notReady = pods.filter((p) => !isReady(p));
        out.push({
          id: "service:pods-not-ready",
          issue: "Matching pods aren't ready",
          technicalName: "No ready endpoints",
          severity: "Critical",
          rootCause: `${plural(pods.length, "pod")} ${pods.length === 1 ? "matches" : "match"} this Service, but ${pods.length === 1 ? "it isn't" : "none of them is"} ready to receive traffic, so the Service has nothing to send requests to.`,
          evidence: [
            `Selector: ${selectorText(selector)}`,
            ...notReady.slice(0, 5).map((p) => `${p.metadata?.name}: ${podFailureReason(p, now) ?? p.status?.phase ?? "not ready"}`),
            ...(notReady.length > 5 ? [`…and ${notReady.length - 5} more`] : []),
          ],
          remediation: [
            "Open those pods (Workloads → Pods). Their Diagnostics tab explains why they aren't ready.",
            "A pod only receives traffic once it is running and its readiness check passes.",
          ],
        });
      }
    }
    if (hasSelector && pods.length > 0) out.push(...servicePortDiagnoses(svc, pods));
  }

  if (!hasSelector && type !== "ExternalName" && readyAddresses === 0) {
    out.push({
      id: "service:no-selector",
      issue: "No selector and no manual endpoints",
      severity: "Warning",
      rootCause: "This Service doesn't select any pods and has no endpoints of its own, so it has nowhere to send traffic.",
      evidence: ["No selector on the Service", "No addresses on the matching Endpoints object"],
      remediation: ["Add a selector that matches your pods, or create an Endpoints object with the same name that lists where traffic should go."],
    });
  }

  if (type === "LoadBalancer" && !(svc.status?.loadBalancer?.ingress?.length > 0) && (ageMs(svc, now) ?? 0) > PENDING_THRESHOLD_MS) {
    const problem = latestEvent(data?.events ?? [], (e) => e?.type === "Warning");
    out.push({
      id: "service:no-address",
      issue: "No external address assigned",
      technicalName: "LoadBalancer pending",
      severity: "Warning",
      rootCause: "This LoadBalancer Service has been waiting for over 5 minutes for an external address, so it can't be reached from outside the cluster.",
      evidence: ["Type: LoadBalancer", "status.loadBalancer.ingress is empty", ...(problem ? [`Kubernetes reported: ${eventMessage(problem)}`] : [])],
      remediation: [
        "Check that your cluster can create load balancers (a cloud provider, or a tool such as MetalLB on your own hardware).",
        "On local clusters a LoadBalancer often stays pending. Use a NodePort Service or port-forwarding instead.",
      ],
    });
  }
  return out;
}

// ---------- Endpoints ----------

export function diagnoseEndpoints(data) {
  const endpoints = data?.endpoints;
  if (!endpoints || endpoints.metadata?.annotations?.["control-plane.alpha.kubernetes.io/leader"]) return [];
  const subsets = endpoints.subsets ?? [];
  const ready = subsets.flatMap((s) => s.addresses ?? []).length;
  if (ready > 0) return [];
  const notReady = subsets.flatMap((s) => s.notReadyAddresses ?? []);

  if (notReady.length > 0) {
    return [
      {
        id: "endpoints:not-ready",
        issue: "Backing pods aren't ready",
        severity: "Warning",
        rootCause: `${plural(notReady.length, "pod")} back this Service, but none of them is ready, so no traffic reaches them.`,
        evidence: notReady.slice(0, 5).map((a) => `${a.targetRef?.name ?? a.ip} is not ready`),
        remediation: ["Open those pods (Workloads → Pods) and check their Diagnostics tab for why they aren't ready."],
      },
    ];
  }
  return [
    {
      id: "endpoints:empty",
      issue: "No addresses behind this Service",
      severity: "Warning",
      rootCause: "This Endpoints object has no addresses, so the Service with the same name has nothing to send traffic to.",
      evidence: ["No ready or not-ready addresses"],
      remediation: ["Open the Service with the same name and check its Diagnostics tab for why no pods are selected."],
    },
  ];
}

// ---------- Ingress ----------

function ingressBackends(ingress) {
  const list = [];
  const def = ingress.spec?.defaultBackend?.service;
  if (def) list.push({ where: "default backend", service: def.name, port: def.port });
  for (const rule of ingress.spec?.rules ?? []) {
    for (const path of rule.http?.paths ?? []) {
      const svc = path.backend?.service;
      if (svc) list.push({ where: `${rule.host ?? "any host"}${path.path ?? "/"}`, service: svc.name, port: svc.port });
    }
  }
  return list;
}

const serviceExposes = (svc, port) =>
  !port || (svc.ports ?? []).some((p) => (port.number !== undefined && p.port === port.number) || (port.name !== undefined && p.name === port.name));
const portText = (port) => (port?.number !== undefined ? port.number : `"${port?.name}"`);

export function diagnoseIngress(data, now = Date.now()) {
  const ingress = data?.ingress;
  if (!ingress) return [];
  const out = [];
  const services = data?.services;
  const classes = data?.ingressClasses;
  const className = ingress.spec?.ingressClassName ?? ingress.metadata?.annotations?.["kubernetes.io/ingress.class"];

  if (Array.isArray(services)) {
    const byName = new Map(services.map((s) => [s.name, s]));
    const missing = [];
    const badPort = [];
    for (const b of ingressBackends(ingress)) {
      const svc = byName.get(b.service);
      if (!svc) missing.push(b);
      else if (!serviceExposes(svc, b.port)) badPort.push({ ...b, exposes: (svc.ports ?? []).map((p) => p.port).join(", ") });
    }
    if (missing.length > 0) {
      const names = [...new Set(missing.map((m) => m.service))];
      out.push({
        id: "ingress:missing-service",
        issue: "Route points to a Service that doesn't exist",
        severity: "Critical",
        rootCause: `${names.map((n) => `"${n}"`).join(", ")} ${names.length === 1 ? "isn't" : "aren't"} a Service in this namespace, so requests to ${plural(missing.length, "route")} fail with an error page.`,
        evidence: missing.map((m) => `${m.where} → Service "${m.service}" (not found)`),
        remediation: ["Create the Service, or fix the service name in the Ingress rule."],
      });
    }
    if (badPort.length > 0) {
      out.push({
        id: "ingress:bad-port",
        issue: "Route points to a port the Service doesn't expose",
        severity: "Critical",
        rootCause: "Some routes send traffic to a Service port that doesn't exist, so those requests fail.",
        evidence: badPort.map((m) => `${m.where} → ${m.service}:${portText(m.port)} (the Service exposes ${m.exposes || "no ports"})`),
        remediation: ["Change the port in the Ingress rule to one the Service exposes, or add that port to the Service."],
      });
    }
  }

  if (Array.isArray(classes)) {
    if (className && !classes.some((c) => c.name === className)) {
      out.push({
        id: "ingress:class-missing",
        issue: "Ingress class doesn't exist",
        severity: "Critical",
        rootCause: `This Ingress asks for the class "${className}", but the cluster has no such class, so no controller will handle it.`,
        evidence: [`Requested class: ${className}`, `Classes in the cluster: ${classes.map((c) => c.name).join(", ") || "none"}`],
        remediation: ["Install the ingress controller that provides this class, or change ingressClassName to one that exists."],
      });
    } else if (!className && !classes.some((c) => c.isDefault)) {
      out.push({
        id: "ingress:class-none",
        issue: "No ingress class, and the cluster has no default",
        severity: "Warning",
        rootCause: "This Ingress doesn't name an ingress class and the cluster has no default one, so no controller will pick it up.",
        evidence: [`Classes in the cluster: ${classes.map((c) => c.name).join(", ") || "none"}`],
        remediation: ["Set ingressClassName on the Ingress, or mark one IngressClass as the default."],
      });
    }
  }

  for (const [secretName, exists] of Object.entries(data?.tlsSecrets ?? {})) {
    if (exists === false) {
      out.push({
        id: `ingress:tls:${secretName}`,
        issue: "TLS certificate Secret is missing",
        severity: "Critical",
        rootCause: `This Ingress terminates HTTPS using the Secret "${secretName}", but that Secret doesn't exist, so the controller falls back to a default certificate or refuses the connection.`,
        evidence: [`Secret "${secretName}" not found in this namespace`],
        remediation: [`Create the Secret (type kubernetes.io/tls with tls.crt and tls.key), or let a tool like cert-manager create it.`],
      });
    }
  }

  const hasAddress = (ingress.status?.loadBalancer?.ingress?.length ?? 0) > 0;
  if (!hasAddress && (ageMs(ingress, now) ?? 0) > PENDING_THRESHOLD_MS) {
    const known = Array.isArray(classes);
    out.push({
      id: "ingress:no-address",
      issue: "Not picked up by any controller",
      technicalName: "No address",
      severity: "Warning",
      rootCause: `Nothing has given this Ingress an address in over 5 minutes, so it isn't reachable from outside. ${known && classes.length === 0 ? "The cluster has no ingress controller installed." : "It needs a running ingress controller that handles it."}`,
      evidence: [
        `Ingress class: ${className ?? "not set"}`,
        ...(known ? [`Classes in the cluster: ${classes.map((c) => c.name).join(", ") || "none"}`] : []),
        "status.loadBalancer.ingress is empty",
      ],
      remediation: [
        known && classes.length === 0
          ? "Install an ingress controller, for example ingress-nginx, then make sure its class matches this Ingress."
          : "Check that the controller for this Ingress's class is running and healthy.",
        "Look at the controller's pods and logs for errors about this Ingress.",
      ],
    });
  }
  return out;
}

// ---------- IngressClass ----------

export function diagnoseIngressClass(data) {
  const ic = data?.ingressClass;
  if (!ic || !Array.isArray(data?.allClasses)) return [];
  const isDefault = ic.metadata?.annotations?.["ingressclass.kubernetes.io/is-default-class"] === "true";
  const otherDefaults = data.allClasses.filter((c) => c.isDefault && c.name !== ic.metadata?.name);
  if (!isDefault || otherDefaults.length === 0) return [];
  return [
    {
      id: "ingressclass:multiple-defaults",
      issue: "More than one default ingress class",
      severity: "Warning",
      rootCause: `This class and ${otherDefaults.map((c) => `"${c.name}"`).join(", ")} are all marked as the default, so Kubernetes rejects new Ingresses that don't name a class.`,
      evidence: [`Default classes: ${[ic.metadata?.name, ...otherDefaults.map((c) => c.name)].join(", ")}`],
      remediation: ["Keep only one class marked as default by removing the ingressclass.kubernetes.io/is-default-class annotation from the others."],
    },
  ];
}

// ---------- NetworkPolicy ----------

const DNS_PORTS = new Set([53, "53", "dns", "domain"]);

export function diagnoseNetworkPolicy(data) {
  const np = data?.networkPolicy;
  if (!np) return [];
  const out = [];
  const podSelector = np.spec?.podSelector ?? {};
  const pods = data?.pods;
  const selectsEverything = Object.keys(podSelector.matchLabels ?? {}).length === 0 && (podSelector.matchExpressions ?? []).length === 0;
  const selected = Array.isArray(pods) ? pods.filter((p) => selectorMatches(podSelector, p?.metadata?.labels)) : null;

  if (!selectsEverything && selected && selected.length === 0) {
    out.push({
      id: "netpol:no-pods",
      issue: "Doesn't apply to any pods",
      severity: "Warning",
      rootCause: "No pod in this namespace has the labels this policy selects, so the policy currently does nothing.",
      evidence: [`Selector: ${selectorText(podSelector.matchLabels)}${(podSelector.matchExpressions ?? []).length ? " (plus match expressions)" : ""}`, "Pods matching: 0"],
      remediation: ["Check the policy's podSelector for typos, or check the labels on the pods it should protect."],
    });
  }

  const egressRules = np.spec?.egress ?? [];
  const types = np.spec?.policyTypes ?? (egressRules.length > 0 ? ["Ingress", "Egress"] : ["Ingress"]);
  const applies = selected === null || selected.length > 0;
  if (types.includes("Egress") && applies) {
    if (egressRules.length === 0) {
      out.push({
        id: "netpol:egress-deny-all",
        issue: "Blocks all outgoing traffic, including DNS",
        severity: "Warning",
        rootCause: "This policy restricts outgoing traffic but allows none, so the pods it selects can't reach anything, not even DNS to look up names.",
        evidence: ["policyTypes includes Egress", "No egress rules"],
        remediation: ["If this is not intended, add egress rules for what the pods need, and always allow DNS (port 53 to the cluster DNS pods), or remove Egress from policyTypes."],
      });
    } else {
      const allowsDns = egressRules.some((r) => !r.ports || r.ports.length === 0 || r.ports.some((p) => DNS_PORTS.has(p.port)));
      if (!allowsDns) {
        out.push({
          id: "netpol:egress-no-dns",
          issue: "May block DNS lookups",
          severity: "Warning",
          rootCause: "This policy limits outgoing traffic to specific ports and none of them is DNS (port 53), so pods it selects probably can't resolve service names.",
          evidence: [`Egress rules: ${egressRules.length}, none allow port 53`],
          remediation: ["Add an egress rule allowing UDP and TCP port 53 to the cluster DNS pods (usually in kube-system)."],
        });
      }
    }
  }
  return out;
}
