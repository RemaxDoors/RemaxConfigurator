"use client";

import { Copy, Pencil, Plus, Search, Trash2 } from "lucide-react";

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
                {lines.map((line) => (
                  <TableRow
                    key={line.quoteLineId}
                    data-state={
                      selectedLineId === line.quoteLineId ? "selected" : undefined
                    }
                    onClick={() => onSelect(line.quoteLineId)}
                    onDoubleClick={() => onEdit(line.quoteLineId)}
                    className="cursor-pointer"
                  >
                    <TableCell className="font-medium">
                      {line.quoteLineId}
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
                ))}
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
