import { NextResponse, type NextRequest } from "next/server";

/**
 * Rename a configurator, or change its revision.
 *
 * partRevision feeds M1's form id — PART-{PartID}-REV-{revision} — so getting
 * it wrong means configurator values land under an id M1 does not recognise.
 * An empty string is a real value (curtain and installation both have one) and
 * must survive the round trip, so nothing here coerces it away.
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
      `${base}/configurators/${encodeURIComponent(configuratorId)}`,
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
