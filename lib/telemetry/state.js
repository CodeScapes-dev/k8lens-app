import { readFile, writeFile, mkdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { join } from "node:path";

const STATE_FILE = join(process.cwd(), "data", "telemetry-state.json");

export async function getOrCreateState() {
  try {
    const raw = await readFile(STATE_FILE, "utf8");
    return JSON.parse(raw);
  } catch {
    const state = {
      installId: randomUUID(),
      firstSeenAt: new Date().toISOString(),
      lastPingAt: null,
      lastPayload: null,
    };
    await mkdir(join(process.cwd(), "data"), { recursive: true });
    await writeFile(STATE_FILE, JSON.stringify(state, null, 2), "utf8");
    return state;
  }
}

export async function updateLastPing(isoString, payload) {
  const state = await getOrCreateState();
  const updated = { ...state, lastPingAt: isoString, lastPayload: payload };
  await writeFile(STATE_FILE, JSON.stringify(updated, null, 2), "utf8");
}
