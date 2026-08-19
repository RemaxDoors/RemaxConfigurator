/**
 * Simpro raw-call types. The UI lets you type/select an endpoint path (relative
 * to SIMPRO_BASE_URL); the API route calls it server-side and returns the raw
 * JSON so you can explore any endpoint.
 */

export interface SimproCallResult {
  ok: boolean;
  status: number;
  /** Full URL called (base + endpoint) — never includes the token. */
  url: string;
  data: unknown;
  /** False when SIMPRO_BASE_URL / SIMPRO_API_TOKEN are not set. */
  configured: boolean;
  error?: string;
}

/** Quick-fill endpoints (you can still type any path). */
export const COMMON_ENDPOINTS: { label: string; path: string }[] = [
  { label: "Customers", path: "/customers/?pageSize=20" },
  { label: "Sites", path: "/sites/?pageSize=20" },
  { label: "Contacts", path: "/contacts/?pageSize=20" },
  { label: "Jobs", path: "/jobs/?pageSize=20" },
  { label: "Quotes", path: "/quotes/?pageSize=20" },
];

// ---------------------------------------------------------------------------
// Job lookup (search a job, then its cost centres)
// ---------------------------------------------------------------------------

export interface SimproJobSummary {
  id: number | string;
  name?: string;
  stage?: string;
  customer?: string;
  site?: string;
  total?: number | null;
  raw: Record<string, unknown>;
}

/** A line item inside a cost centre (catalog, prebuild, labour, etc.). */
export interface SimproItem {
  id: number | string;
  /** "Catalog" | "Prebuild" | "Labor" | "Service Fee" | "One-Off" */
  type: string;
  partNo?: string;
  name?: string;
  qty?: number | null;
  /** Line sell total (ex-tax) where available. */
  amount?: number | null;
  raw: Record<string, unknown>;
}

export interface SimproCostCentre {
  /** Job cost-centre instance ID (CostCenters[].ID). */
  id: number | string;
  /** Underlying setup cost-centre ID (CostCenter.ID). */
  setupId?: number | string;
  name?: string;
  section?: string;
  /** Sell total (ex-tax where available). */
  total?: number | null;
  /** Cost (materials + resources) where available. */
  cost?: number | null;
  items: SimproItem[];
  raw: Record<string, unknown>;
}

export interface SimproSection {
  id: number | string;
  name?: string;
  costCentres: SimproCostCentre[];
}

export interface SimproJobDetail {
  id: number | string;
  name?: string;
  stage?: string;
  type?: string;
  customer?: string;
  site?: string;
  siteContact?: string;
  total?: number | null;
  sections: SimproSection[];
  raw: Record<string, unknown>;
}

export interface SimproJobsResult {
  configured: boolean;
  ok: boolean;
  status: number;
  jobs: SimproJobSummary[];
  error?: string;
}

export interface SimproJobDetailResult {
  configured: boolean;
  ok: boolean;
  status: number;
  job: SimproJobDetail | null;
  error?: string;
}
