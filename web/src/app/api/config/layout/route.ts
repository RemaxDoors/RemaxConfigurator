import { NextResponse, type NextRequest } from "next/server";

/**
 * Move parameters between form sections and reorder them (drag-and-drop).
 * POST /api/config/layout
 *   body: { configuratorId, items: [{controlName, section}], changedBy? }
 *
 * Writes Section + SortOrder only — never options, labels or bounds.
 */
export async function POST(request: NextRequest) {
  const base = process.env.API_URL;
  if (!base) {
    return NextResponse.json({ error: "API_URL not set" }, { status: 503 });
  }
  const { configuratorId, items, changedBy } = await request.json();
  try {
    const res = await fetch(
      `${base}/configurators/${encodeURIComponent(configuratorId)}/layout`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items, changedBy }),
        cache: "no-store",
      }
    );
    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ error: "API unreachable" }, { status: 502 });
  }
}
