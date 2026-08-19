import { NextResponse, type NextRequest } from "next/server";

/**
 * Proxies POST /validate to the Python API. If the API isn't reachable, returns
 * is_valid=true with `unavailable` so the UI can proceed but flag that validation
 * was skipped.
 */
export async function POST(request: NextRequest) {
  const base = process.env.API_URL;
  const body = await request.json();

  if (!base) {
    return NextResponse.json({
      errors: [],
      warnings: [],
      is_valid: true,
      unavailable: true,
    });
  }

  try {
    const res = await fetch(`${base}/validate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.ok ? 200 : res.status });
  } catch {
    return NextResponse.json({
      errors: [],
      warnings: [],
      is_valid: true,
      unavailable: true,
    });
  }
}
