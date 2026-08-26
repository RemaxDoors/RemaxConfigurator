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
  /**
   * The CONFIGURATOR's revision — uCfgConfigurators.PartRevision, not the
   * quote's. M1 builds the form id as PART-{configuratorId}-REV-{revision},
   * so Movidor is PART-RRD-MOVIDOR-TEMPLATE-REV-BOM. Blank is a real value:
   * curtain and installation both carry an empty revision in M1.
   */
  configuratorRevision?: string;
  /** The selected parameter values (→ M1 uFormInputValues). */
  parameters: ConfiguredParameter[];
}

/** Narrows a Part to a Door (i.e. is this part configured?). */
export function isDoor(part: Part): part is Door {
  return "configuratorId" in part;
}
