"use client";

import * as React from "react";
import { Layers, Link2, Sigma, SlidersHorizontal } from "lucide-react";

import { money } from "@/lib/format";
import { SectionBoard } from "@/components/admin/section-board";
import type { Configurator, ConfiguratorParameter } from "@/types/configurator";
import type {
  ConfiguratorRule,
  RuleCategory,
} from "@/types/configurator-rule";

interface PartPrice {
  sell: number;
  cost: number;
  description: string;
}

/** Categories that subtract from the price. */
const NEGATIVE: RuleCategory[] = ["MATERIAL_DISCOUNT"];

export function ConfiguratorOverview({
  configurator,
  parameters,
  rules,
  defaultsCount,
  onLayoutSaved,
}: {
  configurator?: Configurator;
  parameters: ConfiguratorParameter[];
  rules: ConfiguratorRule[];
  defaultsCount: number;
  /** Reload the configurator after fields are moved between sections. */
  onLayoutSaved?: () => void;
}) {
  const [prices, setPrices] = React.useState<Record<string, PartPrice>>({});

  // Batch-price every part the rules can add, so each rule shows its $ impact.
  // Revision matters — several parts only have a price under a revision.
  const partKey = rules
    .map((r) => `${r.resultPartId}|${r.resultRevision ?? ""}`)
    .sort()
    .join(",");
  React.useEffect(() => {
    const refs = Array.from(
      new Map(
        rules
          .filter((r) => r.resultPartId)
          .map((r) => [
            `${r.resultPartId}|${r.resultRevision ?? ""}`,
            { partId: r.resultPartId, revision: r.resultRevision ?? "" },
          ])
      ).values()
    );
    if (refs.length === 0) {
      setPrices({});
      return;
    }
    let active = true;
    fetch("/api/parts/prices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ parts: refs }),
    })
      .then((r) => (r.ok ? r.json() : { prices: {} }))
      .then((d) => active && setPrices(d.prices ?? {}))
      .catch(() => {});
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partKey]);

  // --- relationships: which parameters drive which rules ---
  const controlToRules = new Map<string, ConfiguratorRule[]>();
  for (const rule of rules) {
    for (const c of rule.conditions) {
      const key = c.controlName.toUpperCase();
      if (!controlToRules.has(key)) controlToRules.set(key, []);
      const list = controlToRules.get(key)!;
      if (!list.includes(rule)) list.push(rule);
    }
  }

  const sections = Array.from(
    parameters.reduce((m, p) => {
      const s = p.section || "Ungrouped";
      m.set(s, (m.get(s) ?? 0) + 1);
      return m;
    }, new Map<string, number>())
  );

  const linkedParams = parameters
    .map((p) => ({
      param: p,
      rules: controlToRules.get(p.controlName.toUpperCase()) ?? [],
    }))
    .filter((x) => x.rules.length > 0)
    .sort((a, b) => b.rules.length - a.rules.length);

  const priceOf = (r: ConfiguratorRule) => {
    const p = prices[`${r.resultPartId}|${r.resultRevision ?? ""}`];
    if (!p) return null;
    const qty = Number(r.quantity) || 1;
    return { sell: p.sell * qty, cost: p.cost * qty, description: p.description };
  };

  const totals = rules.reduce(
    (acc, r) => {
      const p = priceOf(r);
      if (!p) return acc;
      if (NEGATIVE.includes(r.category)) acc.down += p.sell;
      else acc.up += p.sell;
      return acc;
    },
    { up: 0, down: 0 }
  );

  return (
    <div className="space-y-5">
      {/* Metric cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric
          icon={<SlidersHorizontal className="h-4 w-4" />}
          label="Parameters"
          value={String(parameters.length)}
          sub={`${sections.length} section${sections.length === 1 ? "" : "s"}`}
        />
        <Metric
          icon={<Sigma className="h-4 w-4" />}
          label="Rules"
          value={String(rules.length)}
          sub={`${rules.filter((r) => r.isActive).length} active`}
        />
        <Metric
          icon={<Layers className="h-4 w-4" />}
          label="Defaults"
          value={String(defaultsCount)}
          sub="model-driven presets"
        />
        <Metric
          icon={<Link2 className="h-4 w-4" />}
          label="Linked parameters"
          value={String(linkedParams.length)}
          sub="drive at least one rule"
        />
      </div>

      {/* Price impact summary */}
      {(totals.up > 0 || totals.down > 0) && (
        <div className="grid gap-3 sm:grid-cols-3">
          <Metric label="Upgrades add" value={money(totals.up)} tone="up" />
          <Metric label="Discounts remove" value={`−${money(totals.down)}`} tone="down" />
          <Metric
            label="Max net effect"
            value={money(totals.up - totals.down)}
            sub="if every rule fired"
          />
        </div>
      )}

      {/* Form layout — drag fields between sections */}
      {parameters.length === 0 ? (
        <p className="text-sm text-muted-foreground">No parameters yet.</p>
      ) : (
        <SectionBoard
          configuratorId={configurator?.id ?? ""}
          parameters={parameters}
          onSaved={onLayoutSaved}
        />
      )}

      {configurator?.doorTypeFilter && (
        <p className="text-xs text-muted-foreground">
          Door type: {configurator.doorTypeFilter}
        </p>
      )}
    </div>
  );
}

function Metric({
  icon,
  label,
  value,
  sub,
  tone,
}: {
  icon?: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  tone?: "up" | "down";
}) {
  return (
    <div className="rounded-lg border p-3">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {icon}
        {label}
      </div>
      <p
        className={`mt-0.5 text-xl font-semibold tabular-nums ${
          tone === "down" ? "text-emerald-600 dark:text-emerald-400" : ""
        }`}
      >
        {value}
      </p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}
