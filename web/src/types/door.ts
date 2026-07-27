import type { ConfiguredParameter } from "@/types/configurator";
import type { Part } from "@/types/part";

/**
 * A Door IS a Part — a sellable part that is *configured*: the buyer uses a
 * configurator to choose options, and pricing is generated from those options.
 * It inherits all part fields (id, revision, descriptions, qty) and adds the
 * configurator it was built with plus the chosen parameter values.
 */
export interface Door extends Part {
  /** The configurator template used, e.g. "RRD-MOVIDOR-TEMPLATE". */
  configuratorId: string;
  /** The selected parameter values (→ M1 uFormInputValues). */
  parameters: ConfiguredParameter[];
}

/** Narrows a Part to a Door (i.e. is this part configured?). */
export function isDoor(part: Part): part is Door {
  return "configuratorId" in part;
}
