import { NextResponse, type NextRequest } from "next/server";

/**
 * Configuration change log, newest first.
 *
 * `available: false` means the table is missing, which is different from
 * "nothing has changed" — the API keeps them apart on purpose because
 * _log_change() swallows its own failures, so a database that is not recording
 * anything looks exactly like a quiet one.
 */
export async function GET(request: NextRequest) {
  const base = process.env.API_URL;
  if (!base) {
    return NextResponse.json({ error: "API_URL not set" }, { status: 503 });
  }
  const limit = new URL(request.url).searchParams.get("limit") ?? "50";
  try {
    const res = await fetch(
      `${base}/status/changes?limit=${encodeURIComponent(limit)}`,
      { cache: "no-store" }
    );
    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ error: "API unreachable" }, { status: 502 });
  }
}
