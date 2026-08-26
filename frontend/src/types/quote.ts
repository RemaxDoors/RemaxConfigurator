import type { Party, Location } from "@/types/customer";
import type { Door } from "@/types/door";
import type { Part } from "@/types/part";
import type { PriceBreakdown } from "@/types/pricing";

/**
 * Where a quote is in the sales process.
 *
 * These are the words the sales team uses, not database shorthand — the badge
 * on the header is read at a glance and "Open" said nothing about whether the
 * customer had actually seen it.
 *
 * Order matters: QUOTE_STATUSES is the progression, and the checklist gates the
 * move out of the first one.
 */
export type QuoteStatus =
  | "Quote In Progress"
  | "Quote Sent to Customer"
  | "Quote Won";

export const QUOTE_STATUSES: QuoteStatus[] = [
  "Quote In Progress",
  "Quote Sent to Customer",
  "Quote Won",
];

export interface QuoteTotals {
  doorTotal: number;
  installationTotal: number;
  totalSell: number;
  totalCost: number;
  marginPercent: number;
}

/**
 * A single line on a quote. Maps to M1 uQuoteLines.
 * The `item` is the part being sold — a plain `Part`, or a `Door` (which is a
 * configured Part). Part identity + qty live on the item; the line carries the
 * pricing breakdown.
 */
export interface QuoteLine {
  quoteId: string;
  quoteLineId: string;
  item: Part | Door; // a plain Part, or a Door (a configured Part)
  /** Installation sell for this line. */
  installationTotal: number;
  /** Door / product sell for this line. */
  doorTotal: number;
  resellerDiscountPercent: number;
  /** Sell price per unit (after reseller discount). */
  totalUnitPrice: number;
  marginPercent: number;
  /** Full M1 price breakdown (door + upgrades + installation), for the expandable view. */
  breakdown?: PriceBreakdown;
}

/**
 * A quote header + its lines. Maps to M1 uQuotes (+ uQuoteLines).
 */
export interface Quote {
  quoteId: string;
  customer: Party;
  shipToCustomer: Party;
  shipToLocation: Location;
  projectName: string;
  /** Employees.lmeEmployeeID — the quoter. */
  salesPerson: string;
  /** MarketingPrograms.looMarketingProgramID — Quotes.uqmpMarketingProgramID. */
  leadSource: string;
  revision: string;
  status: QuoteStatus;
  totals: QuoteTotals;
  lines: QuoteLine[];
}
