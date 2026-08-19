import { NextResponse, type NextRequest } from "next/server";

/** POST /api/parts/prices — batch M1 part prices for the admin impact view. */
export async function POST(request: NextRequest) {
  const base = process.env.API_URL;
  if (!base) return NextResponse.json({ prices: {} }, { status: 503 });
  const body = await request.json();
  try {
    const res = await fetch(`${base}/parts/prices`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    const data = await res.json().catch(() => ({ prices: {} }));
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ prices: {} }, { status: 502 });
  }
}
