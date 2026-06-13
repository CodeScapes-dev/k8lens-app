import { createHmac } from "node:crypto";
import { getOrCreateState, updateLastPing } from "./state.js";
import { collectPayload } from "./collector.js";
import { findNonce } from "./pow.js";

const ENDPOINT = process.env.TELEMETRY_ENDPOINT || "https://telemetry.k8lens.dev/v1/ping";
const HMAC_SECRET = process.env.TELEMETRY_HMAC_SECRET || "";
const POW_DIFFICULTY = parseInt(process.env.TELEMETRY_POW_DIFFICULTY || "16", 10);
const ONE_HOUR = 60 * 60 * 1000;

export async function sendTelemetry(clusterHint = null) {
  if (process.env.TELEMETRY_DISABLED === "true") return;

  try {
    const state = await getOrCreateState();
    const lastPing = state.lastPingAt ? new Date(state.lastPingAt).getTime() : 0;
    if (Date.now() - lastPing < ONE_HOUR) return;

    const { meta, clusters } = await collectPayload(state.installId, state.firstSeenAt, clusterHint);

    // Don't throttle if we have no cluster data — allow a retry when browser sends hint
    if (clusters.count === 0 && !clusterHint) return;

    const canonical = JSON.stringify({ meta, clusters });

    const pow = findNonce(canonical, POW_DIFFICULTY);
    const signature = sign(canonical + pow.nonce + pow.hash);

    const payload = { meta, clusters, pow: { ...pow, difficulty: POW_DIFFICULTY }, signature };

    await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-K8Lens-Token": HMAC_SECRET,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10000),
    });

    const stored = { meta, clusters, pow: { difficulty: POW_DIFFICULTY, nonce: pow.nonce } };
    await updateLastPing(meta.pingAt, stored);
  } catch {
    // fail silently — telemetry must never affect app availability
  }
}

function sign(data) {
  return "hmac-sha256:" + createHmac("sha256", HMAC_SECRET).update(data).digest("hex");
}
