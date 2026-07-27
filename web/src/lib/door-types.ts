/**
 * Door type catalogue for the New Line wizard. Each door type maps to a
 * configurator template and knows whether it needs a curtain configurator
 * (only Rapid doors do).
 */

export type DoorTypeId = "RRD" | "ENTURI" | "STRIPDOOR" | "SWI";

export interface DoorTypeDef {
  id: DoorTypeId;
  label: string;
  description: string;
  configuratorId: string;
  models: string[];
  /** Only Rapid doors need a curtain configurator. */
  needsCurtain: boolean;
}

export const DOOR_TYPES: DoorTypeDef[] = [
  {
    id: "RRD",
    label: "Rapid",
    description: "Rapid roll doors (Movidor range)",
    configuratorId: "RRD-MOVIDOR-TEMPLATE",
    models: ["ES40", "HS50", "HS50-THERMIC", "EX35", "MOVICHILL", "CONCERTINA"],
    needsCurtain: true,
  },
  {
    id: "ENTURI",
    label: "Enturi",
    description: "Enturi doors",
    configuratorId: "RMX-ENTURI-TEMPLATE",
    models: ["ENTURI"],
    needsCurtain: false,
  },
  {
    id: "STRIPDOOR",
    label: "Strip",
    description: "Strip doors",
    configuratorId: "STRIPDOOR-TEMPLATE",
    models: ["STRIPDOOR"],
    needsCurtain: false,
  },
  {
    id: "SWI",
    label: "Swing",
    description: "Swing doors (PVC / Thermal)",
    configuratorId: "SWI-PVC-TEMPLATE",
    models: ["2400", "3000", "4500", "5000"],
    needsCurtain: false,
  },
];

/** Part ID from door type + model (mirrors the current app's convention). */
export function partIdFor(typeId: DoorTypeId, model: string): string {
  if (typeId === "STRIPDOOR") return "STRIPDOOR";
  return `${typeId}-${model}`;
}

/** Swing doors split into PVC vs Thermal by model; others use their default. */
export function configuratorFor(type: DoorTypeDef, model: string): string {
  if (type.id === "SWI") {
    return model === "4500" || model === "5000"
      ? "SWI-THERMAL-TEMPLATE"
      : "SWI-PVC-TEMPLATE";
  }
  return type.configuratorId;
}
