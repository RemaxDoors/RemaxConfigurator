/**
 * The configurator schema — this is what makes a configurator *data-driven*
 * instead of hard-coded. A `Configurator` declares its parameters (and their
 * input kind), so the UI can render each field generically and the rules
 * engine can reason over the same control names.
 *
 * Control names follow M1 conventions:
 *   CMB* → dropdown · CHK* → checkbox · NUM* → number · (other) → text
 */

export type ParameterKind = "dropdown" | "checkbox" | "text" | "number";

export const PARAMETER_KINDS: ParameterKind[] = [
  "dropdown",
  "checkbox",
  "text",
  "number",
];

export const PARAMETER_KIND_LABELS: Record<ParameterKind, string> = {
  dropdown: "Dropdown",
  checkbox: "Checkbox",
  text: "Text",
  number: "Number",
};

export interface ParameterOption {
  value: string;
  label: string;
}

export interface ConfiguratorParameter {
  /** M1 xaiControlName, e.g. "CMBUPS", "CHKHYPERLIFT", "NUMDOORWIDTH". */
  controlName: string;
  /** Friendly label shown in the UI. */
  label: string;
  kind: ParameterKind;
  /** Whether the field is shown on the salesperson form (hidden defaults are false). */
  isVisible?: boolean;
  /** Form section / wizard step this parameter belongs to, e.g. "Overview". */
  section?: string;
  /** Options for `dropdown`. */
  options?: ParameterOption[];
  defaultValue?: string | number | boolean;
  required?: boolean;
  /** Bounds for `number`. */
  min?: number;
  max?: number;
  step?: number;
  helpText?: string;
}

/**
 * A default selection: when the door model is `doorModel`, the parameter
 * `controlName` is pre-set to `value`. Maps to a uCfgDefaults row.
 */
export interface ConfiguratorDefault {
  /**
   * The door model this default applies to, or `null` for a row that is not
   * tied to one model. A null row is either a *conditional* default (its
   * conditions live in uCfgDefaultConditions and only the API can evaluate
   * them) or a *manual* one such as freight, which must never be applied
   * automatically. Neither may be pre-filled by the form — ask the API via
   * /defaults/resolve instead.
   */
  doorModel: string | null;
  controlName: string;
  value: string;
  /**
   * The customer specification this default belongs to, when it came from one.
   *
   * Also part of UQ_uCfgDefaults — without it a second specification setting
   * the same control collides with the first, because a spec default has no
   * DoorModel to tell them apart.
   */
  specName?: string;
}

export interface Configurator {
  /** Template id, e.g. "RRD-MOVIDOR-TEMPLATE". */
  id: string;
  name: string;
  /** LINE_DOOR_TYPE this configurator applies to, e.g. "RRD". */
  doorTypeFilter?: string;
  /**
   * uCfgConfigurators.PartRevision — what M1 puts in the form id,
   * PART-{id}-REV-{partRevision}. Movidor is "BOM"; curtain and installation
   * are blank, so their ids end in "REV-". nvarchar(5) in M1.
   */
  partRevision?: string;
  parameters: ConfiguratorParameter[];
  /** Model-driven default selections (from uCfgDefaults). */
  defaults?: ConfiguratorDefault[];
}

/**
 * A chosen value for one parameter. Maps directly to an M1 uFormInputValues
 * row (xaiControlName / xaiValue).
 */
export interface ConfiguredParameter {
  controlName: string;
  value: string;
}
