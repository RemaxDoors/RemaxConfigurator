"use client";

import * as React from "react";
import Link from "next/link";
import { Info, X } from "lucide-react";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Badge } from "@/components/ui/badge";
import { CustomerPicker } from "@/components/quote/customer-picker";
import { QuoteHeader } from "@/components/quote/quote-header";
import { QuoteLines } from "@/components/quote/quote-lines";
import {
  NewLineDialog,
  type NewLineResult,
} from "@/components/quote/new-line-dialog";
import { MOCK_QUOTE_LINES } from "@/lib/mock-data";
import { isDoor } from "@/types/door";
import type { Location, Party } from "@/types/customer";
import type { Quote, QuoteLine } from "@/types/quote";

const EMPTY_PARTY: Party = { id: "", name: "" };
const EMPTY_LOCATION: Location = { id: "", name: "" };

function makeQuote(quoteId: string, isNew: boolean): Quote {
  return {
    quoteId,
    customer: isNew
      ? EMPTY_PARTY
      : { id: "10231", name: "Woolworths Distribution Centre" },
    shipToCustomer: EMPTY_PARTY,
    shipToLocation: EMPTY_LOCATION,
    projectName: "",
    salesPerson: "",
    revision: "A",
    status: isNew ? "Draft" : "Open",
    totals: {
      doorTotal: 0,
      installationTotal: 0,
      totalSell: 0,
      totalCost: 0,
      marginPercent: 0,
    },
    lines: isNew ? [] : MOCK_QUOTE_LINES,
  };
}

export default function QuotePage({ params }: { params: { id: string } }) {
  const quoteId = decodeURIComponent(params.id);
  const isNew = quoteId === "new";

  const [quote, setQuote] = React.useState<Quote>(() =>
    makeQuote(quoteId, isNew)
  );
  const [selectedLineId, setSelectedLineId] = React.useState<string | null>(
    null
  );
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const [newLineOpen, setNewLineOpen] = React.useState(false);
  const [notice, setNotice] = React.useState<string | null>(null);

  const patchQuote = (patch: Partial<Quote>) =>
    setQuote((prev) => ({ ...prev, ...patch }));

  const setLines = (updater: (lines: QuoteLine[]) => QuoteLine[]) =>
    setQuote((prev) => ({ ...prev, lines: updater(prev.lines) }));

  const handleCopy = (lineId: string) =>
    setLines((lines) => {
      const original = lines.find((l) => l.quoteLineId === lineId);
      if (!original) return lines;
      const nextId = String(
        Math.max(...lines.map((l) => Number(l.quoteLineId) || 0)) + 1
      );
      return [...lines, { ...original, quoteLineId: nextId }];
    });

  const handleDelete = (lineId: string) => {
    setLines((lines) =>
      lines
        .filter((l) => l.quoteLineId !== lineId)
        .map((l, i) => ({ ...l, quoteLineId: String(i + 1) }))
    );
    setSelectedLineId(null);
  };

  const handleCreateLine = (result: NewLineResult) => {
    setQuote((prev) => {
      const nextId = String(
        Math.max(0, ...prev.lines.map((l) => Number(l.quoteLineId) || 0)) + 1
      );
      const newLine: QuoteLine = {
        quoteId: prev.quoteId,
        quoteLineId: nextId,
        item: result.item,
        doorTotal: 0,
        installationTotal: 0,
        resellerDiscountPercent: 0,
        totalUnitPrice: 0,
        marginPercent: 0,
      };
      return { ...prev, lines: [...prev.lines, newLine] };
    });

    if (isDoor(result.item)) {
      const configs = [
        "Door",
        result.runCurtain && "Curtain",
        result.runInstallation && "Installation",
      ]
        .filter(Boolean)
        .join(" + ");
      setNotice(
        `Door line added — next you'll configure: ${configs}. (Configurator screen is coming next.)`
      );
    } else {
      setNotice("Part added to the quote.");
    }
  };

  return (
    <div className="container space-y-6 py-6">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href="/">Home</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href="/#quotes">Quotes</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>
              {isNew ? "New quote" : `Quote ${quoteId}`}
            </BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold tracking-tight">
          {isNew ? "New Quote" : `Quote ${quoteId}`}
        </h1>
        <Badge variant={quote.status === "Draft" ? "secondary" : "success"}>
          {quote.status}
        </Badge>
      </div>

      <QuoteHeader
        customer={quote.customer}
        shipToCustomer={quote.shipToCustomer}
        shipToLocation={quote.shipToLocation}
        projectName={quote.projectName}
        salesPerson={quote.salesPerson}
        revision={quote.revision}
        onChange={patchQuote}
        onOpenPicker={() => setPickerOpen(true)}
      />

      {notice && (
        <div className="flex items-center gap-2 rounded-md border border-primary/30 bg-primary/5 px-4 py-3 text-sm">
          <Info className="h-4 w-4 shrink-0 text-primary" />
          <span>{notice}</span>
          <button
            type="button"
            className="ml-auto text-muted-foreground hover:text-foreground"
            onClick={() => setNotice(null)}
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <QuoteLines
        lines={quote.lines}
        selectedLineId={selectedLineId}
        onSelect={setSelectedLineId}
        onNewLine={() => setNewLineOpen(true)}
        onSearchParts={() => setNewLineOpen(true)}
        onEdit={() => {}}
        onCopy={handleCopy}
        onDelete={handleDelete}
      />

      <NewLineDialog
        open={newLineOpen}
        onOpenChange={setNewLineOpen}
        onCreate={handleCreateLine}
      />

      <CustomerPicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        shipToCustomerId={quote.shipToCustomer.id}
        onApply={patchQuote}
      />
    </div>
  );
}
