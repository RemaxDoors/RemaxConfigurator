export interface M1Column {
  name: string;
  type: string;
  maxLength: number | null;
  nullable: boolean;
  readOnly: boolean;
}

export interface FieldMapEntry {
  entity: string;
  appField: string;
  m1Column: string | null;
  constant?: string | null;
  notes?: string | null;
}

export interface AppField {
  key: string;
  label: string;
  hint?: string;
  /** Must be mapped — the M1 insert is blocked without it. */
  required?: boolean;
}

export interface MapEntity {
  key: string;
  label: string;
  table: string;
  fields: AppField[];
}

/** The app-side fields available to map, per M1 target table. */
export const MAP_ENTITIES: MapEntity[] = [
  {
    key: "quote",
    label: "Quote header → Quotes",
    table: "Quotes",
    fields: [
      { key: "quoteId", label: "Quote ID", required: true },
      { key: "customerId", label: "Customer (organization id)", required: true },
      { key: "shipToOrgId", label: "Ship-to organization id", required: true },
      { key: "shipToLocationId", label: "Ship-to location id", required: true },
      { key: "projectName", label: "Project name", required: true },
      { key: "revision", label: "Revision" },
      { key: "salesPerson", label: "Sales person" },
      { key: "marginPercent", label: "Margin %" },
      { key: "quoteType", label: "Quote type" },
      { key: "createdBy", label: "Created by" },
      { key: "quoteDate", label: "Quote date" },
    ],
  },
  {
    key: "quoteLine",
    label: "Quote line → QuoteLines",
    table: "QuoteLines",
    fields: [
      { key: "quoteId", label: "Quote ID", required: true },
      { key: "quoteLineId", label: "Line ID", required: true },
      { key: "partId", label: "Part ID", required: true },
      { key: "partRevision", label: "Part revision" },
      { key: "partDescription", label: "Part description" },
      { key: "doorModel", label: "Door model" },
      { key: "curtainSell", label: "Curtain sell" },
    ],
  },
  {
    key: "quoteQuantity",
    label: "Line pricing → QuoteQuantities",
    table: "QuoteQuantities",
    fields: [
      { key: "quoteId", label: "Quote ID", required: true },
      { key: "quoteLineId", label: "Line ID", required: true },
      { key: "qty", label: "Quantity", required: true },
      {
        key: "totalUnitPrice",
        label: "Unit price (approved)",
        hint: "part price, or the configurator's calculated price",
        required: true,
      },
      { key: "totalPrice", label: "Total price (approved)", required: true },
      { key: "totalUnitCost", label: "Unit cost" },
      { key: "totalCost", label: "Total cost" },
      { key: "doorSellPrice", label: "Door sell price" },
      { key: "assemblyUpgrades", label: "Assembly upgrades" },
      { key: "materialUpgrades", label: "Material upgrades" },
      { key: "materialDiscounts", label: "Material discounts" },
      { key: "installSell", label: "Installation sell" },
      { key: "marginPercent", label: "Margin %" },
      { key: "resellerDiscount", label: "Reseller discount" },
    ],
  },
  {
    key: "formInput",
    label: "Configurator values → FormInputValues",
    table: "FormInputValues",
    fields: [
      { key: "controlName", label: "Control name", hint: "e.g. CMBDOORMODEL" },
      { key: "value", label: "Value" },
      { key: "formId", label: "Form ID", hint: "PART-{configuratorId}-REV-{rev}" },
      { key: "sourceUniqueId", label: "Source unique id", hint: "the quote line UniqueID" },
      { key: "sourceTable", label: "Source table", hint: "QUOTELINES" },
      { key: "parentFormId", label: "Parent form id" },
      { key: "topLevelFormId", label: "Top-level form id" },
    ],
  },
];

export async function fetchM1Columns(table: string): Promise<M1Column[]> {
  try {
    const res = await fetch(`/api/m1/columns?table=${encodeURIComponent(table)}`);
    if (!res.ok) return [];
    return (await res.json()).columns ?? [];
  } catch {
    return [];
  }
}

export async function fetchMapping(): Promise<FieldMapEntry[]> {
  try {
    const res = await fetch("/api/mapping");
    if (!res.ok) return [];
    return (await res.json()).mappings ?? [];
  } catch {
    return [];
  }
}

export async function saveMapping(
  entries: FieldMapEntry[],
  changedBy?: string
): Promise<{ saved: number }> {
  const res = await fetch("/api/mapping", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ entries, changedBy }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || body.detail || `Save failed (${res.status})`);
  return body as { saved: number };
}
