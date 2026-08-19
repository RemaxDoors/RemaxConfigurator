import { NextResponse, type NextRequest } from "next/server";

/**
 * Save a configurator's rule set to the config DB.
 * POST /api/config/rules/replace  body: { configuratorId, rules, changedBy? }
 */
export async function POST(request: NextRequest) {
  const base = process.env.API_URL;
  if (!base) {
    return NextResponse.json({ error: "API_URL not set" }, { status: 503 });
  }
  const { configuratorId, rules, changedBy } = await request.json();
  try {
    const res = await fetch(
      `${base}/configurators/${encodeURIComponent(configuratorId)}/rules/replace`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rules, changedBy }),
        cache: "no-store",
      }
    );
    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ error: "API unreachable" }, { status: 502 });
  }
}
