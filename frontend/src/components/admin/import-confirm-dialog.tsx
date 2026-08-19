"use client";

import * as React from "react";
import { AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * A CSV import REPLACES the whole set: anything missing from the file is
 * deleted. That is easy to trigger with a small "patch" file, so nothing
 * destructive runs until the names about to be removed have been shown.
 */
export interface ImportPlan {
  /** "parameters" | "rules" | "defaults" — used in the wording. */
  noun: string;
  /** Rows the file will add or update. */
  keeping: number;
  /** Names that exist now but are absent from the file. */
  removing: string[];
  /** Extra consequences worth spelling out, e.g. options deleted with a field. */
  knockOn?: string[];
}

export function ImportConfirmDialog({
  open,
  plan,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  plan: ImportPlan | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const [typed, setTyped] = React.useState("");
  React.useEffect(() => {
    if (open) setTyped("");
  }, [open]);

  if (!plan) return null;
  const count = plan.removing.length;
  // Losing most of the set is the accident we're guarding against — make that
  // case require typing the number, not just another click.
  const severe = count >= 10;
  const confirmed = !severe || typed.trim() === String(count);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Delete {count} {plan.noun}?
          </DialogTitle>
          <DialogDescription>
            This file has {plan.keeping} {plan.noun}. Importing it replaces the
            whole set, so the {count} below will be deleted.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-52 overflow-y-auto rounded-md border bg-muted/40 p-2">
          <ul className="space-y-0.5 font-mono text-xs">
            {plan.removing.map((name) => (
              <li key={name}>{name}</li>
            ))}
          </ul>
        </div>

        {plan.knockOn && plan.knockOn.length > 0 && (
          <ul className="list-disc space-y-1 pl-5 text-xs text-muted-foreground">
            {plan.knockOn.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        )}

        {severe && (
          <div className="space-y-1.5">
            <label htmlFor="confirm-count" className="text-sm">
              Type <span className="font-mono font-semibold">{count}</span> to
              confirm.
            </label>
            <input
              id="confirm-count"
              className="flex h-10 w-28 rounded-md border border-input bg-background px-3 text-sm"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoComplete="off"
            />
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={!confirmed}
            onClick={onConfirm}
          >
            Delete {count} and import
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
