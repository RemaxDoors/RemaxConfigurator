"use client";

import * as React from "react";
import { Plus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { ControlSelect, ValueEditor } from "@/components/admin/condition-fields";
import type { ConfiguratorParameter } from "@/types/configurator";

const SELECT_CLASS =
  "flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

/** Comparisons offered in the builder, with the formula text they produce. */
const OPS: { key: string; label: string; needsValue: boolean }[] = [
  { key: "=", label: "is", needsValue: true },
  { key: "!=", label: "is not", needsValue: true },
  { key: ">", label: "is greater than", needsValue: true },
  { key: "<", label: "is less than", needsValue: true },
  { key: "contains", label: "contains", needsValue: true },
  { key: "startsWith", label: "starts with", needsValue: true },
  { key: "in", label: "is one of", needsValue: true },
  { key: "checked", label: "is ticked", needsValue: false },
  { key: "notChecked", label: "is not ticked", needsValue: false },
];

export interface QtyCondition {
  controlName: string;
  op: string;
  value: string;
  /** How this row joins to the previous one. */
  join: "and" | "or";
}

/** Build the formula text from the builder state. */
export function buildFormula(
  conditions: QtyCondition[],
  thenQty: string,
  elseQty: string
): string {
  const parts = conditions
    .filter((c) => c.controlName)
    .map((c, i) => {
      let expr: string;
      if (c.op === "checked") expr = c.controlName;
      else if (c.op === "notChecked") expr = `not ${c.controlName}`;
      else if (c.op === "contains") expr = `contains(${c.controlName}, "${c.value}")`;
      else if (c.op === "startsWith") expr = `startsWith(${c.controlName}, "${c.value}")`;
      else if (c.op === "in") {
        const vals = c.value.split(",").map((v) => v.trim()).filter(Boolean);
        expr = vals.length
          ? `(${vals.map((v) => `${c.controlName} = "${v}"`).join(" or ")})`
          : "1 = 1";
      }
      else {
        const numeric = c.value !== "" && !Number.isNaN(Number(c.value));
        const rhs = numeric ? c.value : `"${c.value}"`;
        expr = `${c.controlName} ${c.op} ${rhs}`;
      }
      return i === 0 ? expr : `${c.join} ${expr}`;
    });
  if (parts.length === 0) return thenQty || "1";
  return `IF(${parts.join(" ")}, ${thenQty || "1"}, ${elseQty || "0"})`;
}

/** Split on top-level and/or, leaving bracketed groups whole. */
function splitTopLevel(text: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let buf = "";
  let inQuote = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') inQuote = !inQuote;
    if (!inQuote) {
      if (ch === "(") depth++;
      if (ch === ")") depth--;
      if (depth === 0) {
        const rest = text.slice(i);
        const m = rest.match(/^\s+(and|or)\s+/i);
        if (m) {
          out.push(buf.trim(), m[1].toLowerCase());
          buf = "";
          i += m[0].length - 1;
          continue;
        }
      }
    }
    buf += ch;
  }
  if (buf.trim()) out.push(buf.trim());
  return out.filter(Boolean);
}

/** Try to read a builder-shaped formula back into the builder. */
export function parseFormula(
  formula: string
): { conditions: QtyCondition[]; thenQty: string; elseQty: string } | null {
  const f = (formula || "").trim();
  if (!f) return { conditions: [], thenQty: "1", elseQty: "0" };
  const m = f.match(/^IF\s*\(([\s\S]*),\s*([^,]+?)\s*,\s*([^,]+?)\s*\)$/i);
  if (!m) return null;
  const [, condText, thenQty, elseQty] = m;

  const tokens = splitTopLevel(condText);
  const conditions: QtyCondition[] = [];
  let join: "and" | "or" = "and";
  for (const raw of tokens) {
    const t = raw.trim();
    if (/^(and|or)$/i.test(t)) {
      join = t.toLowerCase() as "and" | "or";
      continue;
    }
    let c: QtyCondition | null = null;

    // an "is one of" group: (X = "a" or X = "b")
    if (t.startsWith("(") && t.endsWith(")")) {
      const inner = t.slice(1, -1);
      const parts = splitTopLevel(inner).filter((x) => !/^(and|or)$/i.test(x));
      const eqs = parts.map((x) =>
        x.trim().match(/^([\w]+)\s*=\s*"([^"]*)"$/)
      );
      if (eqs.length && eqs.every((m) => m) && /or/i.test(inner)) {
        const names = new Set(eqs.map((m) => m![1].toUpperCase()));
        if (names.size === 1) {
          c = {
            controlName: eqs[0]![1],
            op: "in",
            value: eqs.map((m) => m![2]).join(", "),
            join,
          };
        }
      }
      if (!c) return null;
    }

    if (!c) {
      const fn = t.match(/^(contains|startsWith)\s*\(\s*([\w]+)\s*,\s*"([^"]*)"\s*\)$/i);
      if (fn) c = { controlName: fn[2], op: fn[1], value: fn[3], join };
    }
    if (!c) {
      const not = t.match(/^not\s+([\w]+)$/i);
      if (not) c = { controlName: not[1], op: "notChecked", value: "", join };
    }
    if (!c) {
      const cmp = t.match(/^([\w]+)\s*(!=|>=|<=|=|>|<)\s*"?([^"]*)"?$/);
      if (cmp) c = { controlName: cmp[1], op: cmp[2], value: cmp[3].trim(), join };
    }
    if (!c && /^[\w]+$/.test(t)) c = { controlName: t, op: "checked", value: "", join };
    if (!c) return null; // something we can't represent — keep the raw editor
    conditions.push(c);
  }
  return { conditions, thenQty: thenQty.trim(), elseQty: elseQty.trim() };
}

/**
 * Point-and-click builder for a conditional quantity — no formula syntax needed.
 * Produces the same expression the engine evaluates.
 */
export function QuantityBuilder({
  parameters,
  conditions,
  thenQty,
  elseQty,
  onChange,
}: {
  parameters: ConfiguratorParameter[];
  conditions: QtyCondition[];
  thenQty: string;
  elseQty: string;
  onChange: (next: {
    conditions: QtyCondition[];
    thenQty: string;
    elseQty: string;
  }) => void;
}) {
  const set = (patch: Partial<{ conditions: QtyCondition[]; thenQty: string; elseQty: string }>) =>
    onChange({ conditions, thenQty, elseQty, ...patch });

  const update = (i: number, patch: Partial<QtyCondition>) =>
    set({ conditions: conditions.map((c, j) => (j === i ? { ...c, ...patch } : c)) });

  const paramFor = (name: string) =>
    parameters.find((p) => p.controlName.toUpperCase() === name.toUpperCase());

  return (
    <div className="space-y-2">
      {conditions.length === 0 && (
        <p className="text-xs text-muted-foreground">
          No conditions — the quantity is always <b>{thenQty || "1"}</b>.
        </p>
      )}

      {conditions.map((c, i) => {
        const param = paramFor(c.controlName);
        const op = OPS.find((o) => o.key === c.op);
        const options = param?.options ?? [];
        return (
          <div key={i} className="space-y-1.5">
            {i > 0 && (
              <div className="flex gap-1">
                {(["and", "or"] as const).map((j) => (
                  <button
                    key={j}
                    type="button"
                    onClick={() => update(i, { join: j })}
                    className={cn(
                      "rounded px-2 py-0.5 text-xs font-medium uppercase transition-colors",
                      c.join === j
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:bg-accent"
                    )}
                  >
                    {j}
                  </button>
                ))}
              </div>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted-foreground">
                {i === 0 ? "If" : ""}
              </span>
              <ControlSelect
                parameters={parameters}
                value={c.controlName}
                onChange={(controlName) => update(i, { controlName, value: "" })}
                className="min-w-[160px] flex-1"
              />

              <select
                className={cn(SELECT_CLASS, "w-40 shrink-0")}
                value={c.op}
                onChange={(e) => update(i, { op: e.target.value })}
              >
                {OPS.map((o) => (
                  <option key={o.key} value={o.key}>
                    {o.label}
                  </option>
                ))}
              </select>

              {op?.needsValue && (
                <div className="w-52 shrink-0">
                  <ValueEditor
                    parameter={param}
                    operator={c.op === "in" ? "in" : c.op}
                    value={c.value}
                    onChange={(value) => update(i, { value })}
                  />
                </div>
              )}

              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={() => set({ conditions: conditions.filter((_, j) => j !== i) })}
                aria-label="Remove condition"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        );
      })}

      <Button
        variant="outline"
        size="sm"
        onClick={() =>
          set({
            conditions: [
              ...conditions,
              { controlName: "", op: "=", value: "", join: "and" },
            ],
          })
        }
      >
        <Plus className="h-4 w-4" />
        {conditions.length === 0 ? "Add a condition" : "Add another condition"}
      </Button>

      <div className="flex flex-wrap items-end gap-3 border-t pt-3">
        <div className="space-y-1">
          <Label className="text-xs">
            {conditions.length ? "Then quantity is" : "Quantity is"}
          </Label>
          <Input
            className="h-9 w-24"
            value={thenQty}
            onChange={(e) => set({ thenQty: e.target.value })}
            placeholder="2"
          />
        </div>
        {conditions.length > 0 && (
          <div className="space-y-1">
            <Label className="text-xs">Otherwise</Label>
            <Input
              className="h-9 w-24"
              value={elseQty}
              onChange={(e) => set({ elseQty: e.target.value })}
              placeholder="1"
            />
          </div>
        )}
      </div>
    </div>
  );
}
