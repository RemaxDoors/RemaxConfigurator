import type { Location, Party } from "@/types/customer";

/** Search M1 organizations (customers / ship-to customers) by name or id. */
export async function searchM1Customers(term: string): Promise<Party[]> {
  const q = term.trim();
  if (q.length < 2) return [];
  try {
    const res = await fetch(`/api/m1/customers?q=${encodeURIComponent(q)}`);
    if (!res.ok) return [];
    const data = await res.json();
    return (data.results ?? []) as Party[];
  } catch {
    return [];
  }
}

/** Ship-to locations for an M1 organization. */
export async function fetchM1Locations(
  organizationId: string
): Promise<Location[]> {
  if (!organizationId.trim()) return [];
  try {
    const res = await fetch(
      `/api/m1/locations?organizationId=${encodeURIComponent(organizationId)}`
    );
    if (!res.ok) return [];
    const data = await res.json();
    const rows = (data.results ?? []) as Location[];
    // M1 returns a blank-id row for the organization's primary location.
    return rows.map((l) => (l.id ? l : { ...l, name: `${l.name} — primary` }));
  } catch {
    return [];
  }
}
