import { NextResponse } from "next/server";

/** GET /api/config/links — parent -> child configurator relationships. */
export async function GET() {
  const base = process.env.API_URL;
  if (!base) return NextResponse.json({ links: [] }, { status: 503 });
  try {
    const res = await fetch(`${base}/configurator-links`, { cache: "no-store" });
    const data = await res.json().catch(() => ({ links: [] }));
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ links: [] }, { status: 502 });
  }
}
