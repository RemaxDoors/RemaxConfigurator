import type { ConfiguratorDefault } from "@/types/configurator";
import { parseCsv, toCsv } from "@/lib/csv";
import type { RowError } from "@/lib/param-csv";

export const DEFAULT_CSV_COLUMNS = [
  "Door Model",
  "Specification",
  "Control Name",
  "Default Value",
] as const;

/** Sample template shown by the "Template" button. */
export const DEFAULT_TEMPLATE_CSV = [
  "Door Model,Specification,Control Name,Default Value",
  "HS35,,CMBBRUSHSEAL,500 top of Guides (Std)",
  "HS35,,CMBPOWERSUPPLY,1P10A",
  "HS35,,CMBTRAFFICLIGHT,No",
  ",Coles - EX35,CMBCURTAINCOLOUR,Grey 705",
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
 * Export every default, including the specification ones.
 *
 * These used to be filtered out entirely — `.filter((d) => d.doorModel)` — so
 * a specification's rows never appeared in the export at all, and there was no
 * way to review them in a spreadsheet. They are all DoorModel NULL, which is
 * exactly what that filter dropped.
 *
 * The Specification column tells them apart. It is exported for reading and
 * checking; parseDefaultCsv refuses to import a row that has one, because a
 * specification default is only meaningful together with its row in
 * uCfgDefaultConditions, and the import path is a whole-set replace that would
 * strip those conditions and leave the values applying to every quote.
 */
export function defaultsToCsv(defaults: ConfiguratorDefault[]): string {
  return toCsv(
    [...DEFAULT_CSV_COLUMNS],
    defaults.map((d) => [
      d.doorModel ?? "",
      d.specName ?? "",
      d.controlName,
      d.value ?? "",
    ])
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
    spec: header.findIndex(
      (h) => h === "specification" || h === "specname" || h === "spec"
    ),
    control: header.findIndex((h) => h === "control name" || h === "controlname"),
    value: header.findIndex((h) => h === "default value" || h === "value"),
  };
  const missing: string[] = [];
  if (idx.model === -1) missing.push("Door Model");
  if (idx.control === -1) missing.push("Control Name");
  if (idx.value === -1) missing.push("Default Value");
  // Specification is optional on import: a file exported before that column
  // existed must still load.
  if (missing.length) {
    return {
      columnError: `Missing column(s): ${missing.join(", ")}. Header must include: Door Model, Control Name, Default Value.`,
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
    const specName = idx.spec === -1 ? "" : (cells[idx.spec] ?? "").trim();
    const controlName = (cells[idx.control] ?? "").trim();
    const value = (cells[idx.value] ?? "").trim(); // empty value is allowed

    if (specName) {
      // Refused rather than silently dropped. Importing one would keep the
      // value and lose the condition that decides when it applies, so a
      // Coles-only setting would start applying to every quote.
      errors.push({
        row: rowNo,
        message: `${specName} / ${controlName}: specification defaults cannot be imported here — their conditions do not fit these columns. Edit them on the Defaults tab, or re-run db/migrations/v0.4.0/01_spec_defaults_rrd.sql.`,
      });
      continue;
    }
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
