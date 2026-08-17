import { NextResponse, type NextRequest } from "next/server";

/** GET /api/m1/parts?search=term — search M1 parts (server-side). */
export async function GET(request: NextRequest) {
  const base = process.env.API_URL;
  const term = new URL(request.url).searchParams.get("search") ?? "";
  if (!base) {
    return NextResponse.json({ parts: [] }, { status: 200 });
  }
  try {
    const res = await fetch(`${base}/parts?search=${encodeURIComponent(term)}`, {
      cache: "no-store",
    });
    const data = await res.json().catch(() => ({ parts: [] }));
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ parts: [] }, { status: 502 });
  }
}
