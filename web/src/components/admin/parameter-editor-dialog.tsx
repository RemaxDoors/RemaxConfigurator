"use client";

import * as React from "react";
import { Plus, X } from "lucide-react";

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
import { Switch } from "@/components/ui/switch";
import {
  PARAMETER_KINDS,
  PARAMETER_KIND_LABELS,
  type ConfiguratorParameter,
  type ParameterKind,
  type ParameterOption,
} from "@/types/configurator";

const SELECT_CLASS =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

interface ParameterEditorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  parameter: ConfiguratorParameter | null; // null = create
  existingControlNames: string[]; // to prevent duplicates on create
  /** Section names already used by this configurator, offered in a dropdown. */
  existingSections?: string[];
  onSave: (parameter: ConfiguratorParameter) => void;
}

function emptyParameter(): ConfiguratorParameter {
  return { controlName: "", label: "", kind: "dropdown", options: [] };
}

export function ParameterEditorDialog({
  open,
  onOpenChange,
  parameter,
  existingControlNames,
  existingSections = [],
  onSave,
}: ParameterEditorDialogProps) {
  const [draft, setDraft] = React.useState<ConfiguratorParameter>(
    emptyParameter
  );

  React.useEffect(() => {
    if (open) setDraft(parameter ? structuredClone(parameter) : emptyParameter());
  }, [open, parameter]);

  const patch = (p: Partial<ConfiguratorParameter>) =>
    setDraft((prev) => ({ ...prev, ...p }));

  const options = draft.options ?? [];
  const setOptions = (next: ParameterOption[]) => patch({ options: next });

  const isEdit = parameter !== null;
  const duplicate =
    !isEdit &&
    existingControlNames.includes(draft.controlName.trim().toUpperCase());
  const canSave =
    draft.controlName.trim() !== "" && draft.label.trim() !== "" && !duplicate;

  const handleSave = () => {
    if (!canSave) return;
    const cleaned: ConfiguratorParameter = {
      ...draft,
      controlName: draft.controlName.trim(),
      label: draft.label.trim(),
      // keep only the fields relevant to the chosen kind
      options: draft.kind === "dropdown" ? options : undefined,
      min: draft.kind === "number" ? draft.min : undefined,
      max: draft.kind === "number" ? draft.max : undefined,
      step: draft.kind === "number" ? draft.step : undefined,
    };
    onSave(cleaned);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit parameter" : "Add parameter"}</DialogTitle>
          <DialogDescription>
            Define an input for this configurator. The control name is what rules
            and M1 reference.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="p-control">Control name</Label>
              <Input
                id="p-control"
                value={draft.controlName}
                onChange={(e) => patch({ controlName: e.target.value })}
                placeholder="e.g. CMBUPS"
                disabled={isEdit}
              />
              {duplicate && (
                <p className="text-xs text-destructive">
                  A parameter with this control name already exists.
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-label">Label</Label>
              <Input
                id="p-label"
                value={draft.label}
                onChange={(e) => patch({ label: e.target.value })}
                placeholder="e.g. UPS"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-kind">Type</Label>
              <select
                id="p-kind"
                className={SELECT_CLASS}
                value={draft.kind}
                onChange={(e) => patch({ kind: e.target.value as ParameterKind })}
              >
                {PARAMETER_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {PARAMETER_KIND_LABELS[k]}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-section">Section (form step)</Label>
              <Input
                id="p-section"
                list="p-sections"
                value={draft.section ?? ""}
                onChange={(e) => patch({ section: e.target.value })}
                placeholder="Select or type a section"
              />
              <datalist id="p-sections">
                {existingSections.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
            </div>
            <div className="flex items-end gap-3">
              <Switch
                checked={!!draft.required}
                onCheckedChange={(v) => patch({ required: v })}
                aria-label="Required"
              />
              <span className="pb-2 text-sm">Required</span>
            </div>
          </div>

          {/* Dropdown options */}
          {draft.kind === "dropdown" && (
            <div className="space-y-2">
              <Label>Options</Label>
              {options.length === 0 && (
                <p className="text-xs text-muted-foreground">No options yet.</p>
              )}
              {options.map((opt, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Input
                    value={opt.value}
                    onChange={(e) =>
                      setOptions(
                        options.map((o, i) =>
                          i === index ? { ...o, value: e.target.value } : o
                        )
                      )
                    }
                    placeholder="value (e.g. 1kVA)"
                    className="flex-1"
                  />
                  <Input
                    value={opt.label}
                    onChange={(e) =>
                      setOptions(
                        options.map((o, i) =>
                          i === index ? { ...o, label: e.target.value } : o
                        )
                      )
                    }
                    placeholder="label (e.g. 1 kVA)"
                    className="flex-1"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() =>
                      setOptions(options.filter((_, i) => i !== index))
                    }
                    aria-label="Remove option"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setOptions([...options, { value: "", label: "" }])}
              >
                <Plus className="h-4 w-4" />
                Add option
              </Button>
            </div>
          )}

          {/* Number bounds */}
          {draft.kind === "number" && (
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="p-min">Min</Label>
                <Input
                  id="p-min"
                  type="number"
                  value={draft.min ?? ""}
                  onChange={(e) =>
                    patch({
                      min: e.target.value === "" ? undefined : Number(e.target.value),
                    })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="p-max">Max</Label>
                <Input
                  id="p-max"
                  type="number"
                  value={draft.max ?? ""}
                  onChange={(e) =>
                    patch({
                      max: e.target.value === "" ? undefined : Number(e.target.value),
                    })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="p-step">Step</Label>
                <Input
                  id="p-step"
                  type="number"
                  value={draft.step ?? ""}
                  onChange={(e) =>
                    patch({
                      step: e.target.value === "" ? undefined : Number(e.target.value),
                    })
                  }
                />
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="p-help">Help text (optional)</Label>
            <Input
              id="p-help"
              value={draft.helpText ?? ""}
              onChange={(e) => patch({ helpText: e.target.value })}
              placeholder="Shown under the field"
            />
          </div>
        </div>

        <div className="mt-2 flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!canSave}>
            {isEdit ? "Save changes" : "Add parameter"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
