import { NextResponse, type NextRequest } from "next/server";

/**
 * Server-side proxy to the Python API's M1 customer search (set API_URL).
 * The Python side returns 503 until M1 (DB_*) is configured.
 */
export async function GET(request: NextRequest) {
  const base = process.env.API_URL;
  const q = new URL(request.url).searchParams.get("q") ?? "";

  if (!base) {
    return NextResponse.json(
      { results: [], error: "API_URL is not set." },
      { status: 503 }
    );
  }

  try {
    const res = await fetch(
      `${base}/customers?q=${encodeURIComponent(q)}`,
      { cache: "no-store" }
    );
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json(
      { results: [], error: "Python API unreachable." },
      { status: 502 }
    );
  }
}
