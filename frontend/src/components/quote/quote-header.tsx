"use client";

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

interface QuoteHeaderProps {
  customer: Party;
  shipToCustomer: Party;
  shipToLocation: Location;
  projectName: string;
  salesPerson: string;
  revision: string;
  onChange: (
    patch: Partial<{
      projectName: string;
      salesPerson: string;
      revision: string;
    }>
  ) => void;
  onOpenPicker: () => void;
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
  revision,
  onChange,
  onOpenPicker,
}: QuoteHeaderProps) {
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
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="salesPerson">Sales Person</Label>
            <Input
              id="salesPerson"
              value={salesPerson}
              onChange={(e) => onChange({ salesPerson: e.target.value })}
              placeholder="e.g. Alex Taylor"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="revision">Revision</Label>
            <Input
              id="revision"
              value={revision}
              onChange={(e) => onChange({ revision: e.target.value })}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
