import { NextResponse, type NextRequest } from "next/server";

/** GET /api/m1/locations?organizationId=ABC — ship-to locations from M1. */
export async function GET(request: NextRequest) {
  const base = process.env.API_URL;
  const org = new URL(request.url).searchParams.get("organizationId") ?? "";
  if (!base) {
    return NextResponse.json({ results: [], error: "API_URL is not set." }, { status: 503 });
  }
  try {
    const res = await fetch(
      `${base}/locations?organizationId=${encodeURIComponent(org)}`,
      { cache: "no-store" }
    );
    const data = await res.json().catch(() => ({ results: [] }));
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json(
      { results: [], error: "Python API unreachable." },
      { status: 502 }
    );
  }
}
