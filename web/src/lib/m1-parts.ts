export interface M1Part {
  partId: string;
  partRevision: string;
  partDescription: string;
  partLongDescription: string;
  /** M1 unit sell / cost. */
  sell: number;
  cost: number;
}

/** Search M1 parts (Parts / PartRevisions) by id or description, with prices. */
export async function searchM1Parts(term: string): Promise<M1Part[]> {
  const q = term.trim();
  if (q.length < 2) return [];
  try {
    const res = await fetch(`/api/m1/parts?search=${encodeURIComponent(q)}`);
    if (!res.ok) return [];
    const data = await res.json();
    return (data.parts ?? []) as M1Part[];
  } catch {
    return [];
  }
}
