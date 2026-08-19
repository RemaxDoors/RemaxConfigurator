import { NextResponse, type NextRequest } from "next/server";

/**
 * Server-side proxy to the Python API (set API_URL) for configurators + rules.
 *
 * No fallback. A bundled or empty stand-in here would swallow the API's own
 * 503 and present an empty configurator as though it were real, which is how
 * someone ends up quoting against parameters that do not exist.
 */
export async function GET() {
  const base = process.env.API_URL;
  if (!base) {
    return NextResponse.json({ error: "API_URL not set" }, { status: 503 });
  }
  try {
    const [cRes, rRes] = await Promise.all([
      fetch(`${base}/configurators`, { cache: "no-store" }),
      fetch(`${base}/rules`, { cache: "no-store" }),
    ]);
    if (!cRes.ok || !rRes.ok) {
      const failed = !cRes.ok ? cRes : rRes;
      const detail = await failed
        .json()
        .then((d) => d.detail || d.error)
        .catch(() => null);
      return NextResponse.json(
        { error: detail || `Config API returned ${failed.status}.` },
        { status: failed.status === 503 ? 503 : 502 }
      );
    }
    const configurators = (await cRes.json()).configurators;
    const rules = (await rRes.json()).rules;
    return NextResponse.json({ configurators, rules, source: "api" });
  } catch {
    return NextResponse.json(
      { error: "Config API unreachable." },
      { status: 502 }
    );
  }
}

/** Create a new configurator template. Proxies to Python POST /configurators. */
export async function POST(request: NextRequest) {
  const base = process.env.API_URL;
  if (!base) {
    return NextResponse.json({ error: "API_URL not set" }, { status: 503 });
  }
  const body = await request.json();
  try {
    const res = await fetch(`${base}/configurators`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ error: "API unreachable" }, { status: 502 });
  }
}
