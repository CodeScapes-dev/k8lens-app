import { NextResponse } from "next/server";
import { sendTelemetry } from "@/lib/telemetry/sender";

export async function POST() {
  sendTelemetry().catch(() => {});
  return NextResponse.json({ ok: true });
}
