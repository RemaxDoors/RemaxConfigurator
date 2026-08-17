import { NextResponse, type NextRequest } from "next/server";

/** GET /api/m1/columns?table=Quotes — column metadata for an M1 table. */
export async function GET(request: NextRequest) {
  const base = process.env.API_URL;
  const table = new URL(request.url).searchParams.get("table") ?? "";
  if (!base) return NextResponse.json({ columns: [] }, { status: 503 });
  try {
    const res = await fetch(`${base}/m1/columns?table=${encodeURIComponent(table)}`, {
      cache: "no-store",
    });
    const data = await res.json().catch(() => ({ columns: [] }));
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ columns: [] }, { status: 502 });
  }
}
