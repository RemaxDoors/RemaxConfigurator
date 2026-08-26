import { NextResponse } from "next/server";

/**
 * Lead sources and quoters for the quote header dropdowns.
 *
 * Both in one call: the header needs them together, and two round trips would
 * let the page render with one dropdown populated and the other empty.
 *
 * Read-only. Neither list is cached — a salesperson joining or a marketing
 * programme being retired should show up on the next page load, not after a
 * deploy.
 */
export async function GET() {
  const base = process.env.API_URL;
  if (!base) {
    return NextResponse.json({ error: "API_URL not set" }, { status: 503 });
  }
  try {
    const [ls, qs] = await Promise.all([
      fetch(`${base}/lead-sources`, { cache: "no-store" }),
      fetch(`${base}/quoters`, { cache: "no-store" }),
    ]);
    if (!ls.ok || !qs.ok) {
      const failed = !ls.ok ? ls : qs;
      const detail = await failed
        .json()
        .then((d) => d.detail || d.error)
        .catch(() => null);
      return NextResponse.json(
        { error: detail || `M1 lookup returned ${failed.status}.` },
        { status: failed.status === 503 ? 503 : 502 }
      );
    }
    return NextResponse.json({
      leadSources: (await ls.json()).leadSources ?? [],
      quoters: (await qs.json()).quoters ?? [],
    });
  } catch {
    return NextResponse.json({ error: "M1 unreachable" }, { status: 502 });
  }
}
