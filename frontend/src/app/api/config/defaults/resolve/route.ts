import { NextResponse, type NextRequest } from "next/server";

/** POST /api/config/defaults/resolve — defaults for the current selection. */
export async function POST(request: NextRequest) {
  const base = process.env.API_URL;
  if (!base) return NextResponse.json({ defaults: {} }, { status: 503 });
  const body = await request.json();
  try {
    const res = await fetch(`${base}/defaults/resolve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    const data = await res.json().catch(() => ({ defaults: {} }));
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ defaults: {} }, { status: 502 });
  }
}
