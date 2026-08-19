import { NextResponse } from "next/server";

/** GET /api/status/endpoints — the API's endpoint reference. */
export async function GET() {
  const base = process.env.API_URL;
  if (!base) return NextResponse.json({ endpoints: [], count: 0 });
  try {
    const res = await fetch(`${base}/status/endpoints`, { cache: "no-store" });
    return NextResponse.json(await res.json());
  } catch {
    return NextResponse.json({ endpoints: [], count: 0 });
  }
}
