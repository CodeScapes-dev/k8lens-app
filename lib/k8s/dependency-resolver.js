// Resolves upstream/downstream dependencies for a resource.
// Returns { upstream: [{ kind, name, namespace, relationship }], downstream: [...] }
export function resolveDependencies(resourceType, resource, allData = {}) {
  const upstream = [];
  const downstream = [];

  const up = (kind, name, namespace, relationship) => upstream.push({ kind, name, namespace, relationship });
  const down = (kind, name, namespace, relationship) => downstream.push({ kind, name, namespace, relationship });

  const meta = resource?.metadata ?? {};
  const spec = resource?.spec ?? {};
  const ns = meta.namespace;

  switch (resourceType) {
    case "pod": {
      const vols = spec.volumes ?? [];
      vols.forEach((v) => {
        if (v.configMap?.name) up("ConfigMap", v.configMap.name, ns, "mounts");
        if (v.secret?.secretName) up("Secret", v.secret.secretName, ns, "mounts");
        if (v.persistentVolumeClaim?.claimName) up("PersistentVolumeClaim", v.persistentVolumeClaim.claimName, ns, "mounts");
      });
      const containers = [...(spec.initContainers ?? []), ...(spec.containers ?? [])];
      containers.forEach((c) => {
        (c.envFrom ?? []).forEach((e) => {
          if (e.configMapRef?.name) up("ConfigMap", e.configMapRef.name, ns, "mounts");
          if (e.secretRef?.name) up("Secret", e.secretRef.name, ns, "mounts");
        });
        (c.env ?? []).forEach((e) => {
          if (e.valueFrom?.configMapKeyRef?.name) up("ConfigMap", e.valueFrom.configMapKeyRef.name, ns, "mounts");
          if (e.valueFrom?.secretKeyRef?.name) up("Secret", e.valueFrom.secretKeyRef.name, ns, "mounts");
        });
      });
      if (spec.serviceAccountName) up("ServiceAccount", spec.serviceAccountName, ns, "uses");
      break;
    }

    case "deployment":
    case "statefulset":
    case "daemonset": {
      const podTemplate = spec.template ?? {};
      const tSpec = podTemplate.spec ?? {};
      const tMeta = podTemplate.metadata ?? {};
      const vols = tSpec.volumes ?? [];
      vols.forEach((v) => {
        if (v.configMap?.name) up("ConfigMap", v.configMap.name, ns, "mounts");
        if (v.secret?.secretName) up("Secret", v.secret.secretName, ns, "mounts");
        if (v.persistentVolumeClaim?.claimName) up("PersistentVolumeClaim", v.persistentVolumeClaim.claimName, ns, "mounts");
      });
      if (tSpec.serviceAccountName) up("ServiceAccount", tSpec.serviceAccountName, ns, "uses");

      // Downstream: services selecting this workload
      const selector = spec.selector?.matchLabels ?? {};
      const podLabels = tMeta.labels ?? {};
      (allData.services ?? []).forEach((svc) => {
        const svcSel = svc?.spec?.selector ?? {};
        if (Object.keys(svcSel).length === 0) return;
        if (Object.entries(svcSel).every(([k, v]) => (podLabels[k] === v || selector[k] === v))) {
          down("Service", svc?.metadata?.name, svc?.metadata?.namespace ?? ns, "exposes");
        }
      });
      (allData.hpas ?? []).forEach((hpa) => {
        const ref = hpa?.spec?.scaleTargetRef;
        if (ref?.name === meta.name) down("HorizontalPodAutoscaler", hpa?.metadata?.name, hpa?.metadata?.namespace ?? ns, "targets");
      });
      break;
    }

    case "service": {
      // Upstream: pods matching selector
      const selector = spec.selector ?? {};
      if (Object.keys(selector).length > 0) {
        (allData.pods ?? []).forEach((pod) => {
          const l = pod?.metadata?.labels ?? {};
          if (Object.entries(selector).every(([k, v]) => l[k] === v)) {
            up("Pod", pod?.metadata?.name, pod?.metadata?.namespace ?? ns, "selects");
          }
        });
      }
      // Downstream: ingresses referencing this service
      (allData.ingresses ?? []).forEach((ing) => {
        const refs = (ing?.spec?.rules ?? []).flatMap((r) => r?.http?.paths ?? []).map((p) => p?.backend?.service?.name);
        if (refs.includes(meta.name)) down("Ingress", ing?.metadata?.name, ing?.metadata?.namespace ?? ns, "exposes");
      });
      break;
    }

    case "ingress": {
      (spec.rules ?? []).forEach((rule) => {
        (rule?.http?.paths ?? []).forEach((p) => {
          const svcName = p?.backend?.service?.name;
          if (svcName) up("Service", svcName, ns, "references");
        });
      });
      break;
    }

    case "serviceaccount": {
      (allData.roleBindings ?? []).forEach((rb) => {
        if (rb?.subjects?.some((s) => s.kind === "ServiceAccount" && s.name === meta.name)) {
          const kind = rb?.roleRef?.kind ?? "Role";
          up(kind, rb?.roleRef?.name, ns, "bound to");
        }
      });
      break;
    }

    case "pvc": {
      if (spec.storageClassName) up("StorageClass", spec.storageClassName, null, "uses");
      if (spec.volumeName) up("PersistentVolume", spec.volumeName, null, "bound to");
      (allData.pods ?? []).forEach((pod) => {
        if ((pod?.spec?.volumes ?? []).some((v) => v?.persistentVolumeClaim?.claimName === meta.name)) {
          down("Pod", pod?.metadata?.name, pod?.metadata?.namespace ?? ns, "mounts");
        }
      });
      break;
    }

    default:
      break;
  }

  // Deduplicate
  const dedup = (arr) => arr.filter((item, i, self) => self.findIndex((x) => x.kind === item.kind && x.name === item.name) === i);
  return { upstream: dedup(upstream), downstream: dedup(downstream) };
}
