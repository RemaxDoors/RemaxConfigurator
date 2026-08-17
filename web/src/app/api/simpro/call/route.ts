import { NextResponse, type NextRequest } from "next/server";

/**
 * GET /api/simpro/call?endpoint=/customers/?search=woolworths
 *
 * Calls `${SIMPRO_BASE_URL}${endpoint}` server-side with the Simpro token, so the
 * token never reaches the browser. You choose the endpoint path from the UI.
 *
 * Env (web/.env or web/.env.local — both gitignored):
 *   SIMPRO_BASE_URL   e.g. https://<company>.simprosuite.com/api/v1.0/companies/4
 *   SIMPRO_API_TOKEN  your Simpro access token
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const endpoint = (searchParams.get("endpoint") ?? "").trim();

  // Only allow a relative path (guards against pointing the token at another host).
  if (
    !endpoint.startsWith("/") ||
    endpoint.startsWith("//") ||
    endpoint.includes("://")
  ) {
    return NextResponse.json(
      {
        ok: false,
        status: 400,
        configured: true,
        url: endpoint,
        data: null,
        error: "Endpoint must be a path beginning with '/', e.g. /customers/",
      },
      { status: 400 }
    );
  }

  const base = process.env.SIMPRO_BASE_URL;
  const token = process.env.SIMPRO_API_TOKEN;

  if (!base || !token) {
    return NextResponse.json({
      ok: false,
      status: 0,
      configured: false,
      url: endpoint,
      data: null,
      error:
        "Set SIMPRO_BASE_URL and SIMPRO_API_TOKEN in web/.env and restart the dev server.",
    });
  }

  const url = `${base}${endpoint}`;

  try {
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
      cache: "no-store",
    });
    const text = await res.text();
    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
    // `url` here is base + endpoint; the token is only in the header, never returned.
    return NextResponse.json({ ok: res.ok, status: res.status, url, data, configured: true });
  } catch (err) {
    return NextResponse.json({
      ok: false,
      status: 0,
      configured: true,
      url,
      data: null,
      error: err instanceof Error ? err.message : "Request failed",
    });
  }
}
