import { NextResponse } from "next/server";
import { getClientsFromRequest } from "@/lib/k8s/client";
import { extractK8sError } from "@/lib/k8s/utils";
import https from "node:https";
import http from "node:http";

function rawGet(url, { headers = {}, agent } = {}) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const mod = parsed.protocol === "https:" ? https : http;
    const reqOpts = {
      hostname: parsed.hostname,
      port: parsed.port || (parsed.protocol === "https:" ? 443 : 80),
      path: parsed.pathname + parsed.search,
      method: "GET",
      headers,
      agent,
    };
    const req = mod.request(reqOpts, (res) => {
      let body = "";
      res.on("data", (chunk) => { body += chunk; });
      res.on("end", () => resolve({ status: res.statusCode, body }));
    });
    req.on("error", reject);
    req.end();
  });
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const namespace = searchParams.get("namespace");
  const pod = searchParams.get("pod");
  const container = searchParams.get("container");
  const tailLines = parseInt(searchParams.get("tailLines") || "100", 10);
  const timestamps = searchParams.get("timestamps") === "true";
  const context = searchParams.get("context");

  if (!namespace || !pod || !context) {
    return NextResponse.json({ error: "Missing required params: namespace, pod, context" }, { status: 400 });
  }

  try {
    const clients = getClientsFromRequest(request);
    const kc = clients.kubeConfig;
    const cluster = kc.getCurrentCluster();
    if (!cluster?.server) {
      return NextResponse.json({ error: "No cluster server configured" }, { status: 500 });
    }

    const logParams = new URLSearchParams({ tailLines: String(tailLines) });
    if (container) logParams.set("container", container);
    if (timestamps) logParams.set("timestamps", "true");
    const url = `${cluster.server}/api/v1/namespaces/${namespace}/pods/${pod}/log?${logParams}`;

    const fetchOpts = await kc.applyToFetchOptions({});
    const headers = {};
    if (fetchOpts.headers) {
      for (const [k, v] of fetchOpts.headers.entries()) {
        headers[k] = v;
      }
    }

    const { status, body } = await rawGet(url, { headers, agent: fetchOpts.agent });

    if (status >= 200 && status < 300) {
      return NextResponse.json({ logs: body });
    }

    let message = "Failed to fetch logs";
    try {
      const json = JSON.parse(body);
      message = json.message || message;
    } catch {}

    if (status === 400) return NextResponse.json({ error: message }, { status: 400 });
    if (status === 404) return NextResponse.json({ error: "Pod or container not found" }, { status: 404 });
    return NextResponse.json({ error: message }, { status: 500 });
  } catch (err) {
    return NextResponse.json({ error: extractK8sError(err, "Failed to fetch logs") }, { status: 500 });
  }
}
