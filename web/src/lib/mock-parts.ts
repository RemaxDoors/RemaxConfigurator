/**
 * Mock M1 part list removed — wire `searchM1Parts` to the real M1 API
 * (/api/m1/parts) when ready. Returns nothing for now.
 */
export interface M1Part {
  partId: string;
  partRevision: string;
  partDescription: string;
  partLongDescription: string;
}

export const MOCK_M1_PARTS: M1Part[] = [];

export function searchM1Parts(query: string): M1Part[] {
  const term = query.trim().toLowerCase();
  if (term.length < 2) return [];
  return MOCK_M1_PARTS.filter(
    (p) =>
      p.partId.toLowerCase().includes(term) ||
      p.partDescription.toLowerCase().includes(term)
  );
}
