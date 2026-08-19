import type { Configurator } from "@/types/configurator";
import type { ConfiguratorRule } from "@/types/configurator-rule";

export interface ConfigData {
  configurators: Configurator[];
  rules: ConfiguratorRule[];
  /**
   * "api" when the Python backend answered. Anything else means the config
   * database could not be read — there is no bundled fallback, because showing
   * a stand-in configurator invites quoting against parameters that don't exist.
   */
  source: "api" | "unavailable";
  /** Why it was unavailable, for display. */
  error?: string;
}

export async function fetchConfigData(): Promise<ConfigData> {
  try {
    const res = await fetch("/api/config", { cache: "no-store" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        configurators: [],
        rules: [],
        source: "unavailable",
        error: data.error || data.detail || `Config API returned ${res.status}.`,
      };
    }
    return { ...data, source: "api" };
  } catch {
    return {
      configurators: [],
      rules: [],
      source: "unavailable",
      error: "Could not reach the config API.",
    };
  }
}
