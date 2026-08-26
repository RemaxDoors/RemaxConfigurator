"use client";

import * as React from "react";
import { Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Party, Location } from "@/types/customer";

const SELECT_CLASS =
  "flex h-10 w-full rounded-md border border-input bg-background px-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

interface Lookup {
  id: string;
  name: string;
}

interface QuoteHeaderProps {
  customer: Party;
  shipToCustomer: Party;
  shipToLocation: Location;
  projectName: string;
  salesPerson: string;
  leadSource: string;
  revision: string;
  onChange: (
    patch: Partial<{
      projectName: string;
      salesPerson: string;
      leadSource: string;
      revision: string;
    }>
  ) => void;
  onOpenPicker: () => void;
}

/**
 * Dropdown backed by an M1 list.
 *
 * A value not in the list stays selectable rather than being silently dropped.
 * That matters here: most historic quotes carry a marketing programme that is
 * now inactive, and the quoter list excludes anyone who has left — opening an
 * older quote must not quietly blank either field.
 */
function LookupSelect({
  id,
  label,
  value,
  options,
  loading,
  error,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  options: Lookup[];
  loading: boolean;
  error: string | null;
  onChange: (v: string) => void;
}) {
  const known = options.some((o) => o.id === value);
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {/* Never disabled. Sales Person is required by the sales checklist, so a
          disabled control means an M1 outage blocks quoting altogether — and
          a field that cannot be set and will not say why is worse than an
          empty list. The state goes in the placeholder instead. */}
      <select
        id={id}
        className={SELECT_CLASS}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">
          {loading
            ? "Loading…"
            : error
              ? "— unavailable, type below —"
              : "— select —"}
        </option>
        {!known && value && (
          <option value={value}>{value} (not in the current list)</option>
        )}
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name} ({o.id})
          </option>
        ))}
      </select>
      {error && (
        <>
          <Input
            aria-label={`${label} (manual entry)`}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Enter the M1 id"
          />
          <p className="text-xs text-destructive">
            {error} — enter the id by hand.
          </p>
        </>
      )}
    </div>
  );
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-muted-foreground">{label}</Label>
      <Input value={value} readOnly placeholder="—" className="bg-muted/40" />
    </div>
  );
}

export function QuoteHeader({
  customer,
  shipToCustomer,
  shipToLocation,
  projectName,
  salesPerson,
  leadSource,
  revision,
  onChange,
  onOpenPicker,
}: QuoteHeaderProps) {
  const [leadSources, setLeadSources] = React.useState<Lookup[]>([]);
  const [quoters, setQuoters] = React.useState<Lookup[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [lookupError, setLookupError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let active = true;
    fetch("/api/m1/lookups", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (!active) return;
        if (d.error) {
          // Named rather than swallowed: an empty dropdown with no explanation
          // looks like there are no salespeople.
          setLookupError(String(d.error));
          return;
        }
        setLeadSources(d.leadSources ?? []);
        setQuoters(d.quoters ?? []);
      })
      .catch(() => active && setLookupError("Could not reach M1."))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle>Quote Details</CardTitle>
        <Button variant="outline" size="sm" onClick={onOpenPicker}>
          <Search className="h-4 w-4" />
          Search / Change Customer
        </Button>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-4 md:grid-cols-3">
          <ReadOnlyField label="Customer" value={customer.name} />
          <ReadOnlyField label="Ship-to Customer" value={shipToCustomer.name} />
          <ReadOnlyField label="Ship-to Location" value={shipToLocation.name} />

          <ReadOnlyField label="Customer ID" value={customer.id} />
          <ReadOnlyField label="Ship-to Customer ID" value={shipToCustomer.id} />
          <ReadOnlyField label="Ship-to Location ID" value={shipToLocation.id} />
        </div>

        <div className="grid gap-4 md:grid-cols-[2fr_1.5fr_1fr]">
          <div className="space-y-1.5">
            <Label htmlFor="projectName">Project Name</Label>
            <Input
              id="projectName"
              value={projectName}
              onChange={(e) => onChange({ projectName: e.target.value })}
              placeholder="e.g. Dandenong South RDC — Dock doors"
              maxLength={50}
            />
            {/* Quotes.uqmpProjectName is nvarchar(50) and M1 already holds
                values at exactly 50, so the field is capped rather than
                letting a salesperson type something M1 will refuse. */}
            <p className="text-xs text-muted-foreground">
              {projectName.length}/50
            </p>
          </div>
          <LookupSelect
            id="salesPerson"
            label="Sales Person"
            value={salesPerson}
            options={quoters}
            loading={loading}
            error={lookupError}
            onChange={(v) => onChange({ salesPerson: v })}
          />
          <div className="space-y-1.5">
            <Label htmlFor="revision">Revision</Label>
            <Input
              id="revision"
              value={revision}
              onChange={(e) => onChange({ revision: e.target.value })}
              maxLength={1}
            />
            {/* uqmpRevision is nvarchar(1). */}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-[2fr_1.5fr_1fr]">
          <LookupSelect
            id="leadSource"
            label="Lead Source"
            value={leadSource}
            options={leadSources}
            loading={loading}
            error={null}
            onChange={(v) => onChange({ leadSource: v })}
          />
        </div>
      </CardContent>
    </Card>
  );
}
