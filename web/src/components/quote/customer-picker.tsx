"use client";

import * as React from "react";
import { Check, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { MOCK_LOCATIONS, MOCK_PARTIES } from "@/lib/mock-data";
import type { Location, Party } from "@/types/customer";

interface CustomerPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shipToCustomerId: string;
  onApply: (
    patch: Partial<{
      customer: Party;
      shipToCustomer: Party;
      shipToLocation: Location;
    }>
  ) => void;
}

const MIN_QUERY = 3;
const EMPTY_LOCATION: Location = { id: "", name: "" };

function searchParties(query: string): Party[] {
  const term = query.trim().toLowerCase();
  if (term.length < MIN_QUERY) return [];
  return MOCK_PARTIES.filter(
    (p) =>
      p.name.toLowerCase().includes(term) || p.id.toLowerCase().includes(term)
  );
}

function ResultsList<T>({
  items,
  getKey,
  getLabel,
  selectedKey,
  onSelect,
  emptyHint,
}: {
  items: T[];
  getKey: (item: T) => string;
  getLabel: (item: T) => React.ReactNode;
  selectedKey: string | null;
  onSelect: (item: T) => void;
  emptyHint: string;
}) {
  if (items.length === 0) {
    return <p className="px-1 py-6 text-sm text-muted-foreground">{emptyHint}</p>;
  }
  return (
    <ul className="max-h-56 divide-y overflow-auto rounded-md border">
      {items.map((item) => {
        const key = getKey(item);
        const isSelected = key === selectedKey;
        return (
          <li key={key}>
            <button
              type="button"
              onClick={() => onSelect(item)}
              className={cn(
                "flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-accent",
                isSelected && "bg-accent"
              )}
            >
              <span>{getLabel(item)}</span>
              {isSelected && <Check className="h-4 w-4 text-primary" />}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

export function CustomerPicker({
  open,
  onOpenChange,
  shipToCustomerId,
  onApply,
}: CustomerPickerProps) {
  const [customerQuery, setCustomerQuery] = React.useState("");
  const [orgQuery, setOrgQuery] = React.useState("");
  const [pendingCustomer, setPendingCustomer] = React.useState<Party | null>(
    null
  );
  const [pendingOrg, setPendingOrg] = React.useState<Party | null>(null);
  const [pendingLocation, setPendingLocation] = React.useState<Location | null>(
    null
  );

  const customerResults = searchParties(customerQuery);
  const orgResults = searchParties(orgQuery);
  const effectiveShipToId = pendingOrg?.id ?? shipToCustomerId;
  const locationResults = effectiveShipToId
    ? MOCK_LOCATIONS[effectiveShipToId] ?? []
    : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Search / Change Customer</DialogTitle>
          <DialogDescription>
            Look up the customer, ship-to customer and ship-to location for this
            quote.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="customer" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="customer">Customer</TabsTrigger>
            <TabsTrigger value="ship-org">Ship-to Customer</TabsTrigger>
            <TabsTrigger value="location">Ship-to Location</TabsTrigger>
          </TabsList>

          {/* Customer */}
          <TabsContent value="customer" className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="customerSearch">Search Customer Name / ID</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="customerSearch"
                  value={customerQuery}
                  onChange={(e) => setCustomerQuery(e.target.value)}
                  placeholder="At least 3 characters…"
                  className="pl-9"
                />
              </div>
            </div>
            <ResultsList
              items={customerResults}
              getKey={(p) => p.id}
              getLabel={(p) => `${p.id} — ${p.name}`}
              selectedKey={pendingCustomer?.id ?? null}
              onSelect={setPendingCustomer}
              emptyHint={
                customerQuery.trim().length < MIN_QUERY
                  ? "Enter at least 3 characters."
                  : "No matching customers found."
              }
            />
            <div className="flex justify-end">
              <Button
                disabled={!pendingCustomer}
                onClick={() =>
                  pendingCustomer && onApply({ customer: pendingCustomer })
                }
              >
                Use Customer
              </Button>
            </div>
          </TabsContent>

          {/* Ship-to Customer */}
          <TabsContent value="ship-org" className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="orgSearch">Search Ship-to Customer Name / ID</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="orgSearch"
                  value={orgQuery}
                  onChange={(e) => setOrgQuery(e.target.value)}
                  placeholder="At least 3 characters…"
                  className="pl-9"
                />
              </div>
            </div>
            <ResultsList
              items={orgResults}
              getKey={(p) => p.id}
              getLabel={(p) => `${p.id} — ${p.name}`}
              selectedKey={pendingOrg?.id ?? null}
              onSelect={(p) => {
                setPendingOrg(p);
                setPendingLocation(null);
              }}
              emptyHint={
                orgQuery.trim().length < MIN_QUERY
                  ? "Enter at least 3 characters."
                  : "No matching ship-to customers found."
              }
            />
            <div className="flex justify-end">
              <Button
                disabled={!pendingOrg}
                onClick={() =>
                  pendingOrg &&
                  onApply({
                    shipToCustomer: pendingOrg,
                    shipToLocation: EMPTY_LOCATION,
                  })
                }
              >
                Use Ship-to Customer
              </Button>
            </div>
          </TabsContent>

          {/* Ship-to Location */}
          <TabsContent value="location" className="space-y-3">
            {!effectiveShipToId ? (
              <p className="px-1 py-6 text-sm text-muted-foreground">
                Select a ship-to customer first.
              </p>
            ) : (
              <>
                <Label>Ship-to Location</Label>
                <ResultsList
                  items={locationResults}
                  getKey={(l) => l.id}
                  getLabel={(l) => `${l.id} — ${l.name}`}
                  selectedKey={pendingLocation?.id ?? null}
                  onSelect={setPendingLocation}
                  emptyHint="No ship-to locations found for this customer."
                />
                <div className="flex justify-end">
                  <Button
                    disabled={!pendingLocation}
                    onClick={() => {
                      if (!pendingLocation) return;
                      onApply({ shipToLocation: pendingLocation });
                      onOpenChange(false);
                    }}
                  >
                    Use Ship-to Location
                  </Button>
                </div>
              </>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
