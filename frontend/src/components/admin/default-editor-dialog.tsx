"use client";

/**
 * Edit a single default's value.
 *
 * Saves through the narrow PUT /defaults endpoint, never the bulk replace: that
 * one deletes the whole set and re-inserts four columns, losing Priority,
 * ValueFormula, IsManual and ParentPartID, and failing on any row a default
 * condition points at. Changing one value should not be able to do any of that.
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
import { updateDefaultInDb } from "@/lib/config-admin";
import type {
  ConfiguratorDefault,
  ConfiguratorParameter,
} from "@/types/configurator";

const SELECT_CLASS =
  "flex h-10 w-full rounded-md border border-input bg-background px-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function DefaultEditorDialog({
  open,
  onOpenChange,
  configuratorId,
  value: row,
  parameters,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  configuratorId: string;
  /** The default being edited, or null when the dialog is closed. */
  value: ConfiguratorDefault | null;
  parameters: ConfiguratorParameter[];
  onSaved: (updated: ConfiguratorDefault) => void;
}) {
  const [draft, setDraft] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setDraft(row?.value ?? "");
    setError(null);
  }, [row]);

  if (!row) return null;

  const param = parameters.find(
    (p) => p.controlName.toUpperCase() === row.controlName.toUpperCase()
  );
  const options = (param?.options ?? []).filter((o) => o.value !== "");
  const known = options.some((o) => o.value === draft);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await updateDefaultInDb(
        configuratorId,
        row.doorModel,
        row.controlName,
        draft
      );
      onSaved({ ...row, value: draft });
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit default</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 rounded-md border p-3 text-sm">
            <div>
              <div className="text-xs text-muted-foreground">Door model</div>
              <div className="font-medium">
                {row.doorModel ?? "All models"}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Parameter</div>
              <div className="font-mono text-xs">{row.controlName}</div>
              {param && (
                <div className="text-xs text-muted-foreground">
                  {param.label}
                </div>
              )}
            </div>
          </div>

          {/* A row with no door model is conditional or manual. Its conditions
              live in uCfgDefaultConditions and only the API evaluates them, so
              the value shown here is not the whole story. */}
          {row.doorModel === null && (
            <p className="flex items-start gap-2 rounded-md border border-amber-500/50 bg-amber-500/10 p-2 text-xs text-amber-700 dark:text-amber-400">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                This default is not tied to a door model — it is applied by its
                own conditions, or set by hand. Changing the value here does not
                change when it applies.
              </span>
            </p>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="default-value">Default value</Label>
            {options.length > 0 ? (
              <select
                id="default-value"
                className={SELECT_CLASS}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
              >
                <option value="">— cleared —</option>
                {!known && draft && (
                  <option value={draft}>{draft} (not an option)</option>
                )}
                {options.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label || o.value}
                  </option>
                ))}
              </select>
            ) : (
              <Input
                id="default-value"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder={param?.kind === "number" ? "e.g. 3000" : "Value"}
              />
            )}
            {options.length > 0 && !known && draft && (
              <p className="text-xs text-amber-600 dark:text-amber-500">
                This value is not one of {row.controlName}&apos;s options — the
                form will show it blank.
              </p>
            )}
          </div>

          {error && (
            <p className="rounded-md border border-destructive/50 bg-destructive/10 p-2 text-sm text-destructive">
              {error}
            </p>
          )}
        </div>

        <div className="mt-2 flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving || draft === row.value}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Save
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
