/**
 * Server-only Simpro helpers. Imported by route handlers so the token never
 * reaches the browser. Simpro's JSON shapes vary by account/version, so every
 * extractor is defensive and the raw payload is always carried through.
 */
import type {
  SimproCostCentre,
  SimproItem,
  SimproJobDetail,
  SimproJobDetailResult,
  SimproJobSummary,
  SimproJobsResult,
  SimproSection,
} from "@/types/simpro";

interface SimproFetchResult {
  ok: boolean;
  status: number;
  data: unknown;
  configured: boolean;
  url: string;
  error?: string;
}

async function simproFetch(path: string): Promise<SimproFetchResult> {
  const base = process.env.SIMPRO_BASE_URL;
  const token = process.env.SIMPRO_API_TOKEN;
  if (!base || !token) {
    return {
      ok: false,
      status: 0,
      data: null,
      configured: false,
      url: path,
      error:
        "Set SIMPRO_BASE_URL and SIMPRO_API_TOKEN in web/.env and restart the dev server.",
    };
  }
  const url = `${base}${path}`;
  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      cache: "no-store",
    });
    const text = await res.text();
    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
    return { ok: res.ok, status: res.status, data, configured: true, url };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      data: null,
      configured: true,
      url,
      error: err instanceof Error ? err.message : "Request failed",
    };
  }
}

// ---- defensive extractors -------------------------------------------------

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : {};
}

function pickId(o: Record<string, unknown>): number | string {
  const id = o.ID ?? o.Id ?? o.id;
  return typeof id === "number" || typeof id === "string" ? id : "";
}

/** A readable name from a string, or a nested {CompanyName|Name|Given+Family}. */
function pickName(v: unknown): string | undefined {
  if (typeof v === "string") return v || undefined;
  if (typeof v === "number") return String(v);
  const o = asRecord(v);
  if (typeof o.CompanyName === "string" && o.CompanyName) return o.CompanyName;
  if (typeof o.Name === "string" && o.Name) return o.Name;
  const given = typeof o.GivenName === "string" ? o.GivenName : "";
  const family = typeof o.FamilyName === "string" ? o.FamilyName : "";
  const full = `${given} ${family}`.trim();
  return full || undefined;
}

/** Simpro job "Name"/"Description" is often rich HTML — strip to plain text. */
function cleanName(v: unknown): string | undefined {
  const raw = pickName(v);
  if (!raw) return undefined;
  if (!raw.includes("<") && !raw.includes("&")) return raw;
  const text = raw
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > 140 ? `${text.slice(0, 140)}…` : text;
}

/** A number from a plain value or a Simpro money object {ExTax|IncTax|Amount}. */
function pickMoney(v: unknown): number | null {
  if (typeof v === "number") return v;
  const o = asRecord(v);
  for (const k of ["ExTax", "IncTax", "Amount", "Total", "Value"]) {
    if (typeof o[k] === "number") return o[k] as number;
  }
  return null;
}

/** Total cost of a cost centre from its Totals breakdown (materials + resources). */
function pickCost(detail: Record<string, unknown>): number | null {
  const totals = asRecord(detail.Totals);
  const materials = asRecord(totals.MaterialsCost);
  const resources = asRecord(asRecord(totals.ResourcesCost).Total);
  const pref = (o: Record<string, unknown>): number | null => {
    for (const k of ["Estimate", "Revised", "Actual"]) {
      if (typeof o[k] === "number") return o[k] as number;
    }
    return null;
  };
  const m = pref(materials);
  const r = pref(resources);
  if (m === null && r === null) {
    // No Totals breakdown — fall back to any flat cost field.
    return pickMoney(detail.Cost ?? detail.Estimated ?? detail.ActualCost);
  }
  return (m ?? 0) + (r ?? 0);
}

function extractError(res: SimproFetchResult): string {
  const d = res.data;
  if (Array.isArray(d) && d.length && typeof asRecord(d[0]).Message === "string") {
    return d.map((e) => asRecord(e).Message).join("; ");
  }
  const o = asRecord(d);
  if (typeof o.Message === "string") return o.Message;
  if (typeof d === "string" && d.trim()) return d.slice(0, 300);
  return `Simpro returned ${res.status || "an error"}.`;
}

function toJobSummary(item: Record<string, unknown>): SimproJobSummary {
  return {
    id: pickId(item),
    name: cleanName(item.Name) ?? cleanName(item.Description),
    stage: pickName(item.Stage),
    customer: pickName(item.Customer),
    site: pickName(item.Site),
    total: pickMoney(item.Total),
    raw: item,
  };
}

// ---- public API -----------------------------------------------------------

export async function searchJobs(term: string): Promise<SimproJobsResult> {
  const q = term.trim();
  let path: string;
  if (!q) {
    // Most recent jobs.
    path = `/jobs/?pageSize=30`;
  } else if (/^\d+$/.test(q)) {
    // All digits → treat as a job number (exact ID lookup).
    path = `/jobs/?ID=${encodeURIComponent(q)}&pageSize=30`;
  } else {
    // Text → partial match on the job description. Simpro's "search" param is a
    // scheme (all/any), and column values use % as the wildcard.
    path = `/jobs/?search=any&Description=%${encodeURIComponent(q)}%&pageSize=30`;
  }
  const res = await simproFetch(path);
  if (!res.configured) {
    return { configured: false, ok: false, status: 0, jobs: [], error: res.error };
  }
  if (!res.ok) {
    return { configured: true, ok: false, status: res.status, jobs: [], error: extractError(res) };
  }
  const arr = Array.isArray(res.data) ? res.data : [];
  return {
    configured: true,
    ok: true,
    status: res.status,
    jobs: arr.map((x) => toJobSummary(asRecord(x))),
  };
}

// Item groups within a cost centre: [Items list key, descriptor key, label].
const ITEM_GROUPS: [string, string, string][] = [
  ["Catalogs", "Catalog", "Catalog"],
  ["Prebuilds", "Prebuild", "Prebuild"],
  ["Labors", "Labor", "Labor"],
  ["ServiceFees", "ServiceFee", "Service Fee"],
  ["OneOffs", "OneOff", "One-Off"],
];

function extractItems(itemsObj: Record<string, unknown>): SimproItem[] {
  const out: SimproItem[] = [];
  for (const [listKey, descKey, label] of ITEM_GROUPS) {
    const list = itemsObj[listKey];
    if (!Array.isArray(list)) continue;
    for (const raw of list) {
      const o = asRecord(raw);
      const desc = asRecord(o[descKey]);
      const total = asRecord(o.Total);
      out.push({
        id: pickId(o),
        type: label,
        partNo: typeof desc.PartNo === "string" ? desc.PartNo : undefined,
        name: pickName(desc.Name) ?? pickName(o.Name) ?? cleanName(o.Description),
        qty: typeof total.Qty === "number" ? (total.Qty as number) : null,
        amount: pickMoney(total.Amount) ?? pickMoney(o.SellPrice),
        raw: o,
      });
    }
  }
  return out;
}

/**
 * Fetch the full job structure in one call (`display=all`): sections → cost
 * centres → items (catalogs, prebuilds, …). Cost per cost centre (materials +
 * resources) is enriched from the per-cost-centre detail, best-effort.
 */
export async function getJobWithCostCentres(
  id: string
): Promise<SimproJobDetailResult> {
  const jobRes = await simproFetch(`/jobs/${encodeURIComponent(id)}?display=all`);
  if (!jobRes.configured) {
    return { configured: false, ok: false, status: 0, job: null, error: jobRes.error };
  }
  if (!jobRes.ok) {
    return { configured: true, ok: false, status: jobRes.status, job: null, error: extractError(jobRes) };
  }
  const jobRaw = asRecord(jobRes.data);
  const rawSections = Array.isArray(jobRaw.Sections) ? jobRaw.Sections : [];

  const sections: SimproSection[] = rawSections.map((s) => {
    const so = asRecord(s);
    const sectionName = pickName(so.Name);
    const ccs = Array.isArray(so.CostCenters) ? so.CostCenters : [];
    return {
      id: pickId(so),
      name: sectionName,
      costCentres: ccs.map((cc) => {
        const cco = asRecord(cc);
        const setup = asRecord(cco.CostCenter);
        return {
          id: pickId(cco),
          setupId: pickId(setup) || undefined,
          name: pickName(cco.Name) ?? pickName(setup.Name),
          section: sectionName,
          total: pickMoney(cco.Total),
          cost: null,
          items: extractItems(asRecord(cco.Items)),
          raw: cco,
        };
      }),
    };
  });

  // Enrich cost (materials + resources) from each cost centre's detail — the
  // display=all payload carries the sell Total but not the cost breakdown.
  const CAP = 40;
  const refs: { sectionId: number | string; cc: SimproCostCentre }[] = [];
  for (const sec of sections) {
    for (const cc of sec.costCentres) refs.push({ sectionId: sec.id, cc });
  }
  await Promise.all(
    refs.slice(0, CAP).map(async ({ sectionId, cc }) => {
      if (sectionId === "" || cc.id === "") return;
      const d = await simproFetch(
        `/jobs/${encodeURIComponent(id)}/sections/${sectionId}/costCenters/${cc.id}`
      );
      if (d.ok) cc.cost = pickCost(asRecord(d.data));
    })
  );

  const ccTotalSum = sections
    .flatMap((s) => s.costCentres)
    .reduce((sum, c) => sum + (c.total ?? 0), 0);

  const job: SimproJobDetail = {
    id: pickId(jobRaw) || id,
    name: cleanName(jobRaw.Name) ?? cleanName(jobRaw.Description),
    stage: pickName(jobRaw.Stage),
    type: pickName(jobRaw.Type),
    customer: pickName(jobRaw.Customer),
    site: pickName(jobRaw.Site),
    siteContact: pickName(jobRaw.SiteContact),
    total: pickMoney(jobRaw.Total) ?? (ccTotalSum || null),
    sections,
    raw: jobRaw,
  };

  return { configured: true, ok: true, status: jobRes.status, job };
}
