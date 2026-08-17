import type { Configurator } from "@/types/configurator";
import type { ConfiguratorRule } from "@/types/configurator-rule";

export interface ConfigData {
  configurators: Configurator[];
  rules: ConfiguratorRule[];
  /** "api" when served by the Python backend, "mock" when falling back. */
  source: "api" | "mock";
}

export async function fetchConfigData(): Promise<ConfigData> {
  const res = await fetch("/api/config", { cache: "no-store" });
  return res.json();
}
