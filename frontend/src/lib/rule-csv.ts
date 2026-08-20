import {
  QUANTITY_UNITS,
  RULE_CATEGORIES,
  RULE_CATEGORY_LABELS,
  describeConditions,
  type ConditionOperator,
  type ConfiguratorRule,
  type QuantityUnit,
  type RuleCategory,
  type RuleCondition,
} from "@/types/configurator-rule";
import { parseCsv, toCsv } from "@/lib/csv";
import type { RowError } from "@/lib/param-csv";

export const RULE_CSV_COLUMNS = [
  "Rule ID",
  "Name",
  "Result Part",
  "Category",
  "Quantity",
  "Active",
] as const;

/**
 * Sample template shown by the "Template" button.
 *
 * It carries every column the exporter writes, including Quantity Formula and
 * Condition Formula. The old template listed neither, so the two columns that
 * hold the slot-counting logic were invisible to anyone starting from it —
 * they would fill in Quantity, get a flat number, and have no way to express
 * "one per remote" from the spreadsheet at all.
 */
export const RULE_TEMPLATE_CSV = [
  "Rule ID,Name,Result Part,Category,Quantity,Active,Revision,Unit,Quantity Formula,Condition Formula,Notes,When",
  "EX-01,Simple checkbox rule,PART-ID,ASSEMBLY_UPGRADE,1,Yes,,Per Door,,,Fires when the checkbox is on,CHKEXAMPLE is checked",
  "EX-02,Either-or rule,PART-ID2,MATERIAL_UPGRADE,1,Yes,,Per Door,,,Groups use OR,(CMBUPS contains 1kVA) OR (CMBUPS contains 2kVA)",
  'EX-03,One per matching radar,PART-ID3,ASSEMBLY_UPGRADE,1,Yes,,Per Radar,"countEquals(group(""CMBRADAR""), ""IXIO Sensor - Long Stalk"")","countEquals(group(""CMBRADAR""), ""IXIO Sensor - Long Stalk"") > 0",Quantity Formula overrides the Quantity column,',
  'EX-04,One per remote ordered,PART-ID4,MATERIAL_UPGRADE,1,Yes,,Per Remote,"sumWhere(group(""CMBACT""), ""Elsema Remote - 2"", group(""NUMREMOTEQTY""))","sumWhere(group(""CMBACT""), ""Elsema Remote - 2"", group(""NUMREMOTEQTY"")) > 0",Adds up the qty box beside each matching slot,',
].join("\r\n");

export interface ImportedRule {
  id: string;
  name: string;
  resultPartId: string;
  category: RuleCategory;
  quantity: string;
  isActive: boolean;
  /** Parsed from the optional "When" column (empty if absent/unparseable). */
  conditions: RuleCondition[];
  resultRevision?: string;
  quantityUnit?: QuantityUnit;
  /** Optional "Formula" column — overrides the unit/flags. */
  quantityFormula?: string;
  /** Optional "Count When" column — AND-ed with the conditions. */
  conditionFormula?: string;
  notes?: string;
}

/** Accept the unit by name, case-insensitively ("per hour" -> "Per Hour"). */
const UNIT_BY_INPUT: Record<string, QuantityUnit> = Object.fromEntries(
  QUANTITY_UNITS.map((u) => [u.toLowerCase(), u])
);

/** Parse one condition token, e.g. "CHKFOO is checked" or "NUMX > 6". */
function parseCondition(token: string): RuleCondition | null {
  const t = token.trim();
  if (!t) return null;

  let m = t.match(/^(.*?)\s+is\s+not\s+checked$/i);
  if (m) return { controlName: m[1].trim(), operator: "not_checked", value: "" };
  m = t.match(/^(.*?)\s+is\s+checked$/i);
  if (m) return { controlName: m[1].trim(), operator: "is_checked", value: "" };

  const wordOps: [RegExp, ConditionOperator][] = [
    [/\s+not\s+contains\s+/i, "not_contains"],
    [/\s+contains\s+/i, "contains"],
    [/\s+starts\s+with\s+/i, "starts_with"],
    [/\s+not\s+in(?:\s+list)?\s+/i, "not_in"],
    [/\s+in(?:\s+list)?\s+/i, "in"],
  ];
  for (const [re, op] of wordOps) {
    const parts = t.split(re);
    if (parts.length === 2) {
      return { controlName: parts[0].trim(), operator: op, value: parts[1].trim() };
    }
  }

  const symOps: [string, ConditionOperator][] = [
    ["≠", "not_equals"],
    ["!=", "not_equals"],
    [">", "greater_than"],
    ["<", "less_than"],
    ["=", "equals"],
  ];
  for (const [sym, op] of symOps) {
    const i = t.indexOf(sym);
    if (i > 0) {
      return {
        controlName: t.slice(0, i).trim(),
        operator: op,
        value: t.slice(i + sym.length).trim(),
      };
    }
  }
  return null;
}

/**
 * Parse a "When" cell into RuleConditions. Groups are separated by " OR "
 * (optionally parenthesised), conditions within a group by " AND ":
 *   "A AND B"           -> one group
 *   "(A AND B) OR (C)"  -> two groups (OR)
 */
function parseWhen(text: string): RuleCondition[] {
  const s = text.trim();
  if (!s) return [];
  const out: RuleCondition[] = [];
  s.split(/\s+OR\s+/i).forEach((groupRaw, gi) => {
    let group = groupRaw.trim();
    if (group.startsWith("(") && group.endsWith(")")) {
      group = group.slice(1, -1).trim();
    }
    for (const token of group.split(/\s+AND\s+/i)) {
      const cond = parseCondition(token);
      if (cond) out.push({ ...cond, groupNo: gi + 1 });
    }
  });
  return out;
}

export interface RuleImportParse {
  columnError?: string;
  valid: ImportedRule[];
  errors: RowError[];
}

/** Accept the category value ("MATERIAL_UPGRADE") or its label ("Material Upgrade"). */
const CATEGORY_BY_INPUT: Record<string, RuleCategory> = (() => {
  const map: Record<string, RuleCategory> = {};
  for (const c of RULE_CATEGORIES) {
    map[c.toLowerCase()] = c;
    map[RULE_CATEGORY_LABELS[c].toLowerCase()] = c;
  }
  return map;
})();

/** Export every column the importer understands, so a round trip loses nothing. */
export function rulesToCsv(rules: ConfiguratorRule[]): string {
  return toCsv(
    [
      ...RULE_CSV_COLUMNS,
      "Revision",
      "Unit",
      // Renamed from "Formula" / "Count When", which gave no clue what they
      // held. The importer already accepted these longer names as aliases, so
      // spreadsheets exported before this still import unchanged.
      "Quantity Formula",
      "Condition Formula",
      "Notes",
      "When",
    ],
    rules.map((r) => [
      r.id,
      r.name,
      r.resultPartId,
      RULE_CATEGORY_LABELS[r.category],
      r.quantity,
      r.isActive ? "Yes" : "No",
      r.resultRevision ?? "",
      r.quantityUnit ?? "",
      r.quantityFormula ?? "",
      r.conditionFormula ?? "",
      r.notes ?? "",
      describeConditions(r.conditions),
    ])
  );
}

const truthy = new Set(["yes", "y", "true", "1", "active"]);

export function parseRuleCsv(text: string): RuleImportParse {
  const rows = parseCsv(text);
  if (rows.length === 0) {
    return { columnError: "The file is empty.", valid: [], errors: [] };
  }

  const header = rows[0].map((h) => h.trim().toLowerCase());
  const idx = {
    id: header.findIndex((h) => h === "rule id" || h === "id"),
    name: header.findIndex((h) => h === "name"),
    resultPart: header.findIndex((h) => h === "result part" || h === "result part id"),
    category: header.findIndex((h) => h === "category"),
    quantity: header.findIndex((h) => h === "quantity" || h === "qty"),
    active: header.findIndex((h) => h === "active"),
    when: header.findIndex((h) => h === "when" || h.startsWith("when")),
    revision: header.findIndex((h) => h === "revision"),
    unit: header.findIndex((h) => h === "unit"),
    formula: header.findIndex((h) => h === "formula" || h === "quantity formula"),
    countWhen: header.findIndex(
      (h) => h === "count when" || h === "condition formula"
    ),
    notes: header.findIndex((h) => h === "notes"),
  };
  const cell = (cells: string[], i: number) =>
    i === -1 ? "" : (cells[i] ?? "").trim();
  const missing: string[] = [];
  if (idx.id === -1) missing.push("Rule ID");
  if (idx.name === -1) missing.push("Name");
  if (idx.resultPart === -1) missing.push("Result Part");
  if (idx.category === -1) missing.push("Category");
  if (idx.quantity === -1) missing.push("Quantity");
  if (missing.length) {
    return {
      columnError: `Missing column(s): ${missing.join(", ")}. Header must include: ${RULE_CSV_COLUMNS.join(", ")}.`,
      valid: [],
      errors: [],
    };
  }

  const valid: ImportedRule[] = [];
  const errors: RowError[] = [];
  const seen = new Set<string>();

  for (let r = 1; r < rows.length; r++) {
    const cells = rows[r];
    const rowNo = r + 1;
    const id = (cells[idx.id] ?? "").trim();
    const name = (cells[idx.name] ?? "").trim();
    const resultPartId = (cells[idx.resultPart] ?? "").trim();
    const categoryRaw = (cells[idx.category] ?? "").trim();
    const quantityRaw = (cells[idx.quantity] ?? "").trim();
    const activeRaw = idx.active === -1 ? "" : (cells[idx.active] ?? "").trim();

    if (!id) {
      errors.push({ row: rowNo, message: "No rule id." });
      continue;
    }
    if (!name) {
      errors.push({ row: rowNo, message: `${id}: no name.` });
      continue;
    }
    if (!resultPartId) {
      errors.push({ row: rowNo, message: `${id}: no result part.` });
      continue;
    }
    const category = CATEGORY_BY_INPUT[categoryRaw.toLowerCase()];
    if (!category) {
      errors.push({
        row: rowNo,
        message: `${id}: wrong category "${categoryRaw}". Use one of: ${RULE_CATEGORIES.join(", ")}.`,
      });
      continue;
    }
    if (quantityRaw === "" || Number.isNaN(Number(quantityRaw))) {
      errors.push({ row: rowNo, message: `${id}: quantity "${quantityRaw}" is not a number.` });
      continue;
    }
    const key = id.toUpperCase();
    if (seen.has(key)) {
      errors.push({ row: rowNo, message: `${id}: duplicate rule id.` });
      continue;
    }
    seen.add(key);
    const unitRaw = cell(cells, idx.unit);
    if (unitRaw && !UNIT_BY_INPUT[unitRaw.toLowerCase()]) {
      errors.push({
        row: rowNo,
        message: `${id}: unknown unit "${unitRaw}". Use one of: ${QUANTITY_UNITS.join(", ")}.`,
      });
      continue;
    }
    const rule: ImportedRule = {
      id,
      name,
      resultPartId,
      category,
      quantity: quantityRaw,
      isActive: activeRaw === "" ? true : truthy.has(activeRaw.toLowerCase()),
      conditions: idx.when === -1 ? [] : parseWhen(cells[idx.when] ?? ""),
    };
    const revision = cell(cells, idx.revision);
    const formula = cell(cells, idx.formula);
    const countWhen = cell(cells, idx.countWhen);
    const notes = cell(cells, idx.notes);
    if (revision) rule.resultRevision = revision;
    if (unitRaw) rule.quantityUnit = UNIT_BY_INPUT[unitRaw.toLowerCase()];
    if (formula) rule.quantityFormula = formula;
    if (countWhen) rule.conditionFormula = countWhen;
    if (notes) rule.notes = notes;
    valid.push(rule);
  }

  return { valid, errors };
}
