import type {
  SimproCallResult,
  SimproJobDetailResult,
  SimproJobsResult,
} from "@/types/simpro";

/**
 * Calls our own API route (which calls Simpro server-side, so the token never
 * reaches the browser). `endpoint` is a path relative to SIMPRO_BASE_URL,
 * e.g. "/customers/?search=woolworths".
 */
export async function callSimpro(endpoint: string): Promise<SimproCallResult> {
  const res = await fetch(
    `/api/simpro/call?endpoint=${encodeURIComponent(endpoint)}`
  );
  return res.json();
}

/** Search Simpro jobs by term (job name, customer, site, number). */
export async function searchSimproJobs(term: string): Promise<SimproJobsResult> {
  const res = await fetch(`/api/simpro/jobs?search=${encodeURIComponent(term)}`);
  return res.json();
}

/** Fetch one job's details plus its cost centres. */
export async function fetchSimproJob(
  id: string | number
): Promise<SimproJobDetailResult> {
  const res = await fetch(`/api/simpro/jobs/detail?id=${encodeURIComponent(String(id))}`);
  return res.json();
}
