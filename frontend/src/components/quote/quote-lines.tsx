"use client";

import * as React from "react";
import {
  ChevronDown,
  ChevronRight,
  Copy,
  Pencil,
  Plus,
  Search,
  Trash2,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { money, percent } from "@/lib/format";
import { isDoor } from "@/types/door";
import type { QuoteLine } from "@/types/quote";
import type { PriceBreakdown } from "@/types/pricing";

const CATEGORY_META: { key: string; label: string; negative?: boolean }[] = [
  { key: "ASSEMBLY_UPGRADE", label: "Assembly Upgrade" },
  { key: "MATERIAL_UPGRADE", label: "Material Upgrade" },
  { key: "MATERIAL_DISCOUNT", label: "Material Discount", negative: true },
  { key: "INSTALLATION", label: "Installation" },
];

/** Expanded breakdown for a door line — where each part's price/cost comes from. */
function LineBreakdown({ breakdown }: { breakdown: PriceBreakdown }) {
  return (
    <div className="space-y-3 px-6 py-4 text-sm">
      <div className="flex items-center justify-between">
        <span className="font-medium">
          Door — {breakdown.model || "—"}
          {breakdown.width && breakdown.height
            ? ` · ${breakdown.width.toLocaleString()} × ${breakdown.height.toLocaleString()} mm`
            : ""}
        </span>
        <span className="tabular-nums">
          {money(breakdown.doorPrice)}
          <span className="ml-2 text-xs text-muted-foreground">
            cost {money(breakdown.doorCost)}
          </span>
        </span>
      </div>

      {CATEGORY_META.map(({ key, label, negative }) => {
        const items = breakdown.lines.filter((l) => l.category === key);
        if (items.length === 0) return null;
        return (
          <div key={key} className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {label}
            </p>
            <div className="overflow-hidden rounded-md border">
              {items.map((l, i) => (
                <div
                  key={`${l.partId}-${i}`}
                  className="flex items-center gap-3 px-3 py-1.5 odd:bg-background/50"
                >
                  <span className="font-mono text-xs">{l.partId}</span>
                  <span className="flex-1 truncate text-muted-foreground">
                    {l.description}
                  </span>
                  <span className="text-xs text-muted-foreground">×{l.qty}</span>
                  <span
                    className={`w-24 text-right tabular-nums ${
                      negative ? "text-success" : ""
                    }`}
                  >
                    {negative ? "−" : ""}
                    {money(l.sell)}
                  </span>
                  <span className="w-24 text-right text-xs tabular-nums text-muted-foreground">
                    cost {money(l.cost)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      <div className="flex flex-wrap justify-end gap-4 border-t pt-2 text-sm">
        <span>
          Unit sell{" "}
          <span className="font-medium tabular-nums">{money(breakdown.unitSell)}</span>
        </span>
        <span>
          Unit cost{" "}
          <span className="font-medium tabular-nums">{money(breakdown.unitCost)}</span>
        </span>
        <span>
          Margin{" "}
          <span className="font-medium tabular-nums">
            {breakdown.marginPercent.toFixed(1)}%
          </span>
        </span>
      </div>
    </div>
  );
}

interface QuoteLinesProps {
  lines: QuoteLine[];
  selectedLineId: string | null;
  onSelect: (lineId: string) => void;
  onNewLine: () => void;
  onSearchParts: () => void;
  onEdit: (lineId: string) => void;
  onCopy: (lineId: string) => void;
  onDelete: (lineId: string) => void;
  /** Change a line's quantity or override its unit price. */
  onUpdateLine: (lineId: string, patch: { qty?: number; unitPrice?: number }) => void;
}

function lineTotal(line: QuoteLine): number {
  return (Number(line.totalUnitPrice) || 0) * (Number(line.item.partQty) || 0);
}

/**
 * Unit cost for a line: a door's comes from its M1 breakdown, a catalogue
 * part's from the snapshot taken when it was added. Shown so the margin beside
 * it can be checked, and so an overridden unit price can be judged against
 * something.
 */
function unitCost(line: QuoteLine): number | null {
  if (line.breakdown) return line.breakdown.unitCost;
  if (typeof line.item.cost === "number") return line.item.cost;
  return null;
}

/**
 * Margin recomputed from the price on screen, not the one M1 last returned.
 *
 * Returned as a FRACTION to match QuoteLine.marginPercent, which despite its
 * name holds 0.5014 rather than 50.14 — percent() does the multiplying.
 */
function liveMargin(line: QuoteLine): number | null {
  const cost = unitCost(line);
  const sell = Number(line.totalUnitPrice) || 0;
  if (cost === null || !sell) return null;
  return (sell - cost) / sell;
}

/**
 * Number cell that commits on blur or Enter.
 *
 * It keeps its own draft while focused so a keystroke does not re-render the
 * whole table and lose the caret, and it sits inside a row that selects on
 * click and opens the configurator on double-click — hence stopping both.
 */
function EditableNumber({
  value,
  onCommit,
  decimals = 0,
  ariaLabel,
}: {
  value: number;
  onCommit: (next: number) => void;
  decimals?: number;
  ariaLabel: string;
}) {
  const [draft, setDraft] = React.useState<string | null>(null);
  const shown = draft ?? value.toFixed(decimals);

  const commit = () => {
    if (draft === null) return;
    const n = Number(draft);
    setDraft(null);
    // A blank or non-numeric entry reverts rather than zeroing the line.
    if (draft.trim() === "" || Number.isNaN(n)) return;
    if (n !== value) onCommit(n);
  };

  return (
    <input
      type="number"
      inputMode="decimal"
      aria-label={ariaLabel}
      className="w-24 rounded border border-transparent bg-transparent px-1 py-0.5 text-right tabular-nums hover:border-input focus:border-input focus:bg-background focus:outline-none focus:ring-1 focus:ring-ring"
      value={shown}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          e.currentTarget.blur();
        }
        if (e.key === "Escape") {
          setDraft(null);
          e.currentTarget.blur();
        }
      }}
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
    />
  );
}

export function QuoteLines({
  lines,
  selectedLineId,
  onSelect,
  onNewLine,
  onSearchParts,
  onEdit,
  onCopy,
  onDelete,
  onUpdateLine,
}: QuoteLinesProps) {
  const quoteTotal = lines.reduce((sum, line) => sum + lineTotal(line), 0);
  const hasSelection = selectedLineId !== null;
  const [expanded, setExpanded] = React.useState<string | null>(null);

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle>Line Items</CardTitle>
        <div className="text-right">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Quote Total
          </p>
          <p className="text-xl font-semibold tabular-nums">
            {money(quoteTotal)}
          </p>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {lines.length === 0 ? (
          <div className="rounded-md border border-dashed p-10 text-center text-sm text-muted-foreground">
            No quote lines added yet.
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-14">Line</TableHead>
                  <TableHead>Part ID</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Door Total</TableHead>
                  <TableHead className="text-right">Install Total</TableHead>
                  <TableHead className="text-right">Reseller %</TableHead>
                  <TableHead className="text-right">Unit Price</TableHead>
                  <TableHead className="text-right">Unit Cost</TableHead>
                  <TableHead className="text-right">Margin</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lines.map((line) => {
                  const canExpand = Boolean(line.breakdown);
                  const isOpen = expanded === line.quoteLineId;
                  return (
                  <React.Fragment key={line.quoteLineId}>
                  <TableRow
                    data-state={
                      selectedLineId === line.quoteLineId ? "selected" : undefined
                    }
                    onClick={() => onSelect(line.quoteLineId)}
                    onDoubleClick={() => onEdit(line.quoteLineId)}
                    className="cursor-pointer"
                  >
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-1">
                        {canExpand ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setExpanded(isOpen ? null : line.quoteLineId);
                            }}
                            className="text-muted-foreground hover:text-foreground"
                            aria-label={isOpen ? "Collapse breakdown" : "Expand breakdown"}
                          >
                            {isOpen ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </button>
                        ) : (
                          <span className="inline-block w-4" />
                        )}
                        {line.quoteLineId}
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">
                      {line.item.partId}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {line.item.partDescription}
                    </TableCell>
                    <TableCell>
                      <Badge variant={isDoor(line.item) ? "default" : "secondary"}>
                        {isDoor(line.item) ? "Door" : "Part"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      <EditableNumber
                        value={Number(line.item.partQty) || 0}
                        ariaLabel={`Quantity for line ${line.quoteLineId}`}
                        onCommit={(qty) =>
                          onUpdateLine(line.quoteLineId, { qty })
                        }
                      />
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {money(line.doorTotal)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {money(line.installationTotal)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {line.resellerDiscountPercent}%
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      <EditableNumber
                        value={Number(line.totalUnitPrice) || 0}
                        decimals={2}
                        ariaLabel={`Unit price for line ${line.quoteLineId}`}
                        onCommit={(unitPrice) =>
                          onUpdateLine(line.quoteLineId, { unitPrice })
                        }
                      />
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {unitCost(line) === null ? "—" : money(unitCost(line)!)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {liveMargin(line) === null
                        ? percent(line.marginPercent)
                        : percent(liveMargin(line)!)}
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {money(lineTotal(line))}
                    </TableCell>
                  </TableRow>
                  {isOpen && line.breakdown && (
                    <TableRow className="hover:bg-transparent">
                      <TableCell colSpan={12} className="bg-muted/30 p-0">
                        <LineBreakdown breakdown={line.breakdown} />
                      </TableCell>
                    </TableRow>
                  )}
                  </React.Fragment>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={onNewLine}>
            <Plus className="h-4 w-4" />
            New Line
          </Button>
          <Button variant="outline" onClick={onSearchParts}>
            <Search className="h-4 w-4" />
            Search Parts
          </Button>

          <div className="mx-1 hidden h-6 w-px bg-border sm:block" />

          <Button
            variant="outline"
            disabled={!hasSelection}
            onClick={() => hasSelection && onEdit(selectedLineId!)}
          >
            <Pencil className="h-4 w-4" />
            Edit
          </Button>
          <Button
            variant="outline"
            disabled={!hasSelection}
            onClick={() => hasSelection && onCopy(selectedLineId!)}
          >
            <Copy className="h-4 w-4" />
            Copy
          </Button>
          <Button
            variant="outline"
            className="text-destructive hover:text-destructive"
            disabled={!hasSelection}
            onClick={() => hasSelection && onDelete(selectedLineId!)}
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </Button>

          <p className="ml-auto hidden text-xs text-muted-foreground lg:block">
            Click a row to select · Double-click to open in configurator
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
