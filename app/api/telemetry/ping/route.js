import { NextResponse } from "next/server";
import { sendTelemetry } from "@/lib/telemetry/sender";

export async function POST(request) {
  let hint = null;
  try { hint = await request.json(); } catch {}
  sendTelemetry(hint?.clusters ?? null).catch(() => {});
  return NextResponse.json({ ok: true });
}
