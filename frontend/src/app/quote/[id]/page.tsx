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
import { ConfiguratorForm } from "@/components/quote/configurator-form";
import type { ExtensionPanel } from "@/components/quote/extension-screen";
import type { ValidationResult } from "@/lib/validate";
import type { PriceBreakdown } from "@/types/pricing";
import { isDoor } from "@/types/door";
import type { Location, Party } from "@/types/customer";
import type { Quote, QuoteLine } from "@/types/quote";

const EMPTY_PARTY: Party = { id: "", name: "" };
const EMPTY_LOCATION: Location = { id: "", name: "" };

function makeQuote(quoteId: string, isNew: boolean): Quote {
  return {
    quoteId,
    customer: EMPTY_PARTY,
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
    lines: [],
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
  // Sub-configurators (curtain / installation) chosen per quote line.
  const [lineExtensions, setLineExtensions] = React.useState<
    Record<string, ExtensionPanel[]>
  >({});
  const [configuring, setConfiguring] = React.useState<{
    lineId: string;
    configuratorId: string;
    initialValues: Record<string, string>;
    extensions: ExtensionPanel[];
  } | null>(null);

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
    const nextId = String(
      Math.max(0, ...quote.lines.map((l) => Number(l.quoteLineId) || 0)) + 1
    );
    // Plain parts carry their M1 price; doors are priced later via the configurator.
    const partSell = !isDoor(result.item) ? result.item.sell ?? 0 : 0;
    const partCost = !isDoor(result.item) ? result.item.cost ?? 0 : 0;
    const newLine: QuoteLine = {
      quoteId: quote.quoteId,
      quoteLineId: nextId,
      item: result.item,
      doorTotal: 0,
      installationTotal: 0,
      resellerDiscountPercent: 0,
      totalUnitPrice: partSell,
      marginPercent: partSell ? (partSell - partCost) / partSell : 0,
    };
    setQuote((prev) => ({ ...prev, lines: [...prev.lines, newLine] }));

    if (isDoor(result.item)) {
      // Go straight into the configurator for the new door line.
      const initialValues = Object.fromEntries(
        result.item.parameters.map((p) => [p.controlName, p.value])
      );
      const extensions: ExtensionPanel[] = [];
      if (result.runCurtain && result.curtainConfiguratorId) {
        extensions.push({
          kind: "curtain",
          configuratorId: result.curtainConfiguratorId,
          title: "Curtain configurator",
        });
      }
      if (result.runInstallation && result.installationConfiguratorId) {
        extensions.push({
          kind: "installation",
          configuratorId: result.installationConfiguratorId,
          title: "Installation configurator",
        });
      }
      setLineExtensions((prev) => ({ ...prev, [nextId]: extensions }));
      setConfiguring({
        lineId: nextId,
        configuratorId: result.item.configuratorId,
        initialValues,
        extensions,
      });
      setNotice(null);
    } else {
      setNotice("Part added to the quote.");
    }
  };

  const handleEdit = (lineId: string) => {
    const line = quote.lines.find((l) => l.quoteLineId === lineId);
    if (!line) return;
    if (!isDoor(line.item)) {
      setNotice("Only door lines can be configured.");
      return;
    }
    const initialValues = Object.fromEntries(
      line.item.parameters.map((p) => [p.controlName, p.value])
    );
    setConfiguring({
      lineId,
      configuratorId: line.item.configuratorId,
      initialValues,
      extensions: lineExtensions[lineId] ?? [],
    });
  };

  const handleConfigComplete = (
    values: Record<string, string>,
    result: ValidationResult,
    pricing: PriceBreakdown | null
  ) => {
    if (!configuring) return;
    setLines((lines) =>
      lines.map((l) => {
        if (l.quoteLineId !== configuring.lineId || !isDoor(l.item)) return l;
        const parameters = Object.entries(values).map(([controlName, value]) => ({
          controlName,
          value,
        }));
        const qty = pricing?.qty ?? l.item.partQty ?? 1;
        return {
          ...l,
          item: { ...l.item, parameters, partQty: qty },
          doorTotal: pricing?.doorPrice ?? l.doorTotal,
          installationTotal: pricing?.installation ?? l.installationTotal,
          totalUnitPrice: pricing?.unitSell ?? l.totalUnitPrice,
          // line.marginPercent is a fraction (percent() multiplies by 100)
          marginPercent: pricing ? pricing.marginPercent / 100 : l.marginPercent,
          breakdown: pricing ?? l.breakdown,
        };
      })
    );
    const warns = result.warnings.length;
    setNotice(
      `Configuration saved${warns ? ` (${warns} warning${warns > 1 ? "s" : ""})` : ""}.`
    );
    setConfiguring(null);
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

      {configuring ? (
        <ConfiguratorForm
          configuratorId={configuring.configuratorId}
          initialValues={configuring.initialValues}
          extensions={configuring.extensions}
          onCancel={() => setConfiguring(null)}
          onComplete={handleConfigComplete}
        />
      ) : (
        <QuoteLines
          lines={quote.lines}
          selectedLineId={selectedLineId}
          onSelect={setSelectedLineId}
          onNewLine={() => setNewLineOpen(true)}
          onSearchParts={() => setNewLineOpen(true)}
          onEdit={handleEdit}
          onCopy={handleCopy}
          onDelete={handleDelete}
        />
      )}

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
