import { NextResponse, type NextRequest } from "next/server";

/**
 * Bulk-replace a configurator's parameter set (CSV import).
 * POST /api/config/parameters/replace
 *   body: { configuratorId, parameters: [{controlName,label,kind}], changedBy? }
 */
export async function POST(request: NextRequest) {
  const base = process.env.API_URL;
  if (!base) {
    return NextResponse.json({ error: "API_URL not set" }, { status: 503 });
  }
  const { configuratorId, parameters, changedBy } = await request.json();
  try {
    const res = await fetch(
      `${base}/configurators/${encodeURIComponent(configuratorId)}/parameters/replace`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parameters, changedBy }),
        cache: "no-store",
      }
    );
    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ error: "API unreachable" }, { status: 502 });
  }
}
