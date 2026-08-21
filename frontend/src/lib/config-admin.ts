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

export interface ParameterUsage {
  controlName: string;
  rules: {
    ruleCode: string;
    name: string;
    resultPartId: string | null;
    /** "condition" = a condition row names it; "formula" = it appears in a formula. */
    via: string;
  }[];
  validations: { ruleCode: string; message: string }[];
  defaults: { doorModel: string; value: string }[];
}

/** What refers to a parameter. Asked before offering to delete it. */
export async function fetchParameterUsage(
  configuratorId: string,
  controlName: string
): Promise<ParameterUsage> {
  const query = new URLSearchParams({ configuratorId, controlName });
  const res = await fetch(`/api/config/parameters?${query}`);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body.error || body.detail || `Lookup failed (${res.status})`);
  }
  return body as ParameterUsage;
}

/**
 * Delete a parameter. Its defaults always go with it.
 *
 * Without `cascade` the API refuses with a 409 when a rule or validation names
 * the parameter, and the thrown error carries that usage — a condition
 * pointing at a control that no longer exists stops matching silently, so this
 * must never happen by accident.
 */
export class ParameterInUseError extends Error {
  usage: ParameterUsage;
  constructor(message: string, usage: ParameterUsage) {
    super(message);
    this.name = "ParameterInUseError";
    this.usage = usage;
  }
}

export async function deleteParameterFromDb(
  configuratorId: string,
  controlName: string,
  cascade = false
): Promise<void> {
  const query = new URLSearchParams({ configuratorId, controlName });
  if (cascade) query.set("cascade", "true");
  const res = await fetch(`/api/config/parameters?${query}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    if (res.status === 409 && body?.detail?.usage) {
      throw new ParameterInUseError(
        body.detail.message || "Parameter is in use.",
        body.detail.usage as ParameterUsage
      );
    }
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

export interface ReplaceRulesResult extends ReplaceDefaultsResult {
  /**
   * Rules the API could not save, with the reason.
   *
   * replace_rules() saves each rule in its own savepoint so one bad row cannot
   * roll back a whole import — the cost is that a failure is reported in the
   * body of a 200 rather than thrown. This field was missing from the type, so
   * callers reported "Saved N rules" and said nothing about the ones dropped.
   */
  skipped?: { id: string; reason: string }[];
}

/** Save a configurator's rule set to the config DB (admin Save / CSV import). */
export async function replaceRulesInDb(
  configuratorId: string,
  rules: ConfiguratorRule[],
  changedBy?: string
): Promise<ReplaceRulesResult> {
  const res = await fetch("/api/config/rules/replace", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ configuratorId, rules, changedBy }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body.error || body.detail || `Save failed (${res.status})`);
  }
  return body as ReplaceRulesResult;
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
  changedBy?: string,
  /** Set to re-point the row at another door model. */
  move?: { newDoorModel: string | null }
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
      newDoorModel: move?.newDoorModel ?? null,
      // Explicit, so a form that posts the field without meaning to move
      // cannot re-point a row by accident.
      move: Boolean(move),
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body.error || body.detail || `Save failed (${res.status})`);
  }
  return body as { from: string; to: string };
}

/** Delete one default. Its conditions go with it. */
export async function deleteDefaultFromDb(
  configuratorId: string,
  doorModel: string | null,
  controlName: string,
  changedBy?: string
): Promise<void> {
  const res = await fetch("/api/config/defaults", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ configuratorId, doorModel, controlName, changedBy }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || body.detail || `Delete failed (${res.status})`);
  }
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
