import { NextResponse, type NextRequest } from "next/server";

import { searchJobs } from "@/lib/simpro-server";

/** GET /api/simpro/jobs?search=term — search Simpro jobs (server-side). */
export async function GET(request: NextRequest) {
  const term = new URL(request.url).searchParams.get("search") ?? "";
  const result = await searchJobs(term);
  return NextResponse.json(result, { status: result.ok ? 200 : result.status || 200 });
}
