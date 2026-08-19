import type { ConfiguratorDefault } from "@/types/configurator";
import { parseCsv, toCsv } from "@/lib/csv";
import type { RowError } from "@/lib/param-csv";

export const DEFAULT_CSV_COLUMNS = [
  "Door Model",
  "Control Name",
  "Default Value",
] as const;

/** Sample template shown by the "Template" button. */
export const DEFAULT_TEMPLATE_CSV = [
  "Door Model,Control Name,Default Value",
  "HS35,CMBBRUSHSEAL,500 top of Guides (Std)",
  "HS35,CMBPOWERSUPPLY,1P10A",
  "HS35,CMBTRAFFICLIGHT,No",
].join("\r\n");

/**
 * A default read from CSV always names a door model — the parser rejects rows
 * without one. That is narrower than ConfiguratorDefault, whose doorModel is
 * nullable for conditional and manual rows, and the distinction matters: only
 * per-model rows can be round-tripped through a spreadsheet.
 */
export type ImportedDefault = ConfiguratorDefault & { doorModel: string };

export interface DefaultImportParse {
  columnError?: string;
  valid: ImportedDefault[];
  errors: RowError[];
}

/**
 * Export the per-model defaults.
 *
 * Rows with no door model are deliberately left out. They are conditional or
 * manual defaults whose behaviour lives in uCfgDefaultConditions and the
 * IsManual flag, none of which fits in these three columns — exporting them
 * would produce rows that re-import as ordinary per-model defaults and quietly
 * change what the configurator does.
 */
export function defaultsToCsv(defaults: ConfiguratorDefault[]): string {
  return toCsv(
    [...DEFAULT_CSV_COLUMNS],
    defaults
      .filter((d) => d.doorModel)
      .map((d) => [d.doorModel as string, d.controlName, d.value])
  );
}

export function parseDefaultCsv(text: string): DefaultImportParse {
  const rows = parseCsv(text);
  if (rows.length === 0) {
    return { columnError: "The file is empty.", valid: [], errors: [] };
  }
  const header = rows[0].map((h) => h.trim().toLowerCase());
  const idx = {
    model: header.findIndex(
      (h) => h === "door model" || h === "doormodel" || h === "model"
    ),
    control: header.findIndex((h) => h === "control name" || h === "controlname"),
    value: header.findIndex((h) => h === "default value" || h === "value"),
  };
  const missing: string[] = [];
  if (idx.model === -1) missing.push("Door Model");
  if (idx.control === -1) missing.push("Control Name");
  if (idx.value === -1) missing.push("Default Value");
  if (missing.length) {
    return {
      columnError: `Missing column(s): ${missing.join(", ")}. Header must be: ${DEFAULT_CSV_COLUMNS.join(", ")}.`,
      valid: [],
      errors: [],
    };
  }

  const valid: ImportedDefault[] = [];
  const errors: RowError[] = [];
  const seen = new Set<string>();
  for (let r = 1; r < rows.length; r++) {
    const cells = rows[r];
    const rowNo = r + 1;
    const doorModel = (cells[idx.model] ?? "").trim();
    const controlName = (cells[idx.control] ?? "").trim();
    const value = (cells[idx.value] ?? "").trim(); // empty value is allowed

    if (!doorModel) {
      errors.push({ row: rowNo, message: "No door model." });
      continue;
    }
    if (!controlName) {
      errors.push({ row: rowNo, message: `${doorModel}: no control name.` });
      continue;
    }
    const key = `${doorModel.toUpperCase()}|${controlName.toUpperCase()}`;
    if (seen.has(key)) {
      errors.push({
        row: rowNo,
        message: `${doorModel} / ${controlName}: duplicate.`,
      });
      continue;
    }
    seen.add(key);
    valid.push({ doorModel, controlName, value });
  }
  return { valid, errors };
}
