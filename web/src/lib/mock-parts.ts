/**
 * Mock M1 part list for the "Part entry" search. Stands in for a lookup against
 * the M1 Parts / PartRevisions tables until the API is wired up. Each row is a
 * part + revision (as M1 stores them).
 */
export interface M1Part {
  partId: string;
  partRevision: string;
  partDescription: string;
  partLongDescription: string;
}

export const MOCK_M1_PARTS: M1Part[] = [
  {
    partId: "STRIPDOOR",
    partRevision: "A",
    partDescription: "PVC Strip Door",
    partLongDescription: "Catalogue PVC strip door, cut to size",
  },
  {
    partId: "EL-UPS-1KVAASS",
    partRevision: "B",
    partDescription: "1 kVA UPS Assembly",
    partLongDescription: "Uninterruptible power supply assembly, 1 kVA",
  },
  {
    partId: "RRD-BUGSTOP",
    partRevision: "A",
    partDescription: "Bugstop Insect Screen",
    partLongDescription: "Bugstop mesh insect screen door",
  },
  {
    partId: "ACC-REMOTE-2BTN",
    partRevision: "C",
    partDescription: "2-Button Remote",
    partLongDescription: "Handheld 2-button remote control",
  },
  {
    partId: "ACC-TRAFFICLIGHT",
    partRevision: "A",
    partDescription: "Traffic Light",
    partLongDescription: "Red/green traffic light assembly",
  },
  {
    partId: "INS-AH-LABOUR",
    partRevision: "A",
    partDescription: "After-hours Labour",
    partLongDescription: "After-hours installation labour (per hour)",
  },
];

export function searchM1Parts(query: string): M1Part[] {
  const term = query.trim().toLowerCase();
  if (term.length < 2) return [];
  return MOCK_M1_PARTS.filter(
    (p) =>
      p.partId.toLowerCase().includes(term) ||
      p.partDescription.toLowerCase().includes(term)
  );
}
