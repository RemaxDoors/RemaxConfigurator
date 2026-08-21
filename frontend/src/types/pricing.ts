export interface PriceLine {
  category: string;
  partId: string;
  description: string;
  qty: number;
  sell: number;
  cost: number;
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
}
