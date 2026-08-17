import type { Party, Location } from "@/types/customer";
import type { QuoteLine } from "@/types/quote";

/**
 * Demo/mock data removed — the app uses real data (M1 via the API, and the
 * config DB). These stay as empty exports so imports keep working; wire the
 * customer search and quote loading to the real API to populate them.
 */

export const MOCK_PARTIES: Party[] = [];

export const MOCK_LOCATIONS: Record<string, Location[]> = {};

export const MOCK_QUOTE_LINES: QuoteLine[] = [];
