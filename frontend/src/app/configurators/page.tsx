"use client";

/**
 * Catalog of every configurator in the system, as cards.
 *
 * The setup page opens whichever configurator is first in the list and hides
 * the rest behind a dropdown, so there was no view that answered "what do we
 * have, and how complete is each one?". Each card links straight to a tab of
 * the setup page via ?id=&tab=, so this adds a way in rather than a second
 * place to edit.
 */

import * as React from "react";
import Link from "next/link";
import { AlertTriangle, Loader2, Settings2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fetchConfigData } from "@/lib/config-data";
import type { Configurator } from "@/types/configurator";
import type { ConfiguratorRule } from "@/types/configurator-rule";

interface Tile {
  id: string;
  name: string;
  doorTypeFilter?: string;
  parameters: number;
  options: number;
  rules: number;
  defaults: number;
  /** Rules that would fire on every quote — no rows and no formula. */
  unconditional: number;
}

function buildTiles(
  configurators: Configurator[],
  rules: ConfiguratorRule[]
): Tile[] {
  return configurators.map((c) => {
    const mine = rules.filter((r) => r.configuratorId === c.id);
    return {
      id: c.id,
      name: c.name,
      doorTypeFilter: c.doorTypeFilter,
      parameters: c.parameters.length,
      options: c.parameters.reduce((n, p) => n + (p.options?.length ?? 0), 0),
      rules: mine.length,
      defaults: c.defaults?.length ?? 0,
      unconditional: mine.filter(
        (r) =>
          r.isActive &&
          r.conditions.length === 0 &&
          !(r.conditionFormula ?? "").trim()
      ).length,
    };
  });
}

function Stat({
  label,
  value,
  href,
}: {
  label: string;
  value: number;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-md border p-2 text-center transition-colors hover:border-primary hover:bg-accent"
    >
      <div className="text-lg font-semibold tabular-nums">{value}</div>
      <div className="text-[11px] text-muted-foreground">{label}</div>
    </Link>
  );
}

export default function ConfiguratorCatalogPage() {
  const [tiles, setTiles] = React.useState<Tile[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let active = true;
    fetchConfigData()
      .then((d) => {
        if (!active) return;
        if (!d.configurators?.length) {
          setError("The API returned no configurators.");
          setTiles([]);
          return;
        }
        setTiles(buildTiles(d.configurators, d.rules ?? []));
      })
      .catch(() => active && setError("Could not reach the config API."));
    return () => {
      active = false;
    };
  }, []);

  return (
    <main className="mx-auto max-w-6xl space-y-6 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Configurators</h1>
          <p className="text-muted-foreground">
            Every configurator in the system. Click a number to open that tab.
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/configurator-setup">
            <Settings2 className="h-4 w-4" />
            Setup
          </Link>
        </Button>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {tiles === null && !error && (
        <div className="flex items-center gap-2 p-10 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading configurators…
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {(tiles ?? []).map((t) => {
          const base = `/configurator-setup?id=${encodeURIComponent(t.id)}`;
          return (
            <Card key={t.id} className="flex flex-col">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base leading-tight">
                    {t.name}
                  </CardTitle>
                  {t.doorTypeFilter && (
                    <Badge variant="secondary" className="shrink-0">
                      {t.doorTypeFilter}
                    </Badge>
                  )}
                </div>
                <p className="font-mono text-[11px] text-muted-foreground">
                  {t.id}
                </p>
              </CardHeader>

              <CardContent className="flex flex-1 flex-col gap-3">
                <div className="grid grid-cols-4 gap-1.5">
                  <Stat
                    label="Params"
                    value={t.parameters}
                    href={`${base}&tab=parameters`}
                  />
                  <Stat
                    label="Options"
                    value={t.options}
                    href={`${base}&tab=parameters`}
                  />
                  <Stat label="Rules" value={t.rules} href={`${base}&tab=rules`} />
                  <Stat
                    label="Defaults"
                    value={t.defaults}
                    href={`${base}&tab=defaults`}
                  />
                </div>

                {/* Surfaced here because it is invisible on the rules tab: a
                    rule with no rows and no formula is not "not configured
                    yet", it is a rule that fires on every single quote. */}
                {t.unconditional > 0 && (
                  <Link
                    href={`${base}&tab=rules`}
                    className="flex items-start gap-2 rounded-md border border-amber-500/50 bg-amber-500/10 p-2 text-xs text-amber-700 hover:bg-amber-500/20 dark:text-amber-400"
                  >
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span>
                      <strong>{t.unconditional}</strong> active{" "}
                      {t.unconditional === 1 ? "rule has" : "rules have"} no
                      condition — {t.unconditional === 1 ? "it" : "they"} would
                      apply to every quote.
                    </span>
                  </Link>
                )}

                {t.rules === 0 && (
                  <p className="rounded-md border p-2 text-xs text-muted-foreground">
                    No pricing rules yet.
                  </p>
                )}

                <Button variant="outline" className="mt-auto w-full" asChild>
                  <Link href={base}>Open</Link>
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </main>
  );
}
