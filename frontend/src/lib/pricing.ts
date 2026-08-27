import type { PriceBreakdown, UpgradeOverride } from "@/types/pricing";

export interface CurtainPrice {
  curtainModel: string;
  curtainSell: number;
  curtainCost: number;
  components: { component: string; quantity: number; extendedPrice: number }[];
  dimensions: Record<string, number>;
}

/** Curtain price + finished dimensions from M1. */
export async function fetchCurtainPrice(
  values: Record<string, string>
): Promise<CurtainPrice | null> {
  try {
    const res = await fetch("/api/price/curtain", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ values }),
    });
    if (!res.ok) return null;
    return (await res.json()) as CurtainPrice;
  } catch {
    return null;
  }
}

/** Fetch the priced breakdown (door + upgrades + installation) from M1. */
export async function fetchPrice(
  configuratorId: string,
  values: Record<string, string>,
  /**
   * Negotiated unit prices, keyed by part id. Sent alongside `values` rather
   * than inside it: `values` is configurator state bound for FormInputValues,
   * and pricing does not belong there.
   */
  overrides?: Record<string, UpgradeOverride>
): Promise<PriceBreakdown | null> {
  try {
    const res = await fetch("/api/price", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ configuratorId, values, overrides }),
    });
    if (!res.ok) return null;
    return (await res.json()) as PriceBreakdown;
  } catch {
    return null;
  }
}
