/**
 * Types for the data-driven configurator rules — the replacement for the
 * current hard-coded rule engine. Field names stay close to M1 conventions
 * (control names like CMBUPS / CHKHYPERLIFT / NUMDOORWIDTH).
 */

export type RuleCategory =
  | "BASE"
  | "ASSEMBLY_UPGRADE"
  | "MATERIAL_UPGRADE"
  | "MATERIAL_DISCOUNT"
  | "INSTALLATION";

export const RULE_CATEGORY_LABELS: Record<RuleCategory, string> = {
  BASE: "Base",
  ASSEMBLY_UPGRADE: "Assembly Upgrade",
  MATERIAL_UPGRADE: "Material Upgrade",
  MATERIAL_DISCOUNT: "Material Discount",
  INSTALLATION: "Installation",
};

/** Categories other than BASE are "upgrades" (or discounts) added on top. */
export const RULE_CATEGORIES = Object.keys(
  RULE_CATEGORY_LABELS
) as RuleCategory[];

export type ConditionOperator =
  | "is_checked"
  | "not_checked"
  | "equals"
  | "not_equals"
  | "greater_than"
  | "less_than"
  | "contains";

export const OPERATOR_LABELS: Record<ConditionOperator, string> = {
  is_checked: "is checked",
  not_checked: "is not checked",
  equals: "=",
  not_equals: "≠",
  greater_than: ">",
  less_than: "<",
  contains: "contains",
};

/** Operators that don't need a value (checkbox-style controls). */
export const VALUELESS_OPERATORS: ConditionOperator[] = [
  "is_checked",
  "not_checked",
];

export interface RuleCondition {
  controlName: string;
  operator: ConditionOperator;
  value: string;
}

export interface ConfiguratorRule {
  id: string;
  configuratorId: string;
  name: string;
  category: RuleCategory;
  conditions: RuleCondition[];
  resultPartId: string;
  quantity: string; // fixed number or a formula reference
  isActive: boolean;
}

export interface ConfiguratorOption {
  id: string;
  name: string;
}

export const CONFIGURATORS: ConfiguratorOption[] = [
  { id: "RRD-MOVIDOR-TEMPLATE", name: "RRD Movidor" },
  { id: "CURT-RRD", name: "Curtain" },
  { id: "INSTALLATION-TEMPLATE", name: "Installation" },
  { id: "SWI-PVC-TEMPLATE", name: "PVC Swingdoor" },
  { id: "SWI-THERMAL-TEMPLATE", name: "Thermal Swingdoor" },
];

/** Human-readable summary of a rule's conditions, e.g. "CHKHYPERLIFT is checked". */
export function describeConditions(conditions: RuleCondition[]): string {
  if (conditions.length === 0) return "Always";
  return conditions
    .map((c) =>
      VALUELESS_OPERATORS.includes(c.operator)
        ? `${c.controlName} ${OPERATOR_LABELS[c.operator]}`
        : `${c.controlName} ${OPERATOR_LABELS[c.operator]} ${c.value}`
    )
    .join(" AND ");
}
