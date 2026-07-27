import type { Party, Location } from "@/types/customer";
import type { QuoteLine } from "@/types/quote";

/**
 * Mock data for the screens-first build. Stands in for the M1 SQL layer
 * (customer_repository / quote_repository) until the real API is wired up.
 */

export const MOCK_PARTIES: Party[] = [
  { id: "10231", name: "Woolworths Distribution Centre" },
  { id: "10544", name: "Coles Group Logistics" },
  { id: "11002", name: "Australia Post — Sunshine West" },
  { id: "11890", name: "Toll Global Forwarding" },
  { id: "12377", name: "Linfox Armaguard" },
  { id: "13045", name: "BlueScope Steel Western Port" },
  { id: "13991", name: "DB Schenker Truganina" },
];

export const MOCK_LOCATIONS: Record<string, Location[]> = {
  "10231": [
    { id: "MEL-01", name: "Melbourne RDC — Dandenong South" },
    { id: "SYD-04", name: "Sydney RDC — Minchinbury" },
  ],
  "10544": [
    { id: "BNE-02", name: "Brisbane NDC — Redbank" },
    { id: "PER-01", name: "Perth RDC — Perth Airport" },
  ],
  "11002": [{ id: "SW-1", name: "Sunshine West Facility" }],
};

export const MOCK_QUOTE_LINES: QuoteLine[] = [
  {
    quoteId: "Q-10231",
    quoteLineId: "1",
    item: {
      // Door = a configured Part
      partId: "RRD-ES40",
      partRevision: "A",
      partDescription: "ES40 Rapid Roll Door",
      partLongDescription: "RRD Movidor ES40 3000H x 3500W, concealed track, 3-phase",
      partQty: 2,
      configuratorId: "RRD-MOVIDOR-TEMPLATE",
      parameters: [
        { controlName: "CMBDOORMODEL", value: "ES40" },
        { controlName: "NUMDOORHEIGHT", value: "3000" },
        { controlName: "NUMDOORWIDTH", value: "3500" },
        { controlName: "CHKHYPERLIFT", value: "1" },
      ],
    },
    doorTotal: 32900,
    installationTotal: 4000,
    resellerDiscountPercent: 5,
    totalUnitPrice: 18450,
    marginPercent: 0.3913,
  },
  {
    quoteId: "Q-10231",
    quoteLineId: "2",
    item: {
      partId: "RRD-HS50-THERMIC",
      partRevision: "A",
      partDescription: "HS50 Thermic Rapid Door",
      partLongDescription: "RRD Movidor HS50-THERMIC 4200H x 4000W, insulated curtain",
      partQty: 1,
      configuratorId: "RRD-MOVIDOR-TEMPLATE",
      parameters: [
        { controlName: "CMBDOORMODEL", value: "HS50-THERMIC" },
        { controlName: "NUMDOORHEIGHT", value: "4200" },
        { controlName: "NUMDOORWIDTH", value: "4000" },
      ],
    },
    doorTotal: 25000,
    installationTotal: 2310,
    resellerDiscountPercent: 0,
    totalUnitPrice: 27310,
    marginPercent: 0.3047,
  },
  {
    quoteId: "Q-10231",
    quoteLineId: "3",
    item: {
      // Plain selling part — no configurator
      partId: "STRIPDOOR",
      partRevision: "A",
      partDescription: "PVC Strip Door",
      partLongDescription: "Catalogue strip door 2700H x 2400W",
      partQty: 4,
    },
    doorTotal: 5160,
    installationTotal: 0,
    resellerDiscountPercent: 0,
    totalUnitPrice: 1290,
    marginPercent: 0.4419,
  },
];
