"use client";

import * as React from "react";
import { Plus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ControlSelect, ValueEditor } from "@/components/admin/condition-fields";
import type { ConfiguratorParameter } from "@/types/configurator";

/** One branch: when the field is one of these values, use this revision. */
export interface RevisionRule {
  controlName: string;
  /** Comma-separated list — multiple selection. */
  values: string;
  revision: string;
}

/** Compile the branches into a nested IF() that returns text. */
export function buildRevisionFormula(
  rules: RevisionRule[],
  fallback: string
): string {
  const usable = rules.filter(
    (r) => r.controlName && r.values.trim() && r.revision.trim()
  );
  if (usable.length === 0) return "";
  const wrap = (i: number): string => {
    if (i >= usable.length) return `"${fallback}"`;
    const r = usable[i];
    const vals = r.values
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);
    const test = vals.map((v) => `${r.controlName} = "${v}"`).join(" or ");
    return `IF(${test}, "${r.revision}", ${wrap(i + 1)})`;
  };
  return wrap(0);
}

/** Read a nested IF() revision formula back into branches. */
export function parseRevisionFormula(
  formula: string
): { rules: RevisionRule[]; fallback: string } | null {
  const f = (formula || "").trim();
  if (!f) return { rules: [], fallback: "" };
  const rules: RevisionRule[] = [];
  let rest = f;
  for (let guard = 0; guard < 12; guard++) {
    const m = rest.match(/^IF\s*\(([\s\S]*)\)$/i);
    if (!m) break;
    // split the IF's three arguments at top level
    const inner = m[1];
    const args: string[] = [];
    let depth = 0;
    let buf = "";
    let quoted = false;
    for (const ch of inner) {
      if (ch === '"') quoted = !quoted;
      if (!quoted) {
        if (ch === "(") depth++;
        if (ch === ")") depth--;
        if (ch === "," && depth === 0) {
          args.push(buf);
          buf = "";
          continue;
        }
      }
      buf += ch;
    }
    args.push(buf);
    if (args.length !== 3) return null;

    const [test, thenVal, elseVal] = args.map((a) => a.trim());
    const eqs = test
      .split(/\s+or\s+/i)
      .map((t) => t.trim().match(/^([\w]+)\s*=\s*"([^"]*)"$/));
    if (!eqs.length || eqs.some((e) => !e)) return null;
    const names = new Set(eqs.map((e) => e![1].toUpperCase()));
    if (names.size !== 1) return null;

    const rev = thenVal.match(/^"([^"]*)"$/);
    if (!rev) return null;
    rules.push({
      controlName: eqs[0]![1],
      values: eqs.map((e) => e![2]).join(", "),
      revision: rev[1],
    });

    const fall = elseVal.match(/^"([^"]*)"$/);
    if (fall) return { rules, fallback: fall[1] };
    rest = elseVal;
  }
  return rules.length ? { rules, fallback: "" } : null;
}

/**
 * Build a revision that depends on the configuration — the M1
 * `if … elseif … else` that picks CONCERT/M-FOLD vs EXCLUDE BOX vs FULL KIT.
 */
export function RevisionBuilder({
  parameters,
  rules,
  fallback,
  onChange,
}: {
  parameters: ConfiguratorParameter[];
  rules: RevisionRule[];
  fallback: string;
  onChange: (next: { rules: RevisionRule[]; fallback: string }) => void;
}) {
  const set = (patch: Partial<{ rules: RevisionRule[]; fallback: string }>) =>
    onChange({ rules, fallback, ...patch });

  const update = (i: number, patch: Partial<RevisionRule>) =>
    set({ rules: rules.map((r, j) => (j === i ? { ...r, ...patch } : r)) });

  return (
    <div className="space-y-3">
      {rules.map((r, i) => (
        <div key={i} className="space-y-1.5 rounded-md border p-2">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="font-medium uppercase">
              {i === 0 ? "If" : "Otherwise if"}
            </span>
            <span className="ml-auto">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => set({ rules: rules.filter((_, j) => j !== i) })}
                aria-label="Remove branch"
              >
                <X className="h-4 w-4" />
              </Button>
            </span>
          </div>
          <div className="flex flex-wrap items-start gap-2">
            <ControlSelect
              parameters={parameters}
              value={r.controlName}
              onChange={(controlName) => update(i, { controlName, values: "" })}
              className="min-w-[160px] flex-1"
            />
            <span className="pt-2 text-xs text-muted-foreground">is one of</span>
            <div className="w-56 shrink-0">
              <ValueEditor
                parameter={parameters.find(
                  (p) =>
                    p.controlName.toUpperCase() === r.controlName.toUpperCase()
                )}
                operator="in"
                value={r.values}
                onChange={(values) => update(i, { values })}
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-xs">Use revision</Label>
            <Input
              className="h-9 w-48"
              value={r.revision}
              onChange={(e) => update(i, { revision: e.target.value })}
              placeholder="e.g. CONCERT/M-FOLD"
            />
          </div>
        </div>
      ))}

      <Button
        variant="outline"
        size="sm"
        onClick={() =>
          set({
            rules: [...rules, { controlName: "", values: "", revision: "" }],
          })
        }
      >
        <Plus className="h-4 w-4" />
        {rules.length === 0 ? "Add a revision rule" : "Add another"}
      </Button>

      {rules.length > 0 && (
        <div className="flex items-center gap-2 border-t pt-3">
          <Label className="text-xs">Otherwise use</Label>
          <Input
            className="h-9 w-48"
            value={fallback}
            onChange={(e) => set({ fallback: e.target.value })}
            placeholder="e.g. FULL KIT"
          />
        </div>
      )}
    </div>
  );
}
