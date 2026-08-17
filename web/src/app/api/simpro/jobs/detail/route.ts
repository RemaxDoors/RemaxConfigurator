import { NextResponse, type NextRequest } from "next/server";

import { getJobWithCostCentres } from "@/lib/simpro-server";

/** GET /api/simpro/jobs/detail?id=123 — job details + cost centres. */
export async function GET(request: NextRequest) {
  const id = (new URL(request.url).searchParams.get("id") ?? "").trim();
  if (!id) {
    return NextResponse.json(
      { configured: true, ok: false, status: 400, job: null, error: "Provide a job id." },
      { status: 400 }
    );
  }
  const result = await getJobWithCostCentres(id);
  return NextResponse.json(result, { status: result.ok ? 200 : result.status || 200 });
}
