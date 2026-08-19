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
}

function lineTotal(line: QuoteLine): number {
  return (Number(line.totalUnitPrice) || 0) * (Number(line.item.partQty) || 0);
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
                      {line.item.partQty}
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
                      {money(line.totalUnitPrice)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {percent(line.marginPercent)}
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {money(lineTotal(line))}
                    </TableCell>
                  </TableRow>
                  {isOpen && line.breakdown && (
                    <TableRow className="hover:bg-transparent">
                      <TableCell colSpan={11} className="bg-muted/30 p-0">
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
