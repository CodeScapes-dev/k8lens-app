import { NextResponse } from "next/server";
import { getClientsFromRequest, isBlockedServerUrl } from "@/lib/k8s/client";
import https from "node:https";
import http from "node:http";

const SAFE_K8S_NAME = /^[a-z0-9][a-z0-9\-\.]{0,252}$/;

function rawGet(url, { headers = {}, agent } = {}) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const mod = parsed.protocol === "https:" ? https : http;
    const req = mod.request(
      {
        hostname: parsed.hostname,
        port: parsed.port || (parsed.protocol === "https:" ? 443 : 80),
        path: parsed.pathname + parsed.search,
        method: "GET",
        headers,
        agent,
      },
      (res) => {
        let body = "";
        res.on("data", (chunk) => { body += chunk; });
        res.on("end", () => resolve({ status: res.statusCode, body }));
      }
    );
    req.on("error", reject);
    req.end();
  });
}

export async function GET(request, { params }) {
  const { name } = await params;

  if (!SAFE_K8S_NAME.test(name)) {
    return NextResponse.json({ available: false, data: null }, { status: 400 });
  }

  try {
    const { kubeConfig } = getClientsFromRequest(request);
    const cluster = kubeConfig.getCurrentCluster();
    if (!cluster?.server) return NextResponse.json({ available: false, data: null });
    if (isBlockedServerUrl(cluster.server)) return NextResponse.json({ available: false, data: null });

    const url = `${cluster.server}/api/v1/nodes/${name}/proxy/stats/summary`;
    const fetchOpts = await kubeConfig.applyToFetchOptions({});
    const headers = {};
    if (fetchOpts.headers) {
      for (const [k, v] of fetchOpts.headers.entries()) headers[k] = v;
    }

    const { status, body } = await rawGet(url, { headers, agent: fetchOpts.agent });
    if (status < 200 || status >= 300) return NextResponse.json({ available: false, data: null });

    const summary = JSON.parse(body);
    const n = summary.node ?? {};

    const data = {
      cpu: n.cpu ? { usageNanoCores: n.cpu.usageNanoCores ?? null } : null,
      memory: n.memory
        ? { workingSetBytes: n.memory.workingSetBytes ?? null, rssBytes: n.memory.rssBytes ?? null }
        : null,
      network: n.network
        ? {
            interfaces: (n.network.interfaces ?? []).map((iface) => ({
              name: iface.name,
              rxBytes: iface.rxBytes ?? null,
              txBytes: iface.txBytes ?? null,
              rxErrors: iface.rxErrors ?? null,
              txErrors: iface.txErrors ?? null,
            })),
          }
        : null,
      fs: n.fs
        ? {
            capacityBytes: n.fs.capacityBytes ?? null,
            usedBytes: n.fs.usedBytes ?? null,
            inodesFree: n.fs.inodesFree ?? null,
          }
        : null,
      pods: (summary.pods ?? []).map((pod) => ({
        podRef: {
          name: pod.podRef?.name ?? null,
          namespace: pod.podRef?.namespace ?? null,
          uid: pod.podRef?.uid ?? null,
        },
        cpu: pod.cpu ? { usageNanoCores: pod.cpu.usageNanoCores ?? null } : null,
        memory: pod.memory ? { workingSetBytes: pod.memory.workingSetBytes ?? null } : null,
        network: pod.network
          ? {
              interfaces: (pod.network.interfaces ?? []).map((iface) => ({
                name: iface.name,
                rxBytes: iface.rxBytes ?? null,
                txBytes: iface.txBytes ?? null,
              })),
            }
          : null,
        volume: (pod.volume ?? []).map((vol) => ({
          name: vol.name,
          pvcRef: vol.pvcRef ? { name: vol.pvcRef.name, namespace: vol.pvcRef.namespace } : null,
          capacityBytes: vol.capacityBytes ?? null,
          usedBytes: vol.usedBytes ?? null,
          inodesFree: vol.inodesFree ?? null,
        })),
        containers: (pod.containers ?? []).map((c) => ({
          name: c.name,
          cpu: c.cpu ? { usageNanoCores: c.cpu.usageNanoCores ?? null } : null,
          memory: c.memory ? { workingSetBytes: c.memory.workingSetBytes ?? null } : null,
          rootfs: c.rootfs ? { usedBytes: c.rootfs.usedBytes ?? null } : null,
          logs: c.logs ? { usedBytes: c.logs.usedBytes ?? null } : null,
        })),
      })),
    };

    return NextResponse.json({ available: true, data });
  } catch {
    return NextResponse.json({ available: false, data: null });
  }
}
