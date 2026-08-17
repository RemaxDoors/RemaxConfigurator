"use client";

import * as React from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SELECT_CLASS, ValueEditor } from "@/components/admin/condition-fields";
import { slotGroups } from "@/types/configurator-rule";
import type { ConfiguratorParameter } from "@/types/configurator";

/**
 * The M1 configurator repeats one shape across dozens of rules: walk a numbered
 * set of controls (cmbAct1..cmbAct4), count the ones that match, then act on the
 * count. This builder writes that as a formula so nobody has to type it.
 */
export interface SlotCount {
  /** Control-name prefix, e.g. "CMBACT". */
  prefix: string;
  match: "starts" | "equals" | "contains";
  /** Comma-separated — any one of these counts as a match. */
  values: string;
  /** Skip slots that also contain this, e.g. "Existing". */
  exclude: string;
  compare: ">" | ">=" | "=" | "<";
  amount: string;
}

export const EMPTY_SLOT_COUNT: SlotCount = {
  prefix: "",
  match: "starts",
  values: "",
  exclude: "",
  compare: ">",
  amount: "0",
};

const FN: Record<SlotCount["match"], string> = {
  starts: "countStartsWith",
  equals: "countEquals",
  contains: "countContains",
};

const quote = (s: string) => `"${s.replace(/"/g, "")}"`;

/** One count expression — several values become a sum of counts. */
function countExpr(c: SlotCount): string {
  const values = c.values
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
  if (!c.prefix || values.length === 0) return "";
  const args = (v: string) =>
    [`group(${quote(c.prefix)})`, quote(v), c.exclude.trim() ? quote(c.exclude.trim()) : ""]
      .filter(Boolean)
      .join(", ");
  const terms = values.map((v) => `${FN[c.match]}(${args(v)})`);
  return terms.length === 1 ? terms[0] : terms.join(" + ");
}

export function buildSlotFormula(c: SlotCount): string {
  const expr = countExpr(c);
  if (!expr) return "";
  const amount = c.amount.trim() || "0";
  const wrapped = expr.includes(" + ") ? `(${expr})` : expr;
  return `${wrapped} ${c.compare} ${amount}`;
}

/** Read a formula this builder wrote back into its parts. */
export function parseSlotFormula(formula: string): SlotCount | null {
  const f = (formula || "").trim();
  if (!f) return null;
  const tail = f.match(/^(.*?)\s*(>=|<=|>|<|=)\s*([\d.]+)$/);
  if (!tail) return null;
  const body = tail[1].replace(/^\((.*)\)$/, "$1");

  const terms = body.split("+").map((t) => t.trim());
  const parsed = terms.map((t) =>
    t.match(
      /^count(StartsWith|Equals|Contains)\(\s*group\(\s*"([^"]*)"\s*\)\s*,\s*"([^"]*)"\s*(?:,\s*"([^"]*)"\s*)?\)$/i
    )
  );
  if (parsed.some((p) => !p)) return null;

  const kinds = new Set(parsed.map((p) => p![1].toLowerCase()));
  const prefixes = new Set(parsed.map((p) => p![2].toUpperCase()));
  const excludes = new Set(parsed.map((p) => p![4] ?? ""));
  if (kinds.size !== 1 || prefixes.size !== 1 || excludes.size !== 1) return null;

  const kind = parsed[0]![1].toLowerCase();
  return {
    prefix: parsed[0]![2],
    match: kind === "equals" ? "equals" : kind === "contains" ? "contains" : "starts",
    values: parsed.map((p) => p![3]).join(", "),
    exclude: parsed[0]![4] ?? "",
    compare: tail[2] as SlotCount["compare"],
    amount: tail[3],
  };
}

export function SlotCounter({
  parameters,
  value,
  onChange,
}: {
  parameters: ConfiguratorParameter[];
  value: SlotCount;
  onChange: (next: SlotCount) => void;
}) {
  const groups = React.useMemo(() => slotGroups(parameters), [parameters]);
  const set = (patch: Partial<SlotCount>) => onChange({ ...value, ...patch });

  // Offer the options of the first slot in the group (CMBACT1) — every slot in
  // a numbered set shares one option list.
  const sample = parameters.find(
    (p) => p.controlName.toUpperCase() === `${value.prefix}1`
  );

  return (
    <div className="space-y-2 rounded-md border p-2">
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-[150px] flex-1">
          <Label className="text-xs">Count across</Label>
          <select
            className={SELECT_CLASS}
            value={value.prefix}
            onChange={(e) => set({ prefix: e.target.value, values: "" })}
          >
            <option value="">— pick a numbered set —</option>
            {groups.map((g) => (
              <option key={g.prefix} value={g.prefix}>
                {g.prefix}1–{g.prefix}
                {g.count}
              </option>
            ))}
          </select>
        </div>
        <div className="w-36">
          <Label className="text-xs">that</Label>
          <select
            className={SELECT_CLASS}
            value={value.match}
            onChange={(e) => set({ match: e.target.value as SlotCount["match"] })}
          >
            <option value="starts">starts with</option>
            <option value="equals">is exactly</option>
            <option value="contains">contains</option>
          </select>
        </div>
      </div>

      <div>
        <Label className="text-xs">any of</Label>
        <ValueEditor
          parameter={sample}
          operator="in"
          value={value.values}
          onChange={(values) => set({ values })}
        />
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-[140px] flex-1">
          <Label className="text-xs">but not containing</Label>
          <Input
            className="h-9"
            value={value.exclude}
            onChange={(e) => set({ exclude: e.target.value })}
            placeholder="optional, e.g. Existing"
          />
        </div>
        <div className="w-32">
          <Label className="text-xs">is</Label>
          <select
            className={SELECT_CLASS}
            value={value.compare}
            onChange={(e) => set({ compare: e.target.value as SlotCount["compare"] })}
          >
            <option value=">">more than</option>
            <option value=">=">at least</option>
            <option value="=">exactly</option>
            <option value="<">fewer than</option>
          </select>
        </div>
        <div className="w-20">
          <Label className="text-xs">&nbsp;</Label>
          <Input
            className="h-9"
            value={value.amount}
            onChange={(e) => set({ amount: e.target.value })}
          />
        </div>
      </div>

      {buildSlotFormula(value) && (
        <p className="rounded bg-muted px-2 py-1 font-mono text-[11px] text-muted-foreground">
          {buildSlotFormula(value)}
        </p>
      )}
    </div>
  );
}
