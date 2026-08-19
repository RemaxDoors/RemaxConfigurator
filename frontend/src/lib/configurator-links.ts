export interface ConfiguratorLink {
  parentId: string;
  childId: string;
  /** "curtain" | "installation" */
  linkType: string;
  isAutomatic: boolean;
  notes?: string | null;
}

/** Which sub-configurators run under each door configurator (from the config DB). */
export async function fetchConfiguratorLinks(): Promise<ConfiguratorLink[]> {
  try {
    const res = await fetch("/api/config/links");
    if (!res.ok) return [];
    return (await res.json()).links ?? [];
  } catch {
    return [];
  }
}

/** A default that is only calculated when the user asks (e.g. the freight button). */
export interface ManualDefault {
  controlName: string;
  formula: string;
}

export interface ResolvedDefaults {
  defaults: Record<string, string>;
  manual: ManualDefault[];
}

/** Defaults that apply to the current selection (conditions + formulas). */
export async function resolveDefaults(
  configuratorId: string,
  values: Record<string, string>,
  parentPartId?: string
): Promise<ResolvedDefaults> {
  try {
    const res = await fetch("/api/config/defaults/resolve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ configuratorId, values, parentPartId }),
    });
    if (!res.ok) return { defaults: {}, manual: [] };
    const data = await res.json();
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(data.defaults ?? {})) {
      out[k] = v === null || v === undefined ? "" : String(v);
    }
    return { defaults: out, manual: data.manual ?? [] };
  } catch {
    return { defaults: {}, manual: [] };
  }
}

/** Evaluate a formula against the current values (used by calculate buttons). */
export async function evaluateFormula(
  formula: string,
  values: Record<string, string>
): Promise<{ ok: boolean; result?: number; error?: string }> {
  try {
    const res = await fetch("/api/formula/check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ formula, values }),
    });
    return await res.json();
  } catch {
    return { ok: false, error: "Could not reach the API." };
  }
}
