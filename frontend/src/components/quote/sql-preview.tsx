"use client";

/**
 * Editable SQL for review — a dry run. Nothing here executes anything.
 *
 * One tab per M1 target so each can be worked on independently — the four
 * tables a quote touches are agreed at different rates, and one long box would
 * make it hard to work on just the one that changed.
 *
 * The text is editable and stays edited. Regenerate throws those edits away,
 * so it asks first — a dictionary conversation with Michael is exactly the
 * work that would be lost.
 */

import * as React from "react";
import { AlertTriangle, ArrowLeft, Check, Copy, RefreshCw, Play } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DRY_RUN_BANNER,
  buildQuoteSql,
  joinSections,
  type SqlSection,
} from "@/lib/quote-sql";
import type { Quote } from "@/types/quote";

export function SqlPreview({
  quote,
  sections,
  onSectionsChange,
  stale,
  onReturn,
}: {
  quote: Quote;
  /** Null until Generate is pressed. Held by the page, not here, so edits
   *  survive Return to Quote — this component unmounts on the way back. */
  sections: SqlSection[] | null;
  onSectionsChange: (next: SqlSection[] | null) => void;
  /** The quote has changed since these statements were built. */
  stale: boolean;
  onReturn: () => void;
}) {
  const [active, setActive] = React.useState(0);
  // Configurator revisions, keyed by configurator id. Fetched here because
  // PartRevision belongs to the configurator, not to anything on the quote —
  // using the quote revision produced PART-...-REV-A, an id M1 has never seen.
  const [revisions, setRevisions] = React.useState<Record<string, string>>({});

  React.useEffect(() => {
    let active = true;
    fetch("/api/config", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (!active) return;
        const map: Record<string, string> = {};
        for (const c of d.configurators ?? []) {
          map[c.id] = c.partRevision ?? "";
        }
        setRevisions(map);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);
  const [confirmRegen, setConfirmRegen] = React.useState(false);
  const [copied, setCopied] = React.useState<string | null>(null);

  const generate = () => {
    onSectionsChange(buildQuoteSql(quote, revisions));
    setActive(0);
    setConfirmRegen(false);
  };

  const edit = (id: string, sql: string) =>
    onSectionsChange(
      (sections ?? []).map((s) => (s.id === id ? { ...s, sql } : s))
    );

  const copy = async (text: string, what: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(what);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      setCopied("failed");
      setTimeout(() => setCopied(null), 2000);
    }
  };

  const current = sections?.[active];

  return (
    <Card>
      <CardHeader className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-baseline gap-2">
            <CardTitle>Generate M1 SQL</CardTitle>
            {/* The quote id is what every statement keys on, so it belongs on
                screen rather than only inside the SQL. */}
            <Badge variant="secondary" className="font-mono">
              Quote {quote.quoteId || "(unsaved)"}
            </Badge>
          </div>
          <div className="flex flex-wrap gap-2">
            {sections === null ? (
              <Button onClick={generate}>
                <Play className="h-4 w-4" />
                Generate SQL
              </Button>
            ) : (
              <Button
                // Stale SQL is the common case for pressing this, so it leads
                // rather than hiding behind the outline styling.
                variant={stale ? "default" : "outline"}
                onClick={() => (confirmRegen ? generate() : setConfirmRegen(true))}
              >
                <RefreshCw className="h-4 w-4" />
                {confirmRegen ? "Discard edits and regenerate?" : "Regenerate SQL"}
              </Button>
            )}
            {sections && (
              <Button
                variant="outline"
                onClick={() => copy(joinSections(sections), "all")}
              >
                {copied === "all" ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
                Copy all
              </Button>
            )}
            <Button variant="ghost" onClick={onReturn}>
              <ArrowLeft className="h-4 w-4" />
              Return to Quote
            </Button>
          </div>
        </div>

        <div className="flex items-start gap-2 rounded-md border border-amber-500/50 bg-amber-500/10 p-2 text-sm text-amber-800 dark:text-amber-400">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            <strong>{DRY_RUN_BANNER}</strong>
            <br />
            The app never runs these statements. Copy them into the M1 test
            company yourself.
          </span>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* The quote changed after these statements were built. Said plainly,
            because the SQL still looks perfectly valid — it is just describing
            a quote that no longer exists. */}
        {stale && sections !== null && (
          <p className="flex items-start gap-2 rounded-md border border-amber-500/50 bg-amber-500/10 p-2 text-sm text-amber-800 dark:text-amber-400">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              The quote has changed since this SQL was generated. Press{" "}
              <strong>Regenerate SQL</strong> to rebuild it — any edits you made
              here will be replaced.
            </span>
          </p>
        )}
        {sections === null ? (
          <p className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
            Press <strong>Generate SQL</strong> to build the statements from the
            values on this quote. Change anything on the quote and regenerate —
            nothing is written until you run it yourself.
          </p>
        ) : (
          <>
            <div className="flex flex-wrap gap-1 border-b">
              {sections.map((s, i) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setActive(i)}
                  className={`flex items-center gap-1.5 rounded-t-md px-3 py-1.5 text-sm ${
                    i === active
                      ? "border border-b-0 bg-background font-medium"
                      : "text-muted-foreground hover:bg-accent"
                  }`}
                >
                  {s.title}
                </button>
              ))}
            </div>

            {current && (
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
                      {current.table}
                    </code>
                    <span className="text-xs text-muted-foreground">
                      {current.note}
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copy(current.sql, current.id)}
                  >
                    {copied === current.id ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                    Copy
                  </Button>
                </div>

                {/* A plain textarea on purpose: this has to stay editable and
                    copyable with no editor getting in the way of a paste into
                    SSMS. Table and column names are edited right here. */}
                <textarea
                  aria-label={`SQL for ${current.title}`}
                  spellCheck={false}
                  value={current.sql}
                  onChange={(e) => edit(current.id, e.target.value)}
                  className="h-[28rem] w-full resize-y rounded-md border bg-muted/30 p-3 font-mono text-xs leading-relaxed ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
                <p className="text-xs text-muted-foreground">
                  Edit freely — rename a table, change a column, delete a block.
                  Your edits stay until you regenerate.
                </p>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
