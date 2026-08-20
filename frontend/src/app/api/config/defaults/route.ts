import { NextResponse, type NextRequest } from "next/server";

/**
 * Update ONE default's value.
 *
 * Separate from defaults/replace, which is the bulk CSV path: that one deletes
 * the whole set and re-inserts, dropping Priority / ValueFormula / IsManual /
 * ParentPartID and failing outright on any row a condition references. A
 * single-value edit routes here instead so none of that is in play.
 */
export async function PUT(request: NextRequest) {
  const base = process.env.API_URL;
  if (!base) {
    return NextResponse.json({ error: "API_URL not set" }, { status: 503 });
  }
  const body = await request.json();
  const { configuratorId, ...rest } = body ?? {};
  if (!configuratorId) {
    return NextResponse.json(
      { error: "configuratorId is required" },
      { status: 400 }
    );
  }
  try {
    const res = await fetch(
      `${base}/configurators/${encodeURIComponent(configuratorId)}/defaults`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(rest),
        cache: "no-store",
      }
    );
    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ error: "API unreachable" }, { status: 502 });
  }
}
