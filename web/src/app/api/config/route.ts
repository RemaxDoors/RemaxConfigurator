import { NextResponse, type NextRequest } from "next/server";

import { MOCK_CONFIGURATORS } from "@/lib/mock-configurators";
import { MOCK_RULES } from "@/lib/mock-rules";

/**
 * Server-side proxy to the Python API (set API_URL). Returns the configurators +
 * rules from Python, or falls back to the bundled mock so the frontend still runs
 * standalone.
 */
export async function GET() {
  const base = process.env.API_URL;
  if (base) {
    try {
      const [cRes, rRes] = await Promise.all([
        fetch(`${base}/configurators`, { cache: "no-store" }),
        fetch(`${base}/rules`, { cache: "no-store" }),
      ]);
      if (cRes.ok && rRes.ok) {
        const configurators = (await cRes.json()).configurators;
        const rules = (await rRes.json()).rules;
        return NextResponse.json({ configurators, rules, source: "api" });
      }
    } catch {
      // fall through to mock
    }
  }
  return NextResponse.json({
    configurators: MOCK_CONFIGURATORS,
    rules: MOCK_RULES,
    source: "mock",
  });
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
