import type { ConfiguratorRule } from "@/types/configurator-rule";

/**
 * Seed rules mirroring a handful of today's hard-coded rules. Stands in for the
 * ConfiguratorRules table until the backend is wired up. Editing on the page
 * mutates local state only (nothing is persisted yet).
 */
export const MOCK_RULES: ConfiguratorRule[] = [
  {
    id: "r1",
    configuratorId: "RRD-MOVIDOR-TEMPLATE",
    name: "Hyperlift",
    category: "ASSEMBLY_UPGRADE",
    conditions: [{ controlName: "CHKHYPERLIFT", operator: "is_checked", value: "" }],
    resultPartId: "RRD-HYPERLIFT-ASS",
    quantity: "1",
    isActive: true,
  },
  {
    id: "r2",
    configuratorId: "RRD-MOVIDOR-TEMPLATE",
    name: "1 kVA UPS",
    category: "ASSEMBLY_UPGRADE",
    conditions: [{ controlName: "CMBUPS", operator: "equals", value: "1kVA" }],
    resultPartId: "EL-UPS-1KVAASS",
    quantity: "1",
    isActive: true,
  },
  {
    id: "r3",
    configuratorId: "RRD-MOVIDOR-TEMPLATE",
    name: "Wide-door wind track",
    category: "MATERIAL_UPGRADE",
    conditions: [
      { controlName: "NUMDOORWIDTH", operator: "greater_than", value: "4000" },
      { controlName: "CMBWINDTRACK", operator: "equals", value: "Yes" },
    ],
    resultPartId: "RRD-WINDTRACK",
    quantity: "1",
    isActive: true,
  },
  {
    id: "r4",
    configuratorId: "CURT-RRD",
    name: "Emergency zip",
    category: "MATERIAL_UPGRADE",
    conditions: [{ controlName: "CHKEMERGZIP", operator: "is_checked", value: "" }],
    resultPartId: "CURT-EMERG-ZIP",
    quantity: "1",
    isActive: true,
  },
  {
    id: "r5",
    configuratorId: "INSTALLATION-TEMPLATE",
    name: "After-hours labour",
    category: "INSTALLATION",
    conditions: [{ controlName: "CHKINSAH", operator: "is_checked", value: "" }],
    resultPartId: "INS-AH-LABOUR",
    quantity: "1",
    isActive: false,
  },
];
