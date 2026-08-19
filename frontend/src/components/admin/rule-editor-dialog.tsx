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
  ControlSelect,
  ValueEditor,
  NO_VALUE_OPERATORS,
} from "@/components/admin/condition-fields";
import {
  RevisionBuilder,
  buildRevisionFormula,
  parseRevisionFormula,
  type RevisionRule,
} from "@/components/admin/revision-builder";
import {
  QuantityBuilder,
  buildFormula,
  parseFormula,
  type QtyCondition,
} from "@/components/admin/quantity-builder";
import {
  SlotCounter,
  EMPTY_SLOT_COUNT,
  buildSlotFormula,
  parseSlotFormula,
  type SlotCount,
} from "@/components/admin/slot-counter";
import type { ConfiguratorParameter } from "@/types/configurator";
import {
  OPERATOR_LABELS,
  QUANTITY_UNIT_HELP,
  QUANTITY_UNITS,
  RULE_CATEGORIES,
  RULE_CATEGORY_LABELS,
  VALUELESS_OPERATORS,
  type ConditionOperator,
  type ConfiguratorRule,
  type QuantityUnit,
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
  /** Control names of this configurator's parameters, offered as suggestions. */
  controlNames?: string[];
  /** Full parameters, so the builder can offer field + value dropdowns. */
  parameters?: ConfiguratorParameter[];
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
  controlNames = [],
  parameters = [],
  onSave,
}: RuleEditorDialogProps) {
  const [draft, setDraft] = React.useState<ConfiguratorRule>(() =>
    emptyRule(configuratorId)
  );

  const [useFormula, setUseFormula] = React.useState(false);
  const [advanced, setAdvanced] = React.useState(false);
  const [qtyConds, setQtyConds] = React.useState<QtyCondition[]>([]);
  const [thenQty, setThenQty] = React.useState("2");
  const [elseQty, setElseQty] = React.useState("1");
  const [revByCondition, setRevByCondition] = React.useState(false);
  const [revRules, setRevRules] = React.useState<RevisionRule[]>([]);
  const [revFallback, setRevFallback] = React.useState("");
  const [formulaCheck, setFormulaCheck] = React.useState<{
    ok: boolean;
    result?: number;
    error?: string;
  } | null>(null);
  const [useSlotCount, setUseSlotCount] = React.useState(false);
  const [slotCount, setSlotCount] = React.useState<SlotCount>(EMPTY_SLOT_COUNT);
  const [slotRaw, setSlotRaw] = React.useState("");

  // Live-validate the quantity formula against representative sample values,
  // so a bad expression is caught here rather than at pricing time.
  const formulaText = draft.quantityFormula ?? "";
  React.useEffect(() => {
    if (!useFormula || !formulaText.trim()) {
      setFormulaCheck(null);
      return;
    }
    let active = true;
    const timer = setTimeout(() => {
      fetch("/api/formula/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          formula: formulaText,
          values: {
            CMBSINGLEPAIR: "Pair",
            CHKISPAIR: 1,
            NUMDOORWIDTH: 4500,
            NUMDOORHEIGHT: 3000,
            NUMTOTALDOORSPROJ: 1,
          },
        }),
      })
        .then((r) => r.json())
        .then((r) => active && setFormulaCheck(r))
        .catch(() => active && setFormulaCheck(null));
    }, 350);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [useFormula, formulaText]);

  React.useEffect(() => {
    if (open) {
      setDraft(rule ? structuredClone(rule) : emptyRule(configuratorId));
      const f = rule?.quantityFormula?.trim() ?? "";
      setUseFormula(Boolean(f));
      const parsed = parseFormula(f);
      if (parsed) {
        setQtyConds(parsed.conditions);
        setThenQty(parsed.thenQty || "2");
        setElseQty(parsed.elseQty || "1");
        setAdvanced(false);
      } else {
        // a formula the builder can't represent — keep the raw editor
        setAdvanced(true);
      }
      const rf = rule?.resultRevisionFormula?.trim() ?? "";
      setRevByCondition(Boolean(rf));
      const parsedRev = parseRevisionFormula(rf);
      setRevRules(parsedRev?.rules ?? []);
      setRevFallback(parsedRev?.fallback ?? "");

      const cf = rule?.conditionFormula?.trim() ?? "";
      setUseSlotCount(Boolean(cf));
      // A hand-written formula the builder can't represent still saves — we
      // just show it read-only rather than silently rewriting it.
      setSlotCount(parseSlotFormula(cf) ?? EMPTY_SLOT_COUNT);
      setSlotRaw(cf && !parseSlotFormula(cf) ? cf : "");
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

  const addConditionToGroup = (groupNo: number) =>
    setDraft((prev) => ({
      ...prev,
      conditions: [
        ...prev.conditions,
        { controlName: "", operator: "is_checked", value: "", groupNo },
      ],
    }));

  const addOrGroup = () =>
    setDraft((prev) => {
      const nextGroup =
        Math.max(0, ...prev.conditions.map((c) => c.groupNo ?? 1)) + 1;
      return {
        ...prev,
        conditions: [
          ...prev.conditions,
          { controlName: "", operator: "is_checked", value: "", groupNo: nextGroup },
        ],
      };
    });

  const removeCondition = (index: number) =>
    setDraft((prev) => ({
      ...prev,
      conditions: prev.conditions.filter((_, i) => i !== index),
    }));

  // Group the conditions (with their original index) by groupNo, in order.
  const groups = (() => {
    const map = new Map<number, { cond: RuleCondition; index: number }[]>();
    draft.conditions.forEach((cond, index) => {
      const g = cond.groupNo ?? 1;
      if (!map.has(g)) map.set(g, []);
      map.get(g)!.push({ cond, index });
    });
    return Array.from(map.entries()).sort((a, b) => a[0] - b[0]);
  })();

  // "After-hours" and "SWI- pair" only mean something for installation labour.
  const isInstallation = configuratorId.toUpperCase().includes("INSTALL");

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
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{rule ? "Edit rule" : "Add rule"}</DialogTitle>
          <DialogDescription>
            Define when a part is added to the configuration and whether it&apos;s
            an upgrade.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <datalist id="rule-control-names">
            {controlNames.map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>
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

          {/* Conditions — AND within a group, OR between groups (like an if) */}
          <div className="space-y-2">
            <Label>
              When — <span className="font-semibold">AND</span> within a group,{" "}
              <span className="font-semibold">OR</span> between groups
            </Label>
            <p className="text-xs text-muted-foreground">
              The rule fires when any group is fully satisfied, e.g.{" "}
              <code>(A AND B) OR (C)</code>.
            </p>

            {groups.map(([groupNo, items], gi) => (
              <React.Fragment key={groupNo}>
                {gi > 0 && (
                  <div className="flex items-center gap-2 py-0.5">
                    <div className="h-px flex-1 bg-border" />
                    <span className="rounded bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                      OR
                    </span>
                    <div className="h-px flex-1 bg-border" />
                  </div>
                )}
                <div className="space-y-2 rounded-md border p-2">
                  {items.map(({ cond, index }, ci) => {
                    const valueless = VALUELESS_OPERATORS.includes(cond.operator);
                    return (
                      <div key={index} className="space-y-2">
                        {ci > 0 && (
                          <div className="text-center text-xs font-medium text-muted-foreground">
                            AND
                          </div>
                        )}
                        <div className="flex items-start gap-2">
                          <ControlSelect
                            parameters={parameters}
                            value={cond.controlName}
                            onChange={(controlName) =>
                              updateCondition(index, { controlName, value: "" })
                            }
                            className="min-w-[170px] flex-1"
                          />
                          <select
                            className={cn(SELECT_CLASS, "w-36 shrink-0")}
                            value={cond.operator}
                            onChange={(e) =>
                              updateCondition(index, {
                                operator: e.target.value as ConditionOperator,
                                value: "",
                              })
                            }
                          >
                            {OPERATORS.map((op) => (
                              <option key={op} value={op}>
                                {OPERATOR_LABELS[op]}
                              </option>
                            ))}
                          </select>
                          {!NO_VALUE_OPERATORS.has(cond.operator) && (
                            <div className="w-56 shrink-0">
                              <ValueEditor
                                parameter={parameters.find(
                                  (p) =>
                                    p.controlName.toUpperCase() ===
                                    cond.controlName.toUpperCase()
                                )}
                                operator={cond.operator}
                                value={cond.value}
                                onChange={(value) => updateCondition(index, { value })}
                              />
                            </div>
                          )}
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
                      </div>
                    );
                  })}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => addConditionToGroup(groupNo)}
                  >
                    <Plus className="h-4 w-4" />
                    AND condition
                  </Button>
                </div>
              </React.Fragment>
            ))}

            <Button variant="outline" size="sm" onClick={addOrGroup}>
              <Plus className="h-4 w-4" />
              OR group
            </Button>

            {/* The M1 configurator repeats this across dozens of rules: look at
                cmbAct1..cmbAct4 (or cmbRadar1..2), count what matches, and drop
                the line when the count is zero. */}
            <div className="space-y-2 border-t pt-3">
              <label className="flex items-center gap-2 text-sm font-medium">
                <input
                  type="checkbox"
                  checked={useSlotCount}
                  onChange={(e) => {
                    setUseSlotCount(e.target.checked);
                    if (!e.target.checked) {
                      setSlotRaw("");
                      patch({ conditionFormula: "" });
                    }
                  }}
                />
                …and count across numbered fields
              </label>
              <p className="text-xs text-muted-foreground">
                For rules that depend on how many activation or radar slots are
                set — e.g. only charge when a floor loop is selected.
              </p>
              {useSlotCount &&
                (slotRaw ? (
                  <div className="space-y-1">
                    <p className="rounded bg-muted px-2 py-1 font-mono text-[11px]">
                      {slotRaw}
                    </p>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSlotRaw("");
                        patch({ conditionFormula: "" });
                      }}
                    >
                      Replace with the builder
                    </Button>
                  </div>
                ) : (
                  <SlotCounter
                    parameters={parameters}
                    value={slotCount}
                    onChange={(next) => {
                      setSlotCount(next);
                      patch({ conditionFormula: buildSlotFormula(next) });
                    }}
                  />
                ))}
            </div>
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
              <div className="flex items-center justify-between">
                <Label htmlFor="rule-rev">Result revision (optional)</Label>
                <label className="flex items-center gap-1.5 text-xs font-normal">
                  <input
                    type="checkbox"
                    checked={revByCondition}
                    onChange={(e) => {
                      setRevByCondition(e.target.checked);
                      if (!e.target.checked) patch({ resultRevisionFormula: "" });
                    }}
                  />
                  Depends on the configuration
                </label>
              </div>
              {!revByCondition && (
                <Input
                  id="rule-rev"
                  value={draft.resultRevision ?? ""}
                  onChange={(e) => patch({ resultRevision: e.target.value })}
                  placeholder="e.g. HS65"
                />
              )}
            </div>
          </div>

          {revByCondition && (
            <div className="space-y-2 rounded-md border p-3">
              <Label>Revision by configuration</Label>
              <RevisionBuilder
                parameters={parameters}
                rules={revRules}
                fallback={revFallback}
                onChange={(next) => {
                  setRevRules(next.rules);
                  setRevFallback(next.fallback);
                  patch({
                    resultRevisionFormula: buildRevisionFormula(
                      next.rules,
                      next.fallback
                    ),
                  });
                }}
              />
              {draft.resultRevisionFormula && (
                <code className="block truncate rounded bg-muted/40 px-2 py-1 text-xs text-muted-foreground">
                  {draft.resultRevisionFormula}
                </code>
              )}
            </div>
          )}

          {/* Quantity per assembly */}
          <div className="space-y-3 rounded-md border p-3">
            <div className="flex items-center justify-between">
              <Label>Quantity per assembly</Label>
              <label className="flex items-center gap-2 text-sm font-normal">
                <input
                  type="checkbox"
                  checked={useFormula}
                  onChange={(e) => {
                    const on = e.target.checked;
                    setUseFormula(on);
                    if (!on) patch({ quantityFormula: "" });
                  }}
                />
                Custom formula
              </label>
            </div>

            {useFormula ? (
              advanced ? (
                <div className="space-y-1.5">
                  <Input
                    value={draft.quantityFormula ?? ""}
                    onChange={(e) => patch({ quantityFormula: e.target.value })}
                    placeholder='e.g. IF(CMBSINGLEPAIR = "Pair", 2, 1)'
                    className={`font-mono text-sm ${
                      formulaCheck && !formulaCheck.ok ? "border-destructive" : ""
                    }`}
                  />
                  {formulaCheck && (
                    <p className={`text-xs ${formulaCheck.ok ? "text-success" : "text-destructive"}`}>
                      {formulaCheck.ok
                        ? `Valid — evaluates to ${formulaCheck.result} with sample values.`
                        : formulaCheck.error}
                    </p>
                  )}
                  <button
                    type="button"
                    className="text-xs text-primary underline"
                    onClick={() => {
                      const parsed = parseFormula(draft.quantityFormula ?? "");
                      if (parsed) {
                        setQtyConds(parsed.conditions);
                        setThenQty(parsed.thenQty || "2");
                        setElseQty(parsed.elseQty || "1");
                        setAdvanced(false);
                      }
                    }}
                  >
                    Back to the simple builder
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <QuantityBuilder
                    parameters={parameters}
                    conditions={qtyConds}
                    thenQty={thenQty}
                    elseQty={elseQty}
                    onChange={(next) => {
                      setQtyConds(next.conditions);
                      setThenQty(next.thenQty);
                      setElseQty(next.elseQty);
                      patch({
                        quantityFormula: buildFormula(
                          next.conditions,
                          next.thenQty,
                          next.elseQty
                        ),
                      });
                    }}
                  />
                  <div className="flex items-center justify-between gap-2 rounded-md bg-muted/40 px-2 py-1.5">
                    <code className="truncate text-xs text-muted-foreground">
                      {draft.quantityFormula || "1"}
                    </code>
                    <button
                      type="button"
                      className="shrink-0 text-xs text-primary underline"
                      onClick={() => setAdvanced(true)}
                    >
                      Edit as formula
                    </button>
                  </div>
                </div>
              )
            ) : (
              <>
                <div className={`grid gap-3 ${isInstallation ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
                  <div className="space-y-1.5">
                    <Label htmlFor="rule-qty" className="text-xs">
                      Base quantity
                    </Label>
                    <Input
                      id="rule-qty"
                      value={draft.quantity}
                      onChange={(e) => patch({ quantity: e.target.value })}
                      placeholder="1"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="rule-unit" className="text-xs">
                      Unit
                    </Label>
                    <select
                      id="rule-unit"
                      className={SELECT_CLASS}
                      value={draft.quantityUnit ?? "Per Door"}
                      onChange={(e) =>
                        patch({ quantityUnit: e.target.value as QuantityUnit })
                      }
                    >
                      {QUANTITY_UNITS.map((u) => (
                        <option key={u} value={u}>
                          {u}
                        </option>
                      ))}
                    </select>
                  </div>
                  {isInstallation && (
                  <div className="space-y-1.5">
                    <Label htmlFor="rule-ah" className="text-xs">
                      After-hours ×
                    </Label>
                    <Input
                      id="rule-ah"
                      type="number"
                      min={1}
                      value={draft.ahFactor ?? 1}
                      onChange={(e) =>
                        patch({ ahFactor: Number(e.target.value) || 1 })
                      }
                    />
                  </div>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {QUANTITY_UNIT_HELP[draft.quantityUnit ?? "Per Door"]}
                </p>
                {isInstallation && (
                <div className="flex items-center gap-3">
                  <Switch
                    checked={!!draft.swiPairDoubles}
                    onCheckedChange={(v) => patch({ swiPairDoubles: v })}
                    aria-label="SWI pair doubles"
                  />
                  <span className="text-sm">
                    Double the quantity for SWI‑ paired doors
                  </span>
                </div>
                )}
              </>
            )}
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
