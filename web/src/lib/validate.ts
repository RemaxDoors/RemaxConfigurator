export interface ValidationMessage {
  field?: string;
  message: string;
  rule?: string;
}

export interface ValidationResult {
  errors: ValidationMessage[];
  warnings: ValidationMessage[];
  is_valid: boolean;
  /** True when the validation API was unreachable and validation was skipped. */
  unavailable?: boolean;
}

export async function validateConfiguration(
  configuratorId: string,
  values: Record<string, string>
): Promise<ValidationResult> {
  const res = await fetch("/api/validate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ configuratorId, values }),
  });
  return res.json();
}
