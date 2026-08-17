import {
  PARAMETER_KINDS,
  PARAMETER_KIND_LABELS,
  type ConfiguratorParameter,
  type ParameterKind,
  type ParameterOption,
} from "@/types/configurator";
import { parseCsv, toCsv } from "@/lib/csv";

export const PARAM_CSV_COLUMNS = ["Control Name", "Label", "Type"] as const;

/** Sample template shown by the "Template" button. */
export const PARAM_TEMPLATE_CSV = [
  "Control Name,Label,Type,Section,Options",
  "CMBEXAMPLE,Example Dropdown,Dropdown,Overview,|Option A|B=Option B Label",
  "CHKEXAMPLE,Example Checkbox,Checkbox,Upgrades,",
  "NUMEXAMPLE,Example Number,Number,Size,",
].join("\r\n");

export interface ImportedParam {
  controlName: string;
  label: string;
  kind: ParameterKind;
  /** Present only when the CSV had a Section column. */
  section?: string;
  /** Present only when the CSV had an Options column. */
  options?: ParameterOption[];
}

/**
 * Options are one CSV cell: segments joined by "|", each "value=label"
 * (or just "value" when value === label). A blank segment is the empty option.
 */
export function serializeOptions(options?: ParameterOption[]): string {
  if (!options || options.length === 0) return "";
  return options
    .map((o) => (o.value === o.label ? o.value : `${o.value}=${o.label}`))
    .join("|");
}

export function parseOptions(cell: string): ParameterOption[] {
  const s = cell.trim();
  if (!s) return [];
  return s.split("|").map((seg) => {
    const i = seg.indexOf("=");
    if (i === -1) {
      const v = seg.trim();
      return { value: v, label: v };
    }
    return { value: seg.slice(0, i).trim(), label: seg.slice(i + 1).trim() };
  });
}

export interface RowError {
  row: number;
  message: string;
}

export interface ParamImportParse {
  /** Set when the header is missing a required column — nothing else runs. */
  columnError?: string;
  valid: ImportedParam[];
  errors: RowError[];
}

/** Accept either the kind value ("dropdown") or its label ("Dropdown"). */
const KIND_BY_INPUT: Record<string, ParameterKind> = (() => {
  const map: Record<string, ParameterKind> = {};
  for (const k of PARAMETER_KINDS) {
    map[k.toLowerCase()] = k;
    map[PARAMETER_KIND_LABELS[k].toLowerCase()] = k;
  }
  return map;
})();

export function parametersToCsv(params: ConfiguratorParameter[]): string {
  return toCsv(
    [...PARAM_CSV_COLUMNS, "Section", "Options"],
    params.map((p) => [
      p.controlName,
      p.label,
      PARAMETER_KIND_LABELS[p.kind],
      p.section ?? "",
      serializeOptions(p.options),
    ])
  );
}

export function parseParameterCsv(text: string): ParamImportParse {
  const rows = parseCsv(text);
  if (rows.length === 0) {
    return { columnError: "The file is empty.", valid: [], errors: [] };
  }

  const header = rows[0].map((h) => h.trim().toLowerCase());
  const idx = {
    controlName: header.findIndex((h) => h === "control name" || h === "controlname"),
    label: header.findIndex((h) => h === "label"),
    type: header.findIndex((h) => h === "type" || h === "kind"),
    section: header.findIndex((h) => h === "section"),
    options: header.findIndex((h) => h === "options"),
  };
  const missing: string[] = [];
  if (idx.controlName === -1) missing.push("Control Name");
  if (idx.label === -1) missing.push("Label");
  if (idx.type === -1) missing.push("Type");
  if (missing.length) {
    return {
      columnError: `Missing column(s): ${missing.join(", ")}. Header must be: ${PARAM_CSV_COLUMNS.join(", ")}.`,
      valid: [],
      errors: [],
    };
  }

  const valid: ImportedParam[] = [];
  const errors: RowError[] = [];
  const seen = new Set<string>();

  for (let r = 1; r < rows.length; r++) {
    const cells = rows[r];
    const rowNo = r + 1; // 1-based, including the header row
    const controlName = (cells[idx.controlName] ?? "").trim();
    const label = (cells[idx.label] ?? "").trim();
    const typeRaw = (cells[idx.type] ?? "").trim();

    if (!controlName) {
      errors.push({ row: rowNo, message: "No control name." });
      continue;
    }
    if (!label) {
      errors.push({ row: rowNo, message: `${controlName}: no label.` });
      continue;
    }
    const kind = KIND_BY_INPUT[typeRaw.toLowerCase()];
    if (!kind) {
      errors.push({
        row: rowNo,
        message: `${controlName}: wrong type "${typeRaw}". Use one of: ${PARAMETER_KINDS.join(", ")}.`,
      });
      continue;
    }
    const key = controlName.toUpperCase();
    if (seen.has(key)) {
      errors.push({ row: rowNo, message: `${controlName}: duplicate control name.` });
      continue;
    }
    seen.add(key);
    const section =
      idx.section === -1 ? undefined : (cells[idx.section] ?? "").trim();
    // A blank Options cell means "leave the existing options alone", not
    // "delete them all" — otherwise a file that only sets sections or labels
    // silently strips every dropdown. The API treats undefined the same way.
    const optionCell = idx.options === -1 ? "" : (cells[idx.options] ?? "").trim();
    const options = optionCell ? parseOptions(optionCell) : undefined;
    valid.push({ controlName, label, kind, section, options });
  }

  return { valid, errors };
}
