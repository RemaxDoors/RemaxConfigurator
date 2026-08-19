import { NextResponse, type NextRequest } from "next/server";

/**
 * Write proxy for configurator parameter definitions.
 * PUT    /api/config/parameters   body: { configuratorId, parameter }
 * DELETE /api/config/parameters?configuratorId=..&controlName=..
 * Forwards to the Python API (config DB writes).
 */
export async function PUT(request: NextRequest) {
  const base = process.env.API_URL;
  if (!base) {
    return NextResponse.json({ error: "API_URL not set" }, { status: 503 });
  }
  const { configuratorId, parameter } = await request.json();
  try {
    const res = await fetch(
      `${base}/configurators/${encodeURIComponent(configuratorId)}/parameters`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parameter),
        cache: "no-store",
      }
    );
    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ error: "API unreachable" }, { status: 502 });
  }
}

export async function DELETE(request: NextRequest) {
  const base = process.env.API_URL;
  if (!base) {
    return NextResponse.json({ error: "API_URL not set" }, { status: 503 });
  }
  const { searchParams } = new URL(request.url);
  const configuratorId = searchParams.get("configuratorId") ?? "";
  const controlName = searchParams.get("controlName") ?? "";
  try {
    const res = await fetch(
      `${base}/configurators/${encodeURIComponent(configuratorId)}/parameters/${encodeURIComponent(controlName)}`,
      { method: "DELETE", cache: "no-store" }
    );
    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ error: "API unreachable" }, { status: 502 });
  }
}
