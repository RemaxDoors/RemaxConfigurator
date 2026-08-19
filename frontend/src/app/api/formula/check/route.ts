import { NextResponse, type NextRequest } from "next/server";

/** POST /api/formula/check — validate a formula and preview its result. */
export async function POST(request: NextRequest) {
  const base = process.env.API_URL;
  if (!base) return NextResponse.json({ ok: false, error: "API_URL not set" });
  const body = await request.json();
  try {
    const res = await fetch(`${base}/formula/check`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    return NextResponse.json(await res.json().catch(() => ({ ok: false })));
  } catch {
    return NextResponse.json({ ok: false, error: "API unreachable" });
  }
}
