import type { ConfiguratorParameter } from "@/types/configurator";
import type { ConfiguratorRule } from "@/types/configurator-rule";

/**
 * Persist a parameter definition (label, kind, options, etc.) to the config DB
 * via the Python API. Used by the configurator admin page so edits survive a
 * page refresh and flow through to the configurator form.
 */
export async function saveParameterToDb(
  configuratorId: string,
  parameter: ConfiguratorParameter
): Promise<void> {
  const res = await fetch("/api/config/parameters", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ configuratorId, parameter }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || body.detail || `Save failed (${res.status})`);
  }
}

export async function deleteParameterFromDb(
  configuratorId: string,
  controlName: string
): Promise<void> {
  const query = new URLSearchParams({ configuratorId, controlName });
  const res = await fetch(`/api/config/parameters?${query}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || body.detail || `Delete failed (${res.status})`);
  }
}

export interface NewConfigurator {
  partId: string;
  name: string;
  doorType?: string;
  partRevision?: string;
  description?: string;
}

/** Create a new configurator template in the config DB. */
export async function createConfigurator(
  input: NewConfigurator
): Promise<{ id: string }> {
  const res = await fetch("/api/config", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body.error || body.detail || `Create failed (${res.status})`);
  }
  return body as { id: string };
}

export interface ReplaceParamsResult {
  created: number;
  updated: number;
  deleted: number;
  applied: number;
}

export interface ReplaceDefaultsResult {
  deleted: number;
  inserted: number;
}

/** Save a configurator's rule set to the config DB (admin Save / CSV import). */
export async function replaceRulesInDb(
  configuratorId: string,
  rules: ConfiguratorRule[],
  changedBy?: string
): Promise<ReplaceDefaultsResult> {
  const res = await fetch("/api/config/rules/replace", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ configuratorId, rules, changedBy }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body.error || body.detail || `Save failed (${res.status})`);
  }
  return body as ReplaceDefaultsResult;
}

/** Bulk replace a configurator's defaults (CSV import) via the API. */
export async function replaceDefaultsInDb(
  configuratorId: string,
  defaults: { doorModel: string; controlName: string; value: string }[],
  changedBy?: string
): Promise<ReplaceDefaultsResult> {
  const res = await fetch("/api/config/defaults/replace", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ configuratorId, defaults, changedBy }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body.error || body.detail || `Import failed (${res.status})`);
  }
  return body as ReplaceDefaultsResult;
}

/**
 * Change ONE default's value.
 *
 * Not replaceDefaultsInDb with the row swapped in: that deletes the whole set
 * and re-inserts four columns, which loses Priority / ValueFormula / IsManual /
 * ParentPartID and cannot delete a row that a default condition references.
 * `doorModel: null` targets the conditional/manual row for that control.
 */
export async function updateDefaultInDb(
  configuratorId: string,
  doorModel: string | null,
  controlName: string,
  value: string,
  changedBy?: string
): Promise<{ from: string; to: string }> {
  const res = await fetch("/api/config/defaults", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      configuratorId,
      doorModel,
      controlName,
      value,
      changedBy,
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body.error || body.detail || `Save failed (${res.status})`);
  }
  return body as { from: string; to: string };
}

/** Bulk replace a configurator's parameter set (CSV import) via the API. */
export async function replaceParametersInDb(
  configuratorId: string,
  parameters: {
    controlName: string;
    label: string;
    kind: string;
    section?: string;
    options?: { value: string; label: string }[];
  }[],
  changedBy?: string
): Promise<ReplaceParamsResult> {
  const res = await fetch("/api/config/parameters/replace", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ configuratorId, parameters, changedBy }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body.error || body.detail || `Import failed (${res.status})`);
  }
  return body as ReplaceParamsResult;
}
