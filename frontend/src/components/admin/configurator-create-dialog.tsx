"use client";

import * as React from "react";

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
import type { NewConfigurator } from "@/lib/config-admin";

const SELECT_CLASS =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

const DOOR_TYPES = ["", "RRD", "SWI", "ENT", "STRIP"];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingIds: string[];
  onCreate: (input: NewConfigurator) => Promise<void>;
}

export function ConfiguratorCreateDialog({
  open,
  onOpenChange,
  existingIds,
  onCreate,
}: Props) {
  const [partId, setPartId] = React.useState("");
  const [name, setName] = React.useState("");
  const [doorType, setDoorType] = React.useState("");
  const [partRevision, setPartRevision] = React.useState("A");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (open) {
      setPartId("");
      setName("");
      setDoorType("");
      setPartRevision("A");
      setBusy(false);
      setError(null);
    }
  }, [open]);

  const trimmedId = partId.trim().toUpperCase();
  const duplicate = existingIds.some((id) => id.toUpperCase() === trimmedId);
  const canSave = trimmedId !== "" && name.trim() !== "" && !duplicate && !busy;

  const submit = async () => {
    if (!canSave) return;
    setBusy(true);
    setError(null);
    try {
      await onCreate({
        partId: trimmedId,
        name: name.trim(),
        doorType: doorType || undefined,
        partRevision: partRevision.trim() || "A",
      });
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed.");
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>New configurator</DialogTitle>
          <DialogDescription>
            Create a configurator template. You can then add parameters manually
            or import them from a CSV.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="cfg-part-id">
              Template Part ID <span className="text-destructive">*</span>
            </Label>
            <Input
              id="cfg-part-id"
              value={partId}
              onChange={(e) => setPartId(e.target.value)}
              placeholder="e.g. INSTALL-TEMPLATE"
            />
            <p className="text-xs text-muted-foreground">
              The M1 template part id this configurator maps to. Stored uppercase.
            </p>
            {duplicate && (
              <p className="text-xs text-destructive">
                A configurator with this Part ID already exists.
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cfg-name">
              Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="cfg-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Installation"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="cfg-door-type">Door type (optional)</Label>
              <select
                id="cfg-door-type"
                className={SELECT_CLASS}
                value={doorType}
                onChange={(e) => setDoorType(e.target.value)}
              >
                {DOOR_TYPES.map((dt) => (
                  <option key={dt} value={dt}>
                    {dt === "" ? "None (curtain / install)" : dt}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cfg-rev">Part revision</Label>
              <Input
                id="cfg-rev"
                value={partRevision}
                onChange={(e) => setPartRevision(e.target.value)}
                placeholder="A"
              />
            </div>
          </div>

          {error && (
            <div className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={!canSave} onClick={submit}>
            {busy ? "Creating…" : "Create configurator"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
