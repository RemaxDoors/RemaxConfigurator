"use client";

/**
 * Edit, move or delete a single default.
 *
 * Saves through the narrow PUT/DELETE endpoints, never the bulk replace: that
 * one deletes the whole set and re-inserts four columns, losing Priority,
 * ValueFormula, IsManual and ParentPartID, and failing on any row a default
 * condition points at. Changing one value should not be able to do any of that.
 */

import * as React from "react";
import { AlertTriangle, Loader2, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { deleteDefaultFromDb, updateDefaultInDb } from "@/lib/config-admin";
import type {
  ConfiguratorDefault,
  ConfiguratorParameter,
} from "@/types/configurator";

const SELECT_CLASS =
  "flex h-10 w-full rounded-md border border-input bg-background px-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

/** Sentinel for the "no door model" option — a <select> cannot hold null. */
const NO_MODEL = "__none__";

export function DefaultEditorDialog({
  open,
  onOpenChange,
  configuratorId,
  value: row,
  parameters,
  /** Every default in this configurator — used to spot a clash before saving. */
  allDefaults,
  onSaved,
  onDeleted,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  configuratorId: string;
  value: ConfiguratorDefault | null;
  parameters: ConfiguratorParameter[];
  allDefaults: ConfiguratorDefault[];
  onSaved: (updated: ConfiguratorDefault, movedFrom: string | null) => void;
  onDeleted: (removed: ConfiguratorDefault) => void;
}) {
  const [draft, setDraft] = React.useState("");
  const [model, setModel] = React.useState(NO_MODEL);
  const [saving, setSaving] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setDraft(row?.value ?? "");
    setModel(row?.doorModel ?? NO_MODEL);
    setError(null);
    setConfirmDelete(false);
  }, [row]);

  // Door models offered by this configurator, so a default cannot be pointed
  // at a model the form has never heard of.
  const models = React.useMemo(() => {
    const p = parameters.find(
      (x) => x.controlName.toUpperCase() === "CMBDOORMODEL"
    );
    const fromOptions = (p?.options ?? [])
      .map((o) => o.value)
      .filter((v) => v !== "");
    // Fall back to whatever the existing defaults already use, so an editor
    // still works on a configurator with no CMBDOORMODEL parameter.
    const fromDefaults = allDefaults
      .map((d) => d.doorModel)
      .filter((v): v is string => Boolean(v));
    return Array.from(new Set([...fromOptions, ...fromDefaults])).sort();
  }, [parameters, allDefaults]);

  if (!row) return null;

  const param = parameters.find(
    (p) => p.controlName.toUpperCase() === row.controlName.toUpperCase()
  );
  const options = (param?.options ?? []).filter((o) => o.value !== "");
  const known = options.some((o) => o.value === draft);

  const targetModel = model === NO_MODEL ? null : model;
  const moving = targetModel !== (row.doorModel ?? null);

  // The same check the API makes, so the clash is visible before saving
  // rather than as a rejected request.
  const clash =
    moving &&
    allDefaults.some(
      (d) =>
        d.controlName.toUpperCase() === row.controlName.toUpperCase() &&
        (d.doorModel ?? null) === targetModel
    );

  const dirty = draft !== row.value || moving;

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await updateDefaultInDb(
        configuratorId,
        row.doorModel,
        row.controlName,
        draft,
        undefined,
        moving ? { newDoorModel: targetModel } : undefined
      );
      onSaved(
        { ...row, value: draft, doorModel: targetModel },
        moving ? row.doorModel : null
      );
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    setSaving(true);
    setError(null);
    try {
      await deleteDefaultFromDb(configuratorId, row.doorModel, row.controlName);
      onDeleted(row);
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed.");
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
          <div className="rounded-md border p-3 text-sm">
            <div className="text-xs text-muted-foreground">Parameter</div>
            <div className="font-mono text-xs">{row.controlName}</div>
            {param && (
              <div className="text-xs text-muted-foreground">{param.label}</div>
            )}
            {row.specName && (
              <div className="mt-1 text-xs">
                <span className="text-muted-foreground">Specification: </span>
                {row.specName}
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="default-model">Door model</Label>
            <select
              id="default-model"
              className={SELECT_CLASS}
              value={model}
              onChange={(e) => setModel(e.target.value)}
            >
              <option value={NO_MODEL}>All models / conditional</option>
              {models.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
            {clash && (
              <p className="flex items-start gap-1.5 text-xs text-destructive">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>
                  {row.controlName} already has a default for{" "}
                  {targetModel ?? "all models"}. One parameter can only have one
                  default per model — edit that row instead, or delete it first.
                </span>
              </p>
            )}
          </div>

          {row.doorModel === null && !moving && (
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

          {confirmDelete && (
            <p className="rounded-md border border-destructive/50 bg-destructive/10 p-2 text-sm text-destructive">
              Delete the default for {row.controlName} on{" "}
              {row.doorModel ?? "all models"}? Any conditions attached to it go
              too.
            </p>
          )}
        </div>

        <div className="mt-2 flex items-center gap-2">
          <Button
            variant="ghost"
            className="text-destructive hover:text-destructive"
            disabled={saving}
            onClick={() => (confirmDelete ? remove() : setConfirmDelete(true))}
          >
            <Trash2 className="h-4 w-4" />
            {confirmDelete ? "Yes, delete" : "Delete"}
          </Button>
          <div className="ml-auto flex gap-2">
            <Button
              variant="outline"
              onClick={() =>
                confirmDelete ? setConfirmDelete(false) : onOpenChange(false)
              }
            >
              Cancel
            </Button>
            <Button
              onClick={save}
              disabled={saving || !dirty || clash || confirmDelete}
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {moving ? "Save and move" : "Save"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
