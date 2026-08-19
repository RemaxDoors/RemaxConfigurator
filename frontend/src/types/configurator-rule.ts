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
  | "contains"
  | "not_contains"
  | "starts_with"
  | "in"
  | "not_in";

export const OPERATOR_LABELS: Record<ConditionOperator, string> = {
  is_checked: "is checked",
  not_checked: "is not checked",
  equals: "=",
  not_equals: "≠",
  greater_than: ">",
  less_than: "<",
  contains: "contains",
  not_contains: "not contains",
  starts_with: "starts with",
  in: "in list",
  not_in: "not in list",
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
  /**
   * Conditions with the same groupNo are AND-ed together; different groups are
   * OR-ed. So the rule fires when ANY group is fully satisfied:
   *   (g1a AND g1b) OR (g2a) OR …
   * Defaults to group 1 (a single AND group) when omitted.
   */
  groupNo?: number;
}

/**
 * How a rule's quantity-per-assembly is worked out. Mirrors the M1 configurator's
 * generic cUnit block — the maths is the same for every part, only the unit and
 * the two flags change.
 */
export type QuantityUnit =
  | "Per Door"
  | "Per Project"
  | "Per Leaf"
  | "Per Hour"
  | "Per Night";

export const QUANTITY_UNITS: QuantityUnit[] = [
  "Per Door",
  "Per Project",
  "Per Leaf",
  "Per Hour",
  "Per Night",
];

export const QUANTITY_UNIT_HELP: Record<QuantityUnit, string> = {
  "Per Door": "Qty = the fixed quantity (default).",
  "Per Project": "Qty ÷ total doors in the project.",
  "Per Leaf": "Doubles when the door is a pair.",
  "Per Hour": "(driving time ÷ total doors) ÷ projects on run.",
  "Per Night": "(nights × people) ÷ total doors.",
};

export interface ConfiguratorRule {
  id: string;
  configuratorId: string;
  name: string;
  category: RuleCategory;
  conditions: RuleCondition[];
  resultPartId: string;
  resultRevision?: string;
  /** Revision chosen by the configuration (nested IF returning text). */
  resultRevisionFormula?: string;
  quantity: string; // the base quantity (nQtyPerAss)
  /** Scaling unit applied to the base quantity. Defaults to "Per Door". */
  quantityUnit?: QuantityUnit;
  /** Multiplier applied when after-hours (CHKINSAH) is checked. */
  ahFactor?: number;
  /** SWI- paired configurations double the quantity. */
  swiPairDoubles?: boolean;
  /** When set, this expression overrides the unit/flags entirely. */
  quantityFormula?: string;
  /**
   * An extra test AND-ed with the condition groups, for things the groups can't
   * say — chiefly counting across numbered controls (CMBACT1..CMBACT4):
   *   countStartsWith(group("CMBACT"), "Induction Loop - ") > 0
   */
  conditionFormula?: string;
  /** Free-text note carried through import/export (the M1 rule comment). */
  notes?: string;
  isActive: boolean;
}

/** Controls that come in a numbered set, e.g. CMBACT1..CMBACT4 -> "CMBACT". */
export function slotGroups(parameters: { controlName: string }[]): {
  prefix: string;
  count: number;
}[] {
  const counts = new Map<string, number>();
  for (const p of parameters) {
    const m = p.controlName.toUpperCase().match(/^(.*[A-Z])(\d+)$/);
    if (m) counts.set(m[1], (counts.get(m[1]) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .filter(([, count]) => count > 1)
    .map(([prefix, count]) => ({ prefix, count }))
    .sort((a, b) => a.prefix.localeCompare(b.prefix));
}

/** Human summary of how a rule's quantity is calculated. */
export function describeQuantity(rule: ConfiguratorRule): string {
  if (rule.quantityFormula?.trim()) return rule.quantityFormula.trim();
  const unit = rule.quantityUnit ?? "Per Door";
  const bits = [unit === "Per Door" ? `×${rule.quantity}` : `×${rule.quantity} ${unit}`];
  if (rule.ahFactor && rule.ahFactor !== 1) bits.push(`AH ×${rule.ahFactor}`);
  if (rule.swiPairDoubles) bits.push("pair ×2");
  return bits.join(" · ");
}

/** One condition as text, e.g. "CHKHYPERLIFT is checked" or "CMBUPS contains 1kVA". */
function describeCondition(c: RuleCondition): string {
  return VALUELESS_OPERATORS.includes(c.operator)
    ? `${c.controlName} ${OPERATOR_LABELS[c.operator]}`
    : `${c.controlName} ${OPERATOR_LABELS[c.operator]} ${c.value}`;
}

/** Group conditions by groupNo (AND within a group), preserving first-seen order. */
export function groupConditions(conditions: RuleCondition[]): RuleCondition[][] {
  const groups = new Map<number, RuleCondition[]>();
  for (const c of conditions) {
    const g = c.groupNo ?? 1;
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g)!.push(c);
  }
  return Array.from(groups.values());
}

/**
 * Human-readable summary. AND within a group, OR between groups:
 *   "CHKHYPERLIFT is checked"                       (one group)
 *   "(A AND B) OR (C)"                               (multiple groups)
 */
export function describeConditions(conditions: RuleCondition[]): string {
  if (conditions.length === 0) return "Always";
  const groups = groupConditions(conditions);
  const parts = groups.map((conds) => conds.map(describeCondition).join(" AND "));
  return parts.length === 1 ? parts[0] : parts.map((p) => `(${p})`).join(" OR ");
}
