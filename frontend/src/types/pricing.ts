/**
 * A negotiated unit price for one part on one quote line.
 *
 * Keyed by part id wherever these are stored. Not by parameter name: one
 * parameter can trigger several parts, and a parameter can be renamed, while a
 * part id is M1's own identity and does not move. The parameter is kept in the
 * value so the stored record is readable by a person.
 *
 * This is what lands in QuoteLines.uqmlUpgradeOverridePrices — deliberately
 * apart from FormInputValues, which holds configurator values and only those.
 */
export interface UpgradeOverride {
  /** The agreed price for ONE of this part. Line total is this × qty. */
  unitPrice: number;
  /** M1's price at the time it was agreed, so the giveaway stays visible. */
  listUnitPrice?: number;
  /** Which control triggered the part — for reading, never for lookup. */
  parameter?: string;
  label?: string;
}

export interface PriceLine {
  category: string;
  partId: string;
  description: string;
  qty: number;
  sell: number;
  cost: number;
  /** Which rule produced this line — absent on the legacy pricing path. */
  ruleId?: string;
  ruleName?: string;
  /** The agreed unit price. `sell` is this × qty. */
  unitSell?: number;
  /** What M1 lists it at, kept so the screen can show what was given away. */
  listUnitSell?: number;
  overridden?: boolean;
}

export interface PriceBreakdown {
  model: string;
  width: number;
  height: number;
  qty: number;
  doorPrice: number;
  doorCost: number;
  installation: number;
  installationCost: number;
  /** Assembly + material combined — M1's quote matrix shows these separately. */
  materialUpgrade: number;
  materialUpgradeCost: number;
  /** The two halves of materialUpgrade, for a summary that mirrors M1. */
  assemblyUpgrade: number;
  assemblyUpgradeCost: number;
  materialOnlyUpgrade: number;
  materialOnlyUpgradeCost: number;
  /** Free-form per-door extra, mirroring M1's "Misc Extra (p/door)". */
  miscExtra: number;
  miscExtraCost: number;
  miscExtraDescription: string;
  materialDiscount: number;
  materialDiscountCost: number;
  unitSell: number;
  unitCost: number;
  totalSell: number;
  totalCost: number;
  marginPercent: number;
  lines: PriceLine[];
  rulesAvailable: boolean;
  /**
   * Which selection caused which upgrade charge.
   *
   * null when the config DB could not be reached — pricing still works, the
   * screen just cannot highlight what drove the cost.
   */
  upgradeAttribution?: UpgradeAttribution | null;
  /** Reseller discount, applied to sell only. Cost and totals reflect it. */
  resellerDiscountPercent?: number;
  resellerDiscountAmount?: number;
  /** Unit sell before the reseller discount came off. */
  listUnitSell?: number;
  /** Negotiated unit prices in force, keyed by part id. */
  priceOverrides?: Record<string, UpgradeOverride>;
  /** "rules" once uCfgRules drives the upgrades; "legacy" if it could not. */
  pricingSource?: "rules" | "legacy";
  pricingSourceReason?: string;
}

/**
 * A priced line, seen from the control that caused it.
 *
 * These are the same objects as `PriceBreakdown.lines` — the attribution
 * groups them by control rather than copying them — so anything true of a line
 * is true here, including the override fields the summary edits.
 */
export interface AttributedPart extends PriceLine {
  /** Negative for a discount, so a cheaper selection reads as a reduction. */
  amount: number;
}

export interface UpgradeAttribution {
  /** Keyed by control name, upper case. */
  byControl: Record<string, { amount: number; parts: AttributedPart[] }>;
  /**
   * Charges no rule explains. Shown rather than hidden: an unexplained upgrade
   * is a missing rule, and this is where it becomes visible.
   */
  unattributed: AttributedPart[];
  unattributedTotal: number;
  attributedTotal: number;
}
