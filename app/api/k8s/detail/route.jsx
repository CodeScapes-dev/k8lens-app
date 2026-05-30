import { NextResponse } from "next/server";
import { getClientsFromRequest } from "@/lib/k8s/client";
import { serializeK8sObjects, extractBody, extractItems, extractK8sError } from "@/lib/k8s/utils";

const handlers = {
  pod: async (clients, { namespace, name }) => {
    const [podRes, eventsRes] = await Promise.allSettled([
      clients.core.readNamespacedPod({ namespace, name }),
      clients.core.listNamespacedEvent({ namespace, fieldSelector: `involvedObject.name=${name},involvedObject.kind=Pod` }),
    ]);
    const pod = podRes?.status === "fulfilled" ? extractBody(podRes.value) : null;
    if (!pod) throw new Error(`Pod ${namespace}/${name} not found`);
    const events = eventsRes?.status === "fulfilled" ? extractItems(eventsRes.value) : [];
    return { pod, events };
  },

  deployment: async (clients, { namespace, name }) => {
    const deployRes = await clients.apps.readNamespacedDeployment({ namespace, name });
    const deployment = extractBody(deployRes);
    const selector = deployment?.spec?.selector?.matchLabels ?? {};
    const [rsRes, podsRes, eventsRes] = await Promise.allSettled([
      clients.apps.listNamespacedReplicaSet({ namespace }),
      clients.core.listNamespacedPod({ namespace }),
      clients.events.listNamespacedEvent({ namespace }),
    ]);
    const replicaSets = extractItems(rsRes?.value).filter((rs) => {
      const l = rs?.metadata?.labels ?? {};
      return Object.entries(selector).every(([k, v]) => l[k] === v);
    });
    const pods = extractItems(podsRes?.value).filter((pod) => {
      const l = pod?.metadata?.labels ?? {};
      return Object.entries(selector).every(([k, v]) => l[k] === v);
    });
    const events = extractItems(eventsRes?.value)
      .filter((e) => e?.regarding?.name === name && e?.regarding?.kind === "Deployment")
      .sort((a, b) => new Date(b?.metadata?.creationTimestamp) - new Date(a?.metadata?.creationTimestamp));
    return { deployment, replicaSets, pods, events };
  },

  statefulset: async (clients, { namespace, name }) => {
    const ssRes = await clients.apps.readNamespacedStatefulSet({ namespace, name });
    const statefulSet = extractBody(ssRes);
    const selector = statefulSet?.spec?.selector?.matchLabels ?? {};
    const [podsRes, eventsRes] = await Promise.allSettled([
      clients.core.listNamespacedPod({ namespace }),
      clients.events.listNamespacedEvent({ namespace }),
    ]);
    const pods = extractItems(podsRes?.value).filter((pod) => {
      const l = pod?.metadata?.labels ?? {};
      return Object.entries(selector).every(([k, v]) => l[k] === v);
    });
    const events = extractItems(eventsRes?.value)
      .filter((e) => e?.regarding?.name === name && e?.regarding?.kind === "StatefulSet")
      .sort((a, b) => new Date(b?.metadata?.creationTimestamp) - new Date(a?.metadata?.creationTimestamp));
    return { statefulSet, pods, events };
  },

  daemonset: async (clients, { namespace, name }) => {
    const dsRes = await clients.apps.readNamespacedDaemonSet({ namespace, name });
    const daemonSet = extractBody(dsRes);
    const selector = daemonSet?.spec?.selector?.matchLabels ?? {};
    const [podsRes, eventsRes] = await Promise.allSettled([
      clients.core.listNamespacedPod({ namespace }),
      clients.events.listNamespacedEvent({ namespace }),
    ]);
    const pods = extractItems(podsRes?.value).filter((pod) => {
      const l = pod?.metadata?.labels ?? {};
      return Object.entries(selector).every(([k, v]) => l[k] === v);
    });
    const events = extractItems(eventsRes?.value)
      .filter((e) => e?.regarding?.name === name && e?.regarding?.kind === "DaemonSet")
      .sort((a, b) => new Date(b?.metadata?.creationTimestamp) - new Date(a?.metadata?.creationTimestamp));
    return { daemonSet, pods, events };
  },

  replicaset: async (clients, { namespace, name }) => {
    const rsRes = await clients.apps.readNamespacedReplicaSet({ namespace, name });
    const replicaSet = extractBody(rsRes);
    const selector = replicaSet?.spec?.selector?.matchLabels ?? {};
    const [podsRes, eventsRes] = await Promise.allSettled([
      clients.core.listNamespacedPod({ namespace }),
      clients.events.listNamespacedEvent({ namespace }),
    ]);
    const pods = extractItems(podsRes?.value).filter((pod) => {
      const l = pod?.metadata?.labels ?? {};
      return Object.entries(selector).every(([k, v]) => l[k] === v);
    });
    const events = extractItems(eventsRes?.value)
      .filter((e) => e?.regarding?.name === name && e?.regarding?.kind === "ReplicaSet")
      .sort((a, b) => new Date(b?.metadata?.creationTimestamp) - new Date(a?.metadata?.creationTimestamp));
    return { replicaSet, pods, events };
  },

  replicationcontroller: async (clients, { namespace, name }) => {
    const rcRes = await clients.core.readNamespacedReplicationController({ namespace, name });
    const replicationController = extractBody(rcRes);
    const selector = replicationController?.spec?.selector ?? {};
    const [podsRes, eventsRes] = await Promise.allSettled([
      clients.core.listNamespacedPod({ namespace }),
      clients.core.listNamespacedEvent({ namespace }),
    ]);
    const pods = extractItems(podsRes?.value).filter((pod) => {
      const l = pod?.metadata?.labels ?? {};
      return Object.entries(selector).every(([k, v]) => l[k] === v);
    });
    const events = extractItems(eventsRes?.value)
      .filter((e) => e?.involvedObject?.name === name && e?.involvedObject?.kind === "ReplicationController")
      .sort((a, b) => new Date(b?.metadata?.creationTimestamp) - new Date(a?.metadata?.creationTimestamp));
    return { replicationController, pods, events };
  },

  job: async (clients, { namespace, name }) => {
    const jobRes = await clients.batch.readNamespacedJob({ namespace, name });
    const job = extractBody(jobRes);
    const selector = job?.spec?.selector?.matchLabels ?? {};
    const [podsRes, eventsRes] = await Promise.allSettled([
      clients.core.listNamespacedPod({ namespace }),
      clients.events.listNamespacedEvent({ namespace }),
    ]);
    const pods = extractItems(podsRes?.value).filter((pod) => {
      const l = pod?.metadata?.labels ?? {};
      return Object.entries(selector).every(([k, v]) => l[k] === v);
    });
    const events = extractItems(eventsRes?.value)
      .filter((e) => e?.regarding?.name === name && e?.regarding?.kind === "Job")
      .sort((a, b) => new Date(b?.metadata?.creationTimestamp) - new Date(a?.metadata?.creationTimestamp));
    return { job, pods, events };
  },

  cronjob: async (clients, { namespace, name }) => {
    const cjRes = await clients.batch.readNamespacedCronJob({ namespace, name });
    const cronJob = extractBody(cjRes);
    const [jobsRes, eventsRes] = await Promise.allSettled([
      clients.batch.listNamespacedJob({ namespace }),
      clients.events.listNamespacedEvent({ namespace }),
    ]);
    const jobs = extractItems(jobsRes?.value).filter((j) =>
      j?.metadata?.ownerReferences?.some((ref) => ref.kind === "CronJob" && ref.name === name),
    );
    const events = extractItems(eventsRes?.value)
      .filter((e) => e?.regarding?.name === name && e?.regarding?.kind === "CronJob")
      .sort((a, b) => new Date(b?.metadata?.creationTimestamp) - new Date(a?.metadata?.creationTimestamp));
    return { cronJob, jobs, events };
  },

  node: async (clients, { name }) => {
    const [nodeRes, podsRes, eventsRes] = await Promise.allSettled([
      clients.core.readNode({ name }),
      clients.core.listPodForAllNamespaces({ fieldSelector: `spec.nodeName=${name}` }),
      clients.core.listEventForAllNamespaces({ fieldSelector: `involvedObject.name=${name},involvedObject.kind=Node` }),
    ]);
    const node = nodeRes?.status === "fulfilled" ? extractBody(nodeRes.value) : null;
    if (!node) throw new Error(`Node ${name} not found`);
    const pods = podsRes?.status === "fulfilled" ? extractItems(podsRes.value) : [];
    const events = (eventsRes?.status === "fulfilled" ? extractItems(eventsRes.value) : [])
      .sort((a, b) => new Date(b?.metadata?.creationTimestamp) - new Date(a?.metadata?.creationTimestamp));
    return { node, pods, events };
  },

  namespace: async (clients, { name }) => {
    const [nsRes, podsRes, quotasRes, limitsRes, deploymentsRes, servicesRes, configMapsRes, secretsRes, daemonSetsRes, statefulSetsRes, replicaSetsRes, jobsRes, cronJobsRes, ingressesRes] = await Promise.allSettled([
      clients.core.readNamespace({ name }),
      clients.core.listNamespacedPod({ namespace: name }),
      clients.core.listNamespacedResourceQuota({ namespace: name }),
      clients.core.listNamespacedLimitRange({ namespace: name }),
      clients.apps.listNamespacedDeployment({ namespace: name }),
      clients.core.listNamespacedService({ namespace: name }),
      clients.core.listNamespacedConfigMap({ namespace: name }),
      clients.core.listNamespacedSecret({ namespace: name }),
      clients.apps.listNamespacedDaemonSet({ namespace: name }),
      clients.apps.listNamespacedStatefulSet({ namespace: name }),
      clients.apps.listNamespacedReplicaSet({ namespace: name }),
      clients.batch.listNamespacedJob({ namespace: name }),
      clients.batch.listNamespacedCronJob({ namespace: name }),
      clients.networking.listNamespacedIngress({ namespace: name }),
    ]);
    const ns = nsRes?.status === "fulfilled" ? extractBody(nsRes.value) : null;
    if (!ns) throw new Error(`Namespace ${name} not found`);
    return {
      ns,
      pods: extractItems(podsRes?.value),
      quotas: extractItems(quotasRes?.value),
      limits: extractItems(limitsRes?.value),
      deployments: extractItems(deploymentsRes?.value),
      services: extractItems(servicesRes?.value),
      configMaps: extractItems(configMapsRes?.value),
      secrets: extractItems(secretsRes?.value),
      daemonSets: extractItems(daemonSetsRes?.value),
      statefulSets: extractItems(statefulSetsRes?.value),
      replicaSets: extractItems(replicaSetsRes?.value),
      jobs: extractItems(jobsRes?.value),
      cronJobs: extractItems(cronJobsRes?.value),
      ingresses: extractItems(ingressesRes?.value),
    };
  },

  configmap: async (clients, { namespace, name }) => {
    const [cmRes, eventsRes] = await Promise.allSettled([
      clients.core.readNamespacedConfigMap({ namespace, name }),
      clients.core.listNamespacedEvent({ namespace }),
    ]);
    const configMap = cmRes?.status === "fulfilled" ? extractBody(cmRes.value) : null;
    if (!configMap) throw new Error(`ConfigMap ${namespace}/${name} not found`);
    const events = (eventsRes?.status === "fulfilled" ? extractItems(eventsRes.value) : [])
      .filter((e) => e?.involvedObject?.name === name && e?.involvedObject?.kind === "ConfigMap");
    return { configMap, events };
  },

  secret: async (clients, { namespace, name }) => {
    const [secretRes, eventsRes] = await Promise.allSettled([
      clients.core.readNamespacedSecret({ namespace, name }),
      clients.core.listNamespacedEvent({ namespace }),
    ]);
    const secret = secretRes?.status === "fulfilled" ? extractBody(secretRes.value) : null;
    if (!secret) throw new Error(`Secret ${namespace}/${name} not found`);
    const events = (eventsRes?.status === "fulfilled" ? extractItems(eventsRes.value) : [])
      .filter((e) => e?.involvedObject?.name === name && e?.involvedObject?.kind === "Secret");
    return { secret, events };
  },

  resourcequota: async (clients, { namespace, name }) => {
    const [rqRes, eventsRes] = await Promise.allSettled([
      clients.core.readNamespacedResourceQuota({ namespace, name }),
      clients.core.listNamespacedEvent({ namespace }),
    ]);
    const resourceQuota = rqRes?.status === "fulfilled" ? extractBody(rqRes.value) : null;
    if (!resourceQuota) throw new Error(`ResourceQuota ${namespace}/${name} not found`);
    const events = (eventsRes?.status === "fulfilled" ? extractItems(eventsRes.value) : [])
      .filter((e) => e?.involvedObject?.name === name);
    return { resourceQuota, events };
  },

  limitrange: async (clients, { namespace, name }) => {
    const [lrRes, eventsRes] = await Promise.allSettled([
      clients.core.readNamespacedLimitRange({ namespace, name }),
      clients.core.listNamespacedEvent({ namespace }),
    ]);
    const limitRange = lrRes?.status === "fulfilled" ? extractBody(lrRes.value) : null;
    if (!limitRange) throw new Error(`LimitRange ${namespace}/${name} not found`);
    const events = (eventsRes?.status === "fulfilled" ? extractItems(eventsRes.value) : [])
      .filter((e) => e?.involvedObject?.name === name);
    return { limitRange, events };
  },

  service: async (clients, { namespace, name }) => {
    const [svcRes, epRes, podsRes, eventsRes] = await Promise.allSettled([
      clients.core.readNamespacedService({ namespace, name }),
      clients.core.readNamespacedEndpoints({ namespace, name }),
      clients.core.listNamespacedPod({ namespace }),
      clients.core.listNamespacedEvent({ namespace }),
    ]);
    const service = svcRes?.status === "fulfilled" ? extractBody(svcRes.value) : null;
    if (!service) throw new Error(`Service ${namespace}/${name} not found`);
    const endpoints = epRes?.status === "fulfilled" ? extractBody(epRes.value) : null;
    const selector = service?.spec?.selector ?? {};
    const podsUsingService = extractItems(podsRes?.value).filter((pod) => {
      if (!Object.keys(selector).length) return false;
      const l = pod?.metadata?.labels ?? {};
      return Object.entries(selector).every(([k, v]) => l[k] === v);
    });
    const events = (eventsRes?.status === "fulfilled" ? extractItems(eventsRes.value) : [])
      .filter((e) => e?.involvedObject?.name === name && e?.involvedObject?.kind === "Service");
    return { service, endpoints, podsUsingService, events };
  },

  endpoints: async (clients, { namespace, name }) => {
    const [epRes, eventsRes] = await Promise.allSettled([
      clients.core.readNamespacedEndpoints({ namespace, name }),
      clients.core.listNamespacedEvent({ namespace }),
    ]);
    const endpoints = epRes?.status === "fulfilled" ? extractBody(epRes.value) : null;
    if (!endpoints) throw new Error(`Endpoints ${namespace}/${name} not found`);
    const events = (eventsRes?.status === "fulfilled" ? extractItems(eventsRes.value) : [])
      .filter((e) => e?.involvedObject?.name === name);
    return { endpoints, events };
  },

  ingress: async (clients, { namespace, name }) => {
    const [ingressRes, eventsRes] = await Promise.allSettled([
      clients.networking.readNamespacedIngress({ namespace, name }),
      clients.events.listNamespacedEvent({ namespace }),
    ]);
    const ingress = ingressRes?.status === "fulfilled" ? extractBody(ingressRes.value) : null;
    if (!ingress) throw new Error(`Ingress ${namespace}/${name} not found`);
    const events = (eventsRes?.status === "fulfilled" ? extractItems(eventsRes.value) : [])
      .filter((e) => e?.regarding?.name === name && e?.regarding?.kind === "Ingress");
    return { ingress, events };
  },

  ingressclass: async (clients, { name }) => {
    const [icRes, eventsRes] = await Promise.allSettled([
      clients.networking.readIngressClass({ name }),
      clients.events.listEventForAllNamespaces(),
    ]);
    const ingressClass = icRes?.status === "fulfilled" ? extractBody(icRes.value) : null;
    if (!ingressClass) throw new Error(`IngressClass ${name} not found`);
    const events = (eventsRes?.status === "fulfilled" ? extractItems(eventsRes.value) : [])
      .filter((e) => e?.regarding?.name === name && e?.regarding?.kind === "IngressClass");
    return { ingressClass, events };
  },

  networkpolicy: async (clients, { namespace, name }) => {
    const [npRes, eventsRes] = await Promise.allSettled([
      clients.networking.readNamespacedNetworkPolicy({ namespace, name }),
      clients.events.listNamespacedEvent({ namespace }),
    ]);
    const networkPolicy = npRes?.status === "fulfilled" ? extractBody(npRes.value) : null;
    if (!networkPolicy) throw new Error(`NetworkPolicy ${namespace}/${name} not found`);
    const events = (eventsRes?.status === "fulfilled" ? extractItems(eventsRes.value) : [])
      .filter((e) => e?.regarding?.name === name && e?.regarding?.kind === "NetworkPolicy");
    return { networkPolicy, events };
  },

  pv: async (clients, { name }) => {
    const [pvRes, eventsRes, podsRes] = await Promise.allSettled([
      clients.core.readPersistentVolume({ name }),
      clients.core.listEventForAllNamespaces(),
      clients.core.listPodForAllNamespaces(),
    ]);
    const pv = pvRes?.status === "fulfilled" ? extractBody(pvRes.value) : null;
    if (!pv) throw new Error(`PersistentVolume ${name} not found`);
    const pvUID = pv?.metadata?.uid;
    const events = (eventsRes?.status === "fulfilled" ? extractItems(eventsRes.value) : [])
      .filter((e) => e?.involvedObject?.uid === pvUID);
    const claimName = pv?.spec?.claimRef?.name;
    const claimNamespace = pv?.spec?.claimRef?.namespace;
    const pods = claimName
      ? extractItems(podsRes?.value).filter((pod) =>
          pod?.metadata?.namespace === claimNamespace &&
          (pod?.spec?.volumes ?? []).some((vol) => vol?.persistentVolumeClaim?.claimName === claimName)
        )
      : [];
    return { pv, events, pods };
  },

  pvc: async (clients, { namespace, name }) => {
    const [pvcRes, podsRes, eventsRes] = await Promise.allSettled([
      clients.core.readNamespacedPersistentVolumeClaim({ namespace, name }),
      clients.core.listNamespacedPod({ namespace }),
      clients.core.listNamespacedEvent({ namespace }),
    ]);
    const pvc = pvcRes?.status === "fulfilled" ? extractBody(pvcRes.value) : null;
    if (!pvc) throw new Error(`PVC ${namespace}/${name} not found`);
    const pvcUID = pvc?.metadata?.uid;
    const pods = extractItems(podsRes?.value).filter((pod) =>
      pod?.spec?.volumes?.some((vol) => vol?.persistentVolumeClaim?.claimName === name),
    );
    const events = (eventsRes?.status === "fulfilled" ? extractItems(eventsRes.value) : [])
      .filter((e) => e?.involvedObject?.uid === pvcUID);
    return { pvc, pods, events };
  },

  storageclass: async (clients, { name }) => {
    const [scRes, pvsRes, pvcsRes, eventsRes, podsRes] = await Promise.allSettled([
      clients.storage.readStorageClass({ name }),
      clients.core.listPersistentVolume(),
      clients.core.listPersistentVolumeClaimForAllNamespaces(),
      clients.core.listEventForAllNamespaces(),
      clients.core.listPodForAllNamespaces(),
    ]);
    const storageClass = scRes?.status === "fulfilled" ? extractBody(scRes.value) : null;
    if (!storageClass) throw new Error(`StorageClass ${name} not found`);
    const pvs = extractItems(pvsRes?.value).filter((pv) => pv?.spec?.storageClassName === name);
    const pvcs = extractItems(pvcsRes?.value).filter((pvc) => pvc?.spec?.storageClassName === name);
    const events = (eventsRes?.status === "fulfilled" ? extractItems(eventsRes.value) : [])
      .filter((e) => e?.involvedObject?.name === name && e?.involvedObject?.kind === "StorageClass");
    const pvcKeys = new Set(pvcs.map((pvc) => `${pvc.metadata?.namespace}/${pvc.metadata?.name}`));
    const allPods = extractItems(podsRes?.value);
    const workloadsMap = new Map();
    allPods.forEach((pod) => {
      const usesPvc = (pod.spec?.volumes ?? []).some((vol) => {
        if (vol.persistentVolumeClaim?.claimName) {
          return pvcKeys.has(`${pod.metadata?.namespace}/${vol.persistentVolumeClaim.claimName}`);
        }
        return false;
      });
      if (!usesPvc) return;
      const ownerRefs = pod.metadata?.ownerReferences ?? [];
      if (ownerRefs.length > 0) {
        const owner = ownerRefs[0];
        const key = `${owner.kind}/${pod.metadata?.namespace}/${owner.name}`;
        if (!workloadsMap.has(key)) {
          workloadsMap.set(key, { kind: owner.kind, name: owner.name, namespace: pod.metadata?.namespace, uid: owner.uid, pods: [] });
        }
        workloadsMap.get(key).pods.push({ name: pod.metadata?.name, namespace: pod.metadata?.namespace, phase: pod.status?.phase, uid: pod.metadata?.uid });
      } else {
        const key = `Pod/${pod.metadata?.namespace}/${pod.metadata?.name}`;
        workloadsMap.set(key, { kind: "Pod", name: pod.metadata?.name, namespace: pod.metadata?.namespace, uid: pod.metadata?.uid, pods: [{ name: pod.metadata?.name, namespace: pod.metadata?.namespace, phase: pod.status?.phase, uid: pod.metadata?.uid }] });
      }
    });
    return { storageClass, pvs, pvcs, events, workloads: Array.from(workloadsMap.values()) };
  },

  role: async (clients, { namespace, name }) => {
    const [roleRes, bindingsRes, eventsRes] = await Promise.allSettled([
      clients.rbac.readNamespacedRole({ namespace, name }),
      clients.rbac.listNamespacedRoleBinding({ namespace }),
      clients.events.listNamespacedEvent({ namespace }),
    ]);
    const role = roleRes?.status === "fulfilled" ? extractBody(roleRes.value) : null;
    if (!role) throw new Error(`Role ${namespace}/${name} not found`);
    const bindings = extractItems(bindingsRes?.value).filter((rb) => rb?.roleRef?.name === name && rb?.roleRef?.kind === "Role");
    const events = (eventsRes?.status === "fulfilled" ? extractItems(eventsRes.value) : [])
      .filter((e) => e?.regarding?.name === name && e?.regarding?.kind === "Role");
    const subjects = bindings.flatMap((binding) =>
      (binding?.subjects ?? []).map((s) => ({ kind: s?.kind, name: s?.name, namespace: s?.namespace ?? namespace, bindingName: binding?.metadata?.name, bindingType: "RoleBinding", createdAt: binding?.metadata?.creationTimestamp })),
    );
    const saSubjects = subjects.filter((s) => s?.kind === "ServiceAccount");
    let podsAffected = [];
    if (saSubjects.length > 0) {
      try {
        const allPods = extractItems(await clients.core.listNamespacedPod({ namespace }));
        podsAffected = allPods
          .filter((pod) => saSubjects.some((sa) => pod?.spec?.serviceAccountName === sa?.name))
          .map((pod) => ({ name: pod?.metadata?.name, namespace: pod?.metadata?.namespace, serviceAccountName: pod?.spec?.serviceAccountName, status: pod?.status?.phase ?? "Unknown" }));
      } catch {}
    }
    const rules = role?.rules ?? [];
    const allVerbs = rules.flatMap((r) => r?.verbs ?? []);
    const allResources = rules.flatMap((r) => r?.resources ?? []);
    const DESTRUCTIVE_VERBS = ["delete", "deletecollection", "patch", "update"];
    const SENSITIVE_RESOURCES = ["secrets", "serviceaccounts", "roles", "rolebindings", "clusterroles", "clusterrolebindings"];
    const hasWildcard = allVerbs.includes("*") || allResources.includes("*");
    const hasDestructiveOnSensitive = rules.some((rule) =>
      (rule?.resources ?? []).some((r) => SENSITIVE_RESOURCES.includes(r)) && (rule?.verbs ?? []).some((v) => DESTRUCTIVE_VERBS.includes(v)),
    );
    const privilegeLevel = hasWildcard ? "Admin" : hasDestructiveOnSensitive ? "High" : allVerbs.some((v) => DESTRUCTIVE_VERBS.includes(v)) ? "Medium" : "Low";
    const riskFactors = [];
    let riskLevelStr = "Low";
    if (allVerbs.includes("*")) { riskFactors.push("wildcard-verbs"); riskLevelStr = "High"; }
    if (allResources.includes("*")) { riskFactors.push("wildcard-resources"); riskLevelStr = "High"; }
    if (allResources.includes("secrets")) { riskFactors.push("secrets-access"); if (riskLevelStr === "Low") riskLevelStr = "Medium"; }
    if (allResources.some((r) => ["roles", "rolebindings", "clusterroles", "clusterrolebindings"].includes(r))) { riskFactors.push("rbac-modification"); riskLevelStr = "High"; }
    if (bindings.length === 0) riskFactors.push("unused-role");
    if (podsAffected.length > 10) { riskFactors.push("high-pod-usage"); if (riskLevelStr === "Low") riskLevelStr = "Medium"; }
    const verbSet = new Set(allVerbs);
    const resourceSet = new Set(allResources);
    const impactSummary = { subjectsBound: subjects.length, podsRunning: podsAffected.length, hasDestructiveVerbs: [...verbSet].some((v) => DESTRUCTIVE_VERBS.includes(v)), hasWildcards: verbSet.has("*") || resourceSet.has("*"), totalResources: resourceSet.size, destructiveVerbsCount: [...verbSet].filter((v) => DESTRUCTIVE_VERBS.includes(v)).length, clusterScoped: false };
    return { role, bindings, subjects, podsAffected, privilegeLevel, riskLevel: { level: riskLevelStr, factors: riskFactors }, impactSummary, events };
  },

  rolebinding: async (clients, { namespace, name }) => {
    const [rbRes, eventsRes] = await Promise.allSettled([
      clients.rbac.readNamespacedRoleBinding({ namespace, name }),
      clients.events.listNamespacedEvent({ namespace }),
    ]);
    const roleBinding = rbRes?.status === "fulfilled" ? extractBody(rbRes.value) : null;
    if (!roleBinding) throw new Error(`RoleBinding ${namespace}/${name} not found`);
    let role = null;
    const roleRef = roleBinding?.roleRef;
    if (roleRef) {
      try {
        if (roleRef.kind === "ClusterRole") {
          role = extractBody(await clients.rbac.readClusterRole({ name: roleRef.name }));
        } else {
          role = extractBody(await clients.rbac.readNamespacedRole({ namespace, name: roleRef.name }));
        }
      } catch {}
    }
    const events = (eventsRes?.status === "fulfilled" ? extractItems(eventsRes.value) : [])
      .filter((e) => e?.regarding?.name === name && e?.regarding?.kind === "RoleBinding");
    return { roleBinding, role, events };
  },

  clusterrole: async (clients, { name }) => {
    const [crRes, eventsRes] = await Promise.allSettled([
      clients.rbac.readClusterRole({ name }),
      clients.events.listEventForAllNamespaces(),
    ]);
    const clusterRole = crRes?.status === "fulfilled" ? extractBody(crRes.value) : null;
    if (!clusterRole) throw new Error(`ClusterRole ${name} not found`);
    const events = (eventsRes?.status === "fulfilled" ? extractItems(eventsRes.value) : [])
      .filter((e) => e?.regarding?.name === name && e?.regarding?.kind === "ClusterRole");
    return { clusterRole, events };
  },

  clusterrolebinding: async (clients, { name }) => {
    const [crbRes, eventsRes] = await Promise.allSettled([
      clients.rbac.readClusterRoleBinding({ name }),
      clients.events.listEventForAllNamespaces(),
    ]);
    const clusterRoleBinding = crbRes?.status === "fulfilled" ? extractBody(crbRes.value) : null;
    if (!clusterRoleBinding) throw new Error(`ClusterRoleBinding ${name} not found`);
    const events = (eventsRes?.status === "fulfilled" ? extractItems(eventsRes.value) : [])
      .filter((e) => e?.regarding?.name === name && e?.regarding?.kind === "ClusterRoleBinding");
    return { clusterRoleBinding, events };
  },

  serviceaccount: async (clients, { namespace, name }) => {
    const [saRes, rbRes, crbRes, podsRes, eventsRes] = await Promise.allSettled([
      clients.core.readNamespacedServiceAccount({ namespace, name }),
      clients.rbac.listNamespacedRoleBinding({ namespace }),
      clients.rbac.listClusterRoleBinding(),
      clients.core.listNamespacedPod({ namespace }),
      clients.events.listNamespacedEvent({ namespace }),
    ]);
    const serviceAccount = saRes?.status === "fulfilled" ? extractBody(saRes.value) : null;
    if (!serviceAccount) throw new Error(`ServiceAccount ${namespace}/${name} not found`);
    const roleBindings = extractItems(rbRes?.value)
      .filter((rb) => rb?.subjects?.some((s) => s.kind === "ServiceAccount" && s.name === name && s.namespace === namespace))
      .map((rb) => ({ ...rb, kind: "RoleBinding" }));
    const clusterRoleBindings = extractItems(crbRes?.value)
      .filter((crb) => crb?.subjects?.some((s) => s.kind === "ServiceAccount" && s.name === name && s.namespace === namespace))
      .map((crb) => ({ ...crb, kind: "ClusterRoleBinding" }));
    const podsUsingServiceAccount = extractItems(podsRes?.value).filter((pod) => pod?.spec?.serviceAccountName === name);
    const events = (eventsRes?.status === "fulfilled" ? extractItems(eventsRes.value) : [])
      .filter((e) => e?.regarding?.name === name && e?.regarding?.kind === "ServiceAccount");
    const rbRoles = await Promise.all(roleBindings.map(async (rb) => {
      try {
        const res = rb?.roleRef?.kind === "ClusterRole"
          ? await clients.rbac.readClusterRole({ name: rb.roleRef.name })
          : await clients.rbac.readNamespacedRole({ namespace, name: rb.roleRef.name });
        return extractBody(res);
      } catch { return null; }
    }));
    const crbRoles = await Promise.all(clusterRoleBindings.map(async (crb) => {
      try { return extractBody(await clients.rbac.readClusterRole({ name: crb.roleRef.name })); } catch { return null; }
    }));
    const roleBindingsWithRules = roleBindings.map((rb, i) => ({ ...rb, rules: rbRoles[i]?.rules ?? [] }));
    const clusterRoleBindingsWithRules = clusterRoleBindings.map((crb, i) => ({ ...crb, rules: crbRoles[i]?.rules ?? [] }));
    const allRules = [...rbRoles, ...crbRoles].filter(Boolean).flatMap((r) => r?.rules ?? []);
    const verbSet = new Set(); const resourceSet = new Set(); const apiGroupSet = new Set();
    allRules.forEach((rule) => { (rule?.verbs ?? []).forEach((v) => verbSet.add(v)); (rule?.resources ?? []).forEach((r) => resourceSet.add(r)); (rule?.apiGroups ?? [""]).forEach((g) => apiGroupSet.add(g)); });
    const effectivePermissions = { verbs: Array.from(verbSet), resources: Array.from(resourceSet), apiGroups: Array.from(apiGroupSet), rules: allRules };
    const hasClusterAdmin = clusterRoleBindings.some((crb) => crb?.roleRef?.name === "cluster-admin");
    const hasWildcard = effectivePermissions.verbs.includes("*") || effectivePermissions.resources.includes("*");
    const destructiveVerbs = ["delete", "deletecollection", "patch", "update"];
    const privilegeLevel = hasClusterAdmin || hasWildcard ? "Admin" : effectivePermissions.verbs.some((v) => destructiveVerbs.includes(v)) ? "High" : effectivePermissions.verbs.some((v) => ["create", "update", "patch"].includes(v)) ? "Medium" : "Low";
    let riskScore = 0; const riskFactors = [];
    if (hasClusterAdmin) { riskScore += 40; riskFactors.push("bound-to-cluster-admin"); }
    if (hasWildcard) { riskScore += 30; riskFactors.push("wildcard-permissions"); }
    if (serviceAccount?.automountServiceAccountToken !== false) { riskScore += 10; riskFactors.push("auto-mount-enabled"); }
    if (clusterRoleBindings.length > 0 && !hasClusterAdmin) { riskScore += 15; riskFactors.push("cluster-wide-access"); }
    return { serviceAccount, roleBindings: roleBindingsWithRules, clusterRoleBindings: clusterRoleBindingsWithRules, podsUsingServiceAccount, effectivePermissions, privilegeLevel, riskLevel: { level: riskScore >= 40 ? "High" : riskScore >= 15 ? "Medium" : "Low", factors: riskFactors }, events };
  },

  hpa: async (clients, { namespace, name }) => {
    const [hpaRes, eventsRes] = await Promise.allSettled([
      clients.autoscaling.readNamespacedHorizontalPodAutoscaler({ namespace, name }),
      clients.events.listNamespacedEvent({ namespace }),
    ]);
    const hpa = hpaRes?.status === "fulfilled" ? extractBody(hpaRes.value) : null;
    if (!hpa) throw new Error(`HPA ${namespace}/${name} not found`);
    const events = (eventsRes?.status === "fulfilled" ? extractItems(eventsRes.value) : [])
      .filter((e) => e?.regarding?.name === name && e?.regarding?.kind === "HorizontalPodAutoscaler");
    return { hpa, events };
  },

  priorityclass: async (clients, { name }) => {
    const [pcRes, eventsRes] = await Promise.allSettled([
      clients.scheduling.readPriorityClass({ name }),
      clients.events.listEventForAllNamespaces(),
    ]);
    const priorityClass = pcRes?.status === "fulfilled" ? extractBody(pcRes.value) : null;
    if (!priorityClass) throw new Error(`PriorityClass ${name} not found`);
    const events = (eventsRes?.status === "fulfilled" ? extractItems(eventsRes.value) : [])
      .filter((e) => e?.regarding?.name === name && e?.regarding?.kind === "PriorityClass");
    return { priorityClass, events };
  },

  csr: async (clients, { name }) => {
    const [csrRes, eventsRes] = await Promise.allSettled([
      clients.certificates.readCertificateSigningRequest({ name }),
      clients.events.listEventForAllNamespaces(),
    ]);
    const csr = csrRes?.status === "fulfilled" ? extractBody(csrRes.value) : null;
    if (!csr) throw new Error(`CSR ${name} not found`);
    const events = (eventsRes?.status === "fulfilled" ? extractItems(eventsRes.value) : [])
      .filter((e) => e?.regarding?.name === name && e?.regarding?.kind === "CertificateSigningRequest");
    return { csr, events };
  },

  crd: async (clients, { name }) => {
    const [crdRes, eventsRes] = await Promise.allSettled([
      clients.apiextensions.readCustomResourceDefinition({ name }),
      clients.events.listEventForAllNamespaces(),
    ]);
    const crd = crdRes?.status === "fulfilled" ? extractBody(crdRes.value) : null;
    if (!crd) throw new Error(`CRD ${name} not found`);
    const events = (eventsRes?.status === "fulfilled" ? extractItems(eventsRes.value) : [])
      .filter((e) => e?.regarding?.name === name && e?.regarding?.kind === "CustomResourceDefinition");
    return { crd, events };
  },
};

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type");
  const namespace = searchParams.get("namespace");
  const name = searchParams.get("name");
  const context = searchParams.get("context");

  if (!type || !name || !context) {
    return NextResponse.json({ error: "Missing required params: type, name, context" }, { status: 400 });
  }

  const handler = handlers[type.toLowerCase()];
  if (!handler) {
    return NextResponse.json({ error: `Unknown resource type: ${type}` }, { status: 400 });
  }

  try {
    const clients = getClientsFromRequest(request);
    const result = await handler(clients, { namespace, name });
    return NextResponse.json(serializeK8sObjects(result));
  } catch (err) {
    return NextResponse.json({ error: extractK8sError(err, `Failed to fetch ${type} details`) }, { status: 500 });
  }
}
