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

export interface Configurator {
  /** Template id, e.g. "RRD-MOVIDOR-TEMPLATE". */
  id: string;
  name: string;
  /** LINE_DOOR_TYPE this configurator applies to, e.g. "RRD". */
  doorTypeFilter?: string;
  parameters: ConfiguratorParameter[];
}

/**
 * A chosen value for one parameter. Maps directly to an M1 uFormInputValues
 * row (xaiControlName / xaiValue).
 */
export interface ConfiguredParameter {
  controlName: string;
  value: string;
}
