import type { Configurator } from "@/types/configurator";

/**
 * A sample data-driven configurator definition. This demonstrates how a
 * configurator's inputs become *data* (each parameter declares its kind) so the
 * UI can render fields generically and engineering can maintain them without
 * code changes. Stands in for the backend until the config store exists.
 */
export const MOCK_CONFIGURATORS: Configurator[] = [
  {
    id: "RRD-MOVIDOR-TEMPLATE",
    name: "RRD Movidor",
    doorTypeFilter: "RRD",
    parameters: [
      {
        controlName: "CMBDOORMODEL",
        label: "Door model",
        kind: "dropdown",
        required: true,
        options: [
          { value: "ES40", label: "ES40" },
          { value: "HS50", label: "HS50" },
          { value: "HS50-THERMIC", label: "HS50 Thermic" },
          { value: "EX35", label: "EX35" },
        ],
      },
      {
        controlName: "NUMDOORHEIGHT",
        label: "Door height (mm)",
        kind: "number",
        required: true,
        min: 1000,
        max: 10000,
        step: 10,
      },
      {
        controlName: "NUMDOORWIDTH",
        label: "Door width (mm)",
        kind: "number",
        required: true,
        min: 1000,
        max: 10000,
        step: 10,
      },
      {
        controlName: "CMBUPS",
        label: "UPS",
        kind: "dropdown",
        options: [
          { value: "", label: "None" },
          { value: "1kVA", label: "1 kVA" },
          { value: "3kVA", label: "3 kVA" },
        ],
      },
      {
        controlName: "CHKHYPERLIFT",
        label: "Hyperlift",
        kind: "checkbox",
        defaultValue: false,
      },
      {
        controlName: "TXTSPECIALNOTES",
        label: "Special notes",
        kind: "text",
        helpText: "Free-text notes passed through to manufacturing.",
      },
    ],
  },
];
