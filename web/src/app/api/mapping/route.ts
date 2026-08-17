import { NextResponse, type NextRequest } from "next/server";

/** GET/PUT the app-field → M1-column mappings (proxied to the Python API). */
export async function GET() {
  const base = process.env.API_URL;
  if (!base) return NextResponse.json({ mappings: [] }, { status: 503 });
  try {
    const res = await fetch(`${base}/mapping`, { cache: "no-store" });
    const data = await res.json().catch(() => ({ mappings: [] }));
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ mappings: [] }, { status: 502 });
  }
}

export async function PUT(request: NextRequest) {
  const base = process.env.API_URL;
  if (!base) return NextResponse.json({ error: "API_URL not set" }, { status: 503 });
  const body = await request.json();
  try {
    const res = await fetch(`${base}/mapping`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ error: "API unreachable" }, { status: 502 });
  }
}
