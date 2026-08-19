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
  materialUpgrade: number;
  materialUpgradeCost: number;
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
