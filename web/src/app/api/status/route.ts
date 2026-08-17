import { NextResponse } from "next/server";

/** GET /api/status — API + database health and data counts. */
export async function GET() {
  const base = process.env.API_URL;
  if (!base) {
    return NextResponse.json(
      { ok: false, checks: [{ name: "API", ok: false, ms: 0, error: "API_URL not set in web/.env" }], configurators: [], warnings: [] },
      { status: 200 }
    );
  }
  try {
    const res = await fetch(`${base}/status`, { cache: "no-store" });
    return NextResponse.json(await res.json());
  } catch {
    return NextResponse.json({
      ok: false,
      checks: [{ name: "API", ok: false, ms: 0, error: `Cannot reach the Python API at ${base}. Is it running?` }],
      configurators: [],
      warnings: [],
    });
  }
}
