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
import { cn } from "@/lib/utils";
import {
  OPERATOR_LABELS,
  RULE_CATEGORIES,
  RULE_CATEGORY_LABELS,
  VALUELESS_OPERATORS,
  type ConditionOperator,
  type ConfiguratorRule,
  type RuleCategory,
  type RuleCondition,
} from "@/types/configurator-rule";

const SELECT_CLASS =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

const OPERATORS = Object.keys(OPERATOR_LABELS) as ConditionOperator[];

interface RuleEditorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  configuratorId: string;
  rule: ConfiguratorRule | null; // null = create
  onSave: (rule: ConfiguratorRule) => void;
}

function emptyRule(configuratorId: string): ConfiguratorRule {
  return {
    id: "",
    configuratorId,
    name: "",
    category: "ASSEMBLY_UPGRADE",
    conditions: [{ controlName: "", operator: "is_checked", value: "" }],
    resultPartId: "",
    quantity: "1",
    isActive: true,
  };
}

export function RuleEditorDialog({
  open,
  onOpenChange,
  configuratorId,
  rule,
  onSave,
}: RuleEditorDialogProps) {
  const [draft, setDraft] = React.useState<ConfiguratorRule>(() =>
    emptyRule(configuratorId)
  );

  React.useEffect(() => {
    if (open) {
      setDraft(rule ? structuredClone(rule) : emptyRule(configuratorId));
    }
  }, [open, rule, configuratorId]);

  const patch = (p: Partial<ConfiguratorRule>) =>
    setDraft((prev) => ({ ...prev, ...p }));

  const updateCondition = (index: number, p: Partial<RuleCondition>) =>
    setDraft((prev) => ({
      ...prev,
      conditions: prev.conditions.map((c, i) =>
        i === index ? { ...c, ...p } : c
      ),
    }));

  const addCondition = () =>
    setDraft((prev) => ({
      ...prev,
      conditions: [
        ...prev.conditions,
        { controlName: "", operator: "is_checked", value: "" },
      ],
    }));

  const removeCondition = (index: number) =>
    setDraft((prev) => ({
      ...prev,
      conditions: prev.conditions.filter((_, i) => i !== index),
    }));

  const canSave =
    draft.name.trim() !== "" &&
    draft.resultPartId.trim() !== "" &&
    draft.conditions.every((c) => c.controlName.trim() !== "");

  const handleSave = () => {
    if (!canSave) return;
    onSave({
      ...draft,
      id: draft.id || (crypto.randomUUID?.() ?? `r${Date.now()}`),
      configuratorId,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{rule ? "Edit rule" : "Add rule"}</DialogTitle>
          <DialogDescription>
            Define when a part is added to the configuration and whether it&apos;s
            an upgrade.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="rule-name">Rule name</Label>
              <Input
                id="rule-name"
                value={draft.name}
                onChange={(e) => patch({ name: e.target.value })}
                placeholder="e.g. Hyperlift"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rule-category">Category (is it an upgrade?)</Label>
              <select
                id="rule-category"
                className={SELECT_CLASS}
                value={draft.category}
                onChange={(e) =>
                  patch({ category: e.target.value as RuleCategory })
                }
              >
                {RULE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {RULE_CATEGORY_LABELS[c]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Conditions */}
          <div className="space-y-2">
            <Label>When (all conditions must match)</Label>
            <div className="space-y-2">
              {draft.conditions.map((condition, index) => {
                const valueless = VALUELESS_OPERATORS.includes(
                  condition.operator
                );
                return (
                  <div key={index} className="flex items-center gap-2">
                    <Input
                      value={condition.controlName}
                      onChange={(e) =>
                        updateCondition(index, { controlName: e.target.value })
                      }
                      placeholder="Control (e.g. CHKHYPERLIFT)"
                      className="flex-1"
                    />
                    <select
                      className={cn(SELECT_CLASS, "w-36 shrink-0")}
                      value={condition.operator}
                      onChange={(e) =>
                        updateCondition(index, {
                          operator: e.target.value as ConditionOperator,
                        })
                      }
                    >
                      {OPERATORS.map((op) => (
                        <option key={op} value={op}>
                          {OPERATOR_LABELS[op]}
                        </option>
                      ))}
                    </select>
                    <Input
                      value={condition.value}
                      onChange={(e) =>
                        updateCondition(index, { value: e.target.value })
                      }
                      placeholder="Value"
                      disabled={valueless}
                      className="w-28 shrink-0"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeCondition(index)}
                      disabled={draft.conditions.length === 1}
                      aria-label="Remove condition"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                );
              })}
            </div>
            <Button variant="outline" size="sm" onClick={addCondition}>
              <Plus className="h-4 w-4" />
              Add condition
            </Button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="rule-part">Result part ID</Label>
              <Input
                id="rule-part"
                value={draft.resultPartId}
                onChange={(e) => patch({ resultPartId: e.target.value })}
                placeholder="e.g. RRD-HYPERLIFT-ASS"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rule-qty">Quantity</Label>
              <Input
                id="rule-qty"
                value={draft.quantity}
                onChange={(e) => patch({ quantity: e.target.value })}
                placeholder="1 or a formula"
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Switch
              checked={draft.isActive}
              onCheckedChange={(v) => patch({ isActive: v })}
              aria-label="Rule active"
            />
            <span className="text-sm">
              {draft.isActive ? "Active" : "Inactive"}
            </span>
          </div>
        </div>

        <div className="mt-2 flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!canSave}>
            {rule ? "Save changes" : "Add rule"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
