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
  /**
   * A second thing the SAME slot value must also contain, e.g. only count
   * "Induction Loop - …" values that also say "Only". Needed because two
   * separate counts would match a loop in one slot and "…Only" in another.
   */
  alsoContains: string;
  compare: ">" | ">=" | "=" | "<";
  amount: string;
}

export const EMPTY_SLOT_COUNT: SlotCount = {
  prefix: "",
  match: "starts",
  values: "",
  exclude: "",
  alsoContains: "",
  compare: ">",
  amount: "0",
};

const FN: Record<SlotCount["match"], string> = {
  starts: "countStartsWith",
  equals: "countEquals",
  contains: "countContains",
};

const quote = (s: string) => `"${s.replace(/"/g, "")}"`;

/** Predicate prefix used by countWhere for each match mode. */
const PREDICATE: Record<SlotCount["match"], string> = {
  starts: "starts",
  equals: "is",
  contains: "has",
};

/** One count expression — several values become a sum of counts. */
function countExpr(c: SlotCount): string {
  const values = c.values
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
  if (!c.prefix || values.length === 0) return "";
  const also = c.alsoContains.trim();
  const exclude = c.exclude.trim();
  const group = `group(${quote(c.prefix)})`;

  // countWhere is the general form; it is the only one that can require two
  // things of the same slot value. Stick to the shorthands otherwise so
  // existing saved formulas keep their familiar shape.
  const terms = values.map((v) => {
    if (also) {
      const preds = [`${PREDICATE[c.match]}:${v}`, `has:${also}`];
      if (exclude) preds.push(`!has:${exclude}`);
      return `countWhere(${group}, ${preds.map(quote).join(", ")})`;
    }
    const args = [group, quote(v), exclude ? quote(exclude) : ""]
      .filter(Boolean)
      .join(", ");
    return `${FN[c.match]}(${args})`;
  });
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

  /** One term -> {kind, prefix, value, exclude, also} or null if unparseable. */
  const readTerm = (t: string) => {
    const short = t.match(
      /^count(StartsWith|Equals|Contains)\(\s*group\(\s*"([^"]*)"\s*\)\s*,\s*"([^"]*)"\s*(?:,\s*"([^"]*)"\s*)?\)$/i
    );
    if (short) {
      return {
        kind: short[1].toLowerCase(),
        prefix: short[2],
        value: short[3],
        exclude: short[4] ?? "",
        also: "",
      };
    }
    const where = t.match(
      /^countWhere\(\s*group\(\s*"([^"]*)"\s*\)\s*,\s*((?:"[^"]*"\s*,?\s*)+)\)$/i
    );
    if (!where) return null;
    const preds = (where[2].match(/"[^"]*"/g) ?? []).map((p) => p.slice(1, -1));
    const KIND: Record<string, string> = {
      starts: "startswith",
      is: "equals",
      has: "contains",
    };
    let kind = "";
    let value = "";
    let also = "";
    let exclude = "";
    for (const p of preds) {
      const neg = p.startsWith("!");
      const [mode, ...rest] = (neg ? p.slice(1) : p).split(":");
      const text = rest.join(":");
      if (neg) {
        if (mode !== "has" || exclude) return null; // only !has is representable
        exclude = text;
      } else if (!kind) {
        if (!(mode in KIND)) return null;
        kind = KIND[mode];
        value = text;
      } else if (mode === "has" && !also) {
        also = text;
      } else {
        return null; // more predicates than this builder can show
      }
    }
    if (!kind) return null;
    return { kind, prefix: where[1], value, exclude, also };
  };

  const parsed = terms.map(readTerm);
  if (parsed.some((p) => !p)) return null;

  const uniq = (fn: (p: NonNullable<typeof parsed[0]>) => string) =>
    new Set(parsed.map((p) => fn(p!)));
  if (
    uniq((p) => p.kind).size !== 1 ||
    uniq((p) => p.prefix.toUpperCase()).size !== 1 ||
    uniq((p) => p.exclude).size !== 1 ||
    uniq((p) => p.also).size !== 1
  ) {
    return null;
  }

  const first = parsed[0]!;
  return {
    prefix: first.prefix,
    match:
      first.kind === "equals"
        ? "equals"
        : first.kind === "contains"
          ? "contains"
          : "starts",
    values: parsed.map((p) => p!.value).join(", "),
    exclude: first.exclude,
    alsoContains: first.also,
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
          <Label className="text-xs">and also containing</Label>
          <Input
            className="h-9"
            value={value.alsoContains}
            onChange={(e) => set({ alsoContains: e.target.value })}
            placeholder="optional, e.g. Only"
          />
        </div>
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
