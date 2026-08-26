"use client";

/**
 * The sales checklist: the four things that must be true before a quote can
 * leave "Quote In Progress".
 *
 * These are exactly the fields M1 will not accept a quote without — customer,
 * ship-to location, project name and quoter all map to NOT NULL columns on
 * dbo.Quotes. Catching them here means the salesperson finds out while they
 * still have the quote open, rather than the write-back failing later with a
 * constraint error nobody sees.
 *
 * Project name is length-checked too: uqmpProjectName is nvarchar(50) and M1
 * already holds values at exactly 50, so a longer one has nowhere to go.
 */

import * as React from "react";
import { Check, ClipboardCheck, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { Party, Location } from "@/types/customer";

/** uqmpProjectName is nvarchar(50) in M1. */
export const PROJECT_NAME_MAX = 50;

export interface ChecklistItem {
  label: string;
  ok: boolean;
  hint: string;
}

export function buildChecklist({
  customer,
  shipToLocation,
  projectName,
  salesPerson,
}: {
  customer: Party;
  shipToLocation: Location;
  projectName: string;
  salesPerson: string;
}): ChecklistItem[] {
  const name = projectName.trim();
  return [
    {
      label: "Customer selected",
      ok: Boolean(customer?.id?.trim()),
      hint: "Use Search / Change Customer.",
    },
    {
      label: "Location selected",
      ok: Boolean(shipToLocation?.id?.trim()),
      hint: "Pick a ship-to location for the customer.",
    },
    {
      label: "Project name filled",
      // Both halves matter: M1 rejects an empty one and truncates a long one.
      ok: name.length > 0 && name.length <= PROJECT_NAME_MAX,
      hint:
        name.length > PROJECT_NAME_MAX
          ? `Too long — ${name.length} characters, M1 allows ${PROJECT_NAME_MAX}.`
          : "Type a project name.",
    },
    {
      label: "Sales person selected",
      ok: Boolean(salesPerson?.trim()),
      hint: "Choose the quoter.",
    },
  ];
}

export function SalesChecklist({
  items,
  onComplete,
  completed,
}: {
  items: ChecklistItem[];
  /** Called when every item passes and the user confirms. */
  onComplete: () => void;
  completed: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const outstanding = items.filter((i) => !i.ok);
  const allOk = outstanding.length === 0;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Button
          variant={completed ? "outline" : "default"}
          size="sm"
          onClick={() => (allOk && !completed ? onComplete() : setOpen(!open))}
          // Never disabled: a greyed-out button that will not say why is the
          // thing this checklist exists to avoid. Pressing it opens the list.
          aria-expanded={open}
        >
          <ClipboardCheck className="h-4 w-4" />
          {completed
            ? "Sales checklist complete"
            : allOk
              ? "Mark sales checklist complete"
              : `Sales checklist — ${outstanding.length} outstanding`}
        </Button>
        {!allOk && (
          <button
            type="button"
            onClick={() => setOpen(!open)}
            className="text-xs text-muted-foreground underline-offset-2 hover:underline"
          >
            {open ? "hide" : "what is missing?"}
          </button>
        )}
      </div>

      {(open || (!allOk && completed)) && (
        <ul className="space-y-1 rounded-md border p-2">
          {items.map((item) => (
            <li key={item.label} className="flex items-start gap-2 text-sm">
              {item.ok ? (
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />
              ) : (
                <X className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
              )}
              <span className={item.ok ? "" : "text-destructive"}>
                {item.label}
                {!item.ok && (
                  <span className="ml-1 text-xs text-muted-foreground">
                    — {item.hint}
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
