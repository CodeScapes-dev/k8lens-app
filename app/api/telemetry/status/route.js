import { NextResponse } from "next/server";
import { getOrCreateState } from "@/lib/telemetry/state";

export async function GET() {
  const state = await getOrCreateState();
  return NextResponse.json({
    enabled: process.env.TELEMETRY_DISABLED !== "true",
    installId: state.installId,
    firstSeenAt: state.firstSeenAt,
    lastPingAt: state.lastPingAt ?? null,
    lastPayload: state.lastPayload ?? null,
  });
}
