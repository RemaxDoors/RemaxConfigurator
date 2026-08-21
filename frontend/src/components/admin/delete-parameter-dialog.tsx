"use client";

/**
 * Confirmation for deleting a parameter, showing what goes with it.
 *
 * Rule conditions, validation conditions and defaults all name a parameter by
 * its control name rather than by a foreign key, so nothing in the database
 * stops a delete from orphaning them — and an orphaned condition does not
 * error, it just stops matching. A rule that quietly never fires again is the
 * kind of thing that surfaces as a wrong quote weeks later, so this makes the
 * consequence explicit before anything is removed.
 */

import * as React from "react";
import { AlertTriangle, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ParameterUsage } from "@/lib/config-admin";

export function DeleteParameterDialog({
  open,
  onOpenChange,
  usage,
  busy,
  error,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Null while the usage is still being fetched. */
  usage: ParameterUsage | null;
  busy: boolean;
  error: string | null;
  /** cascade is true when rules and validations should go too. */
  onConfirm: (cascade: boolean) => void;
}) {
  const [typed, setTyped] = React.useState("");

  React.useEffect(() => {
    setTyped("");
  }, [usage]);

  if (!usage) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Delete parameter</DialogTitle>
          </DialogHeader>
          <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Checking what uses this parameter…
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const rules = usage.rules ?? [];
  const validations = usage.validations ?? [];
  const defaults = usage.defaults ?? [];
  const blocking = rules.length + validations.length;
  // Typing the name is asked for only when rules would be destroyed with it.
  const confirmed = blocking === 0 || typed.trim().toUpperCase() === usage.controlName.toUpperCase();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            Delete <span className="font-mono">{usage.controlName}</span>?
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          {blocking > 0 && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-destructive">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                {blocking} rule{blocking === 1 ? "" : "s"} depend
                {blocking === 1 ? "s" : ""} on this parameter. Deleting it
                without them leaves conditions pointing at a field that no
                longer exists — those stop matching silently rather than
                reporting an error.
              </span>
            </div>
          )}

          {rules.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Pricing rules ({rules.length}) — these would be deleted
              </p>
              <div className="overflow-hidden rounded-md border">
                {rules.map((r) => (
                  <div
                    key={r.ruleCode}
                    className="flex items-baseline gap-2 px-2 py-1 text-xs odd:bg-muted/40"
                  >
                    <span className="w-16 shrink-0 font-mono">{r.ruleCode}</span>
                    <span className="flex-1 truncate">{r.name}</span>
                    <span className="truncate font-mono text-muted-foreground">
                      {r.resultPartId}
                    </span>
                    {r.via === "formula" && (
                      <span className="shrink-0 rounded bg-amber-500/15 px-1 text-[10px] text-amber-700 dark:text-amber-400">
                        in formula
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {validations.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Validation rules ({validations.length}) — these would be deleted
              </p>
              <div className="overflow-hidden rounded-md border">
                {validations.map((v) => (
                  <div
                    key={v.ruleCode}
                    className="flex items-baseline gap-2 px-2 py-1 text-xs odd:bg-muted/40"
                  >
                    <span className="w-40 shrink-0 font-mono">{v.ruleCode}</span>
                    <span className="flex-1 truncate text-muted-foreground">
                      {v.message}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <p className="rounded-md border p-2 text-xs text-muted-foreground">
            <strong className="text-foreground">
              {defaults.length} default{defaults.length === 1 ? "" : "s"}
            </strong>{" "}
            will be removed either way — a default for a field that is not on
            the form can only ever seed something invisible.
          </p>

          {blocking > 0 && (
            <div className="space-y-1.5">
              <Label htmlFor="confirm-name">
                Type <span className="font-mono">{usage.controlName}</span> to
                confirm
              </Label>
              <Input
                id="confirm-name"
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                autoComplete="off"
                placeholder={usage.controlName}
              />
            </div>
          )}

          {error && (
            <p className="rounded-md border border-destructive/50 bg-destructive/10 p-2 text-destructive">
              {error}
            </p>
          )}
        </div>

        <div className="mt-2 flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={busy || !confirmed}
            onClick={() => onConfirm(blocking > 0)}
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {blocking > 0
              ? `Delete parameter and ${blocking} rule${blocking === 1 ? "" : "s"}`
              : "Delete parameter"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
