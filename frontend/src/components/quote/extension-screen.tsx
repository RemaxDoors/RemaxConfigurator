"use client";

import * as React from "react";
import { Blinds, Wrench } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { money } from "@/lib/format";
import type { Configurator, ConfiguratorParameter } from "@/types/configurator";

const SELECT_CLASS =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const TRUTHY = new Set(["1", "true", "yes"]);

export interface ExtensionPanel {
  /** "curtain" | "installation" */
  kind: string;
  configuratorId: string;
  title: string;
}

/**
 * A sub-configurator (curtain / installation) rendered as its own screen —
 * same layout language as the door steps, with room for its sections.
 */
export function ExtensionScreen({
  panel,
  configurator,
  values,
  onChange,
  price,
}: {
  panel: ExtensionPanel;
  configurator?: Configurator;
  values: Record<string, string>;
  onChange: (control: string, value: string) => void;
  price?: number | null;
}) {
  const params = (configurator?.parameters ?? []).filter(
    (p) => p.isVisible !== false
  );

  const sections: string[] = [];
  for (const p of params) {
    const s = p.section || "Options";
    if (!sections.includes(s)) sections.push(s);
  }

  const Icon = panel.kind === "curtain" ? Blinds : Wrench;

  const renderField = (param: ConfiguratorParameter) => {
    const value = values[param.controlName] ?? "";
    switch (param.kind) {
      case "dropdown":
        return (
          <select
            className={SELECT_CLASS}
            value={value}
            onChange={(e) => onChange(param.controlName, e.target.value)}
          >
            {(param.options ?? []).map((o) => (
              <option key={o.value} value={o.value}>
                {o.label || o.value}
              </option>
            ))}
          </select>
        );
      case "checkbox":
        return (
          <Switch
            checked={TRUTHY.has(value.toLowerCase())}
            onCheckedChange={(v) => onChange(param.controlName, v ? "1" : "0")}
            aria-label={param.label}
          />
        );
      case "number":
        return (
          <Input
            type="number"
            value={value}
            min={param.min}
            max={param.max}
            step={param.step}
            onChange={(e) => onChange(param.controlName, e.target.value)}
          />
        );
      default:
        return (
          <Input
            value={value}
            onChange={(e) => onChange(param.controlName, e.target.value)}
          />
        );
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 border-b pb-3">
        <Icon className="h-5 w-5 text-primary" />
        <h2 className="text-base font-semibold">{panel.title}</h2>
        {price != null && (
          <Badge variant="secondary" className="ml-auto tabular-nums">
            {money(price)}
          </Badge>
        )}
      </div>

      {params.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          No parameters configured for {panel.configuratorId}.
        </p>
      ) : (
        sections.map((section) => (
          <section key={section} className="space-y-3">
            <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {section}
            </h3>
            <div className="grid gap-4 sm:grid-cols-2">
              {params
                .filter((p) => (p.section || "Options") === section)
                .map((param) => (
                  <div
                    key={param.controlName}
                    className={
                      param.kind === "checkbox"
                        ? "flex items-center justify-between gap-2 rounded-md border px-3 py-2"
                        : "space-y-1.5"
                    }
                  >
                    <Label className="flex items-center gap-1">
                      {param.label}
                      {param.required && (
                        <span className="text-destructive">*</span>
                      )}
                    </Label>
                    {renderField(param)}
                    {param.helpText && param.kind !== "checkbox" && (
                      <p className="text-xs text-muted-foreground">
                        {param.helpText}
                      </p>
                    )}
                  </div>
                ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
