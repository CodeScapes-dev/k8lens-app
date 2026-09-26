// Diagnostics for autoscalers: HorizontalPodAutoscaler.
import { condition } from "./diagnostics-common.js";

const METRIC_FAILURE = /^FailedGet(Resource|Pods|ContainerResource|Object|External)Metric$/;

export function diagnoseHpa(data) {
  const hpa = data?.hpa;
  if (!hpa) return [];
  const out = [];
  const target = hpa.spec?.scaleTargetRef;
  const targetText = target ? `${target.kind} "${target.name}"` : "its target";

  const able = condition(hpa, "AbleToScale");
  if (able?.status === "False") {
    const notFound = /not found|could not find/i.test(`${able.reason} ${able.message}`);
    out.push({
      id: "hpa:cannot-scale",
      issue: notFound ? "Can't find what to scale" : "Can't scale its target",
      technicalName: able.reason,
      severity: "Critical",
      rootCause: notFound ? `The autoscaler points at ${targetText}, but it can't be found, so nothing is scaled.` : `The autoscaler can't change the size of ${targetText}.`,
      evidence: [...(able.message ? [`Kubernetes reported: ${able.message}`] : [])],
      remediation: notFound
        ? ["Fix scaleTargetRef so it names a workload that exists in this namespace, or delete this autoscaler."]
        : ["Read the message above for the reason, then fix that."],
    });
  }

  const active = condition(hpa, "ScalingActive");
  if (active?.status === "False") {
    const message = active.message ?? "";
    let issue = "Can't measure how busy the pods are";
    let cause = `The autoscaler can't work out how busy ${targetText}'s pods are, so it isn't scaling anything.`;
    let fix = ["Read the message above for the exact reason."];

    const missingRequest = message.match(/missing request for (\w+)/i);
    if (missingRequest) {
      issue = `Pods don't set a ${missingRequest[1].toUpperCase() === "CPU" ? "CPU" : missingRequest[1]} request`;
      cause = `Utilization is measured against each container's ${missingRequest[1]} request, but the pods don't set one, so the autoscaler can't calculate it.`;
      fix = [`Set resources.requests.${missingRequest[1]} on every container in ${targetText}'s pod template.`];
    } else if (METRIC_FAILURE.test(active.reason ?? "") && /the server could not find the requested resource|metrics api|unable to fetch metrics|no metrics returned|metrics not available|unable to get metrics/i.test(message)) {
      issue = "Metrics aren't available";
      cause = "The autoscaler needs live CPU and memory numbers from the cluster's metrics server, and it isn't providing them, so nothing is scaled.";
      fix = [
        "Check that metrics-server is installed and running: kubectl get deployment metrics-server -n kube-system",
        "Test it with: kubectl top pods. If that fails, fix metrics-server first.",
        "On local clusters (Docker Desktop, kind, minikube) metrics-server usually has to be installed separately.",
      ];
    } else if (active.reason === "ScalingDisabled") {
      issue = "Autoscaling is switched off";
      cause = `${targetText} is scaled to 0 replicas, which turns autoscaling off until it is scaled up again.`;
      fix = ["Scale the target above 0 to let the autoscaler manage it again."];
    } else if (/^FailedGet(Object|External)Metric$/.test(active.reason ?? "")) {
      issue = "Can't read its custom metric";
      cause = "The autoscaler is configured to use a custom or external metric that it can't read.";
      fix = ["Check the metrics adapter that provides it (for example Prometheus Adapter or KEDA) is installed and healthy."];
    }
    out.push({
      id: "hpa:not-active",
      issue,
      technicalName: active.reason,
      severity: "Critical",
      rootCause: cause,
      evidence: [...(message ? [`Kubernetes reported: ${message}`] : []), ...(active.reason ? [`Reason: ${active.reason}`] : [])],
      remediation: fix,
    });
  }

  const limited = condition(hpa, "ScalingLimited");
  if (limited?.status === "True" && limited.reason === "TooManyReplicas") {
    out.push({
      id: "hpa:maxed",
      issue: "Already at its maximum size",
      technicalName: "TooManyReplicas",
      severity: "Warning",
      rootCause: `The autoscaler wants more replicas than the limit it was given (${hpa.spec?.maxReplicas ?? "?"}), so ${targetText} can't grow any further while load stays high.`,
      evidence: [`Current replicas: ${hpa.status?.currentReplicas ?? "?"}, desired: ${hpa.status?.desiredReplicas ?? "?"}, maximum: ${hpa.spec?.maxReplicas ?? "?"}`],
      remediation: ["Raise maxReplicas if the cluster has room, or make the workload more efficient."],
    });
  }
  return out;
}
