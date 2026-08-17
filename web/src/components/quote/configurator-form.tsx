"use client";

import * as React from "react";
import {
  ArrowLeft,
  Calculator,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Loader2,
  TriangleAlert,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { DoorPreview } from "@/components/quote/door-preview";
import { fetchConfigData } from "@/lib/config-data";
import { fetchPrice, fetchCurtainPrice } from "@/lib/pricing";
import {
  resolveDefaults,
  evaluateFormula,
  type ManualDefault,
} from "@/lib/configurator-links";
import { ConfiguratorSidebar, type SidebarItem } from "@/components/quote/configurator-sidebar";
import { ExtensionScreen, type ExtensionPanel } from "@/components/quote/extension-screen";
import { validateConfiguration, type ValidationResult } from "@/lib/validate";
import type { Configurator, ConfiguratorParameter } from "@/types/configurator";
import type { PriceBreakdown } from "@/types/pricing";

const SELECT_CLASS =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

const TRUTHY = new Set(["1", "true", "yes"]);
const NULLISH = new Set(["", "no", "not required", "none", "0", "false"]);

interface ConfiguratorFormProps {
  configuratorId: string;
  initialValues: Record<string, string>;
  /** Sub-configurators selected for this line (curtain / installation). */
  extensions?: ExtensionPanel[];
  onCancel: () => void;
  onComplete: (
    values: Record<string, string>,
    result: ValidationResult,
    pricing: PriceBreakdown | null
  ) => void;
}

/** Sections that only apply to certain models (mirrors the old door_section.py).
 *
 * Matched on the words in the section name rather than an exact string, so
 * renaming a section in the admin screen ("ES40 Options" -> "ES40 Only")
 * doesn't quietly show it for every model. */
function sectionAllowed(section: string, model: string): boolean {
  const m = model.toUpperCase();
  const s = section.toUpperCase();
  if (s.includes("ES40")) return m.includes("ES40");
  if (s.includes("THERMIC") || s.includes("MOVICHILL"))
    return m.includes("THERMIC") || m.includes("MOVICHILL");
  return true;
}

/**
 * A section may name a group inside the step, written "Step > Group":
 *   "Options > Electrical"  ->  step "Options", group "Electrical"
 * A plain "Options" is the step with no sub-group. This keeps the wizard steps
 * as they are while letting related fields sit together under a heading.
 */
function stepOf(section?: string): string {
  return (section || "General").split(">")[0].trim() || "General";
}

function groupOf(section?: string): string {
  const parts = (section || "").split(">");
  return parts.length > 1 ? parts.slice(1).join(">").trim() : "";
}

/** Fields of one step, split into their sub-groups in first-seen order. */
function groupParams(
  params: ConfiguratorParameter[]
): { name: string; params: ConfiguratorParameter[] }[] {
  const order: string[] = [];
  const byGroup = new Map<string, ConfiguratorParameter[]>();
  for (const p of params) {
    const g = groupOf(p.section);
    if (!byGroup.has(g)) {
      byGroup.set(g, []);
      order.push(g);
    }
    byGroup.get(g)!.push(p);
  }
  return order.map((name) => ({ name, params: byGroup.get(name)! }));
}

export function ConfiguratorForm({
  configuratorId,
  initialValues,
  extensions = [],
  onCancel,
  onComplete,
}: ConfiguratorFormProps) {
  const [configurator, setConfigurator] = React.useState<Configurator | null>(
    null
  );
  const [allConfigurators, setAllConfigurators] = React.useState<Configurator[]>([]);
  const [curtainPrice, setCurtainPrice] = React.useState<number | null>(null);
  const [manualDefaults, setManualDefaults] = React.useState<ManualDefault[]>([]);
  const [calculating, setCalculating] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [values, setValues] = React.useState<Record<string, string>>(
    initialValues
  );
  const [validating, setValidating] = React.useState(false);
  const [result, setResult] = React.useState<ValidationResult | null>(null);
  const [screen, setScreen] = React.useState("");
  const [pricing, setPricing] = React.useState<PriceBreakdown | null>(null);
  const [pricingLoading, setPricingLoading] = React.useState(false);

  React.useEffect(() => {
    setScreen("");
    setResult(null);
    let active = true;
    fetchConfigData()
      .then((data) => {
        if (!active) return;
        setAllConfigurators(data.configurators);
        setConfigurator(
          data.configurators.find((c) => c.id === configuratorId) ?? null
        );
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [configuratorId]);

  // Selecting a model pre-fills that model's default selections (uCfgDefaults).
  const applyModelDefaults = React.useCallback(
    (model: string, base: Record<string, string>) => {
      const next: Record<string, string> = { ...base, CMBDOORMODEL: model };
      for (const d of configurator?.defaults ?? []) {
        if (d.doorModel.toUpperCase() === model.toUpperCase()) {
          next[d.controlName] = d.value;
        }
      }
      return next;
    },
    [configurator]
  );

  const setValue = (control: string, value: string) =>
    setValues((prev) =>
      control === "CMBDOORMODEL"
        ? applyModelDefaults(value, prev)
        : { ...prev, [control]: value }
    );

  // Conditional defaults for each extension (installation adapts to its parent).
  const extKey = extensions.map((e) => e.configuratorId).join(",");
  const model = values.CMBDOORMODEL ?? "";
  const width = Number(values.NUMDOORWIDTH) || 0;
  const height = Number(values.NUMDOORHEIGHT) || 0;

  React.useEffect(() => {
    let active = true;
    // The door configurator itself, plus any selected sub-configurators.
    const targets = [
      { id: configuratorId, parent: undefined as string | undefined },
      ...extensions.map((e) => ({ id: e.configuratorId, parent: configuratorId })),
    ];
    Promise.all(
      targets.map((t) => resolveDefaults(t.id, values, t.parent))
    ).then((results) => {
      if (!active) return;
      const merged: Record<string, string> = {};
      const manuals: ManualDefault[] = [];
      for (const r of results) {
        Object.assign(merged, r.defaults);
        manuals.push(...r.manual);
      }
      setManualDefaults(manuals);
      // Conditional defaults seed the field; anything already set by the user wins.
      setValues((prev) => {
        const next = { ...prev };
        for (const [k, v] of Object.entries(merged)) {
          if (next[k] === undefined || next[k] === "") next[k] = v;
        }
        return next;
      });
    });
    return () => {
      active = false;
    };
    // Re-resolve when the inputs the conditions depend on change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [extKey, configuratorId, model, width, height, values.CHKISPAIR, values.CHKISSLIDER]);

  // Live curtain price for the extension bar.
  const hasCurtain = extensions.some((e) => e.kind === "curtain");
  React.useEffect(() => {
    if (!hasCurtain || !model || width <= 0 || height <= 0) {
      setCurtainPrice(null);
      return;
    }
    let active = true;
    fetchCurtainPrice(values)
      .then((p) => active && setCurtainPrice(p?.curtainSell ?? null))
      .catch(() => {});
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasCurtain, model, width, height, values.CMBTRACKCONFIG, values.CMBWINDTRACK]);

  /** Run a button-triggered calculation (M1's cmdCalcFreight_Click). */
  const runCalculation = async (m: ManualDefault) => {
    setCalculating(m.controlName);
    try {
      const r = await evaluateFormula(m.formula, values);
      if (r.ok && r.result !== undefined) {
        setValue(m.controlName, String(Math.round(r.result * 100) / 100));
      }
    } finally {
      setCalculating(null);
    }
  };

  const handleValidateAndAdd = async () => {
    setValidating(true);
    try {
      // Validate + fetch a fresh price together so the saved line carries pricing.
      const [res, price] = await Promise.all([
        validateConfiguration(configuratorId, values),
        fetchPrice(configuratorId, values),
      ]);
      setResult(res);
      if (price) setPricing(price);
      if (res.errors.length === 0) onComplete(values, res, price ?? pricing);
    } finally {
      setValidating(false);
    }
  };

  const renderField = (param: ConfiguratorParameter) => {
    const value = values[param.controlName] ?? "";
    switch (param.kind) {
      case "dropdown":
        return (
          <select
            className={SELECT_CLASS}
            value={value}
            onChange={(e) => setValue(param.controlName, e.target.value)}
          >
            {(param.options ?? []).map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        );
      case "checkbox":
        return (
          <Switch
            checked={TRUTHY.has(value.toLowerCase())}
            onCheckedChange={(v) => setValue(param.controlName, v ? "1" : "0")}
            aria-label={param.label}
          />
        );
      case "number":
        return (
          <Input
            type="number"
            value={value}
            min={param.min}
            max={param.max}
            step={param.step}
            onChange={(e) => setValue(param.controlName, e.target.value)}
          />
        );
      default:
        return (
          <Input
            value={value}
            onChange={(e) => setValue(param.controlName, e.target.value)}
          />
        );
    }
  };

  // ---- derive the steps from the parameter sections ----
  const visibleParams = (configurator?.parameters ?? []).filter(
    (p) => p.isVisible !== false
  );

  const sectionOrder: string[] = [];
  for (const p of visibleParams) {
    const s = stepOf(p.section);
    if (!sectionOrder.includes(s)) sectionOrder.push(s);
  }
  const fieldSteps = sectionOrder
    .filter((s) => sectionAllowed(s, model))
    .map((s) => ({
      name: s,
      params: visibleParams.filter((p) => stepOf(p.section) === s),
    }));
  // Screens = door steps, then the selected sub-configurators, then Summary.
  const screens = [
    ...fieldSteps.map((s) => ({ key: `door:${s.name}`, group: "door", name: s.name, params: s.params, panel: undefined as ExtensionPanel | undefined })),
    ...extensions.map((e) => ({ key: `ext:${e.kind}`, group: e.kind, name: e.title, params: [], panel: e })),
    { key: "summary", group: "summary", name: "Summary", params: [], panel: undefined as ExtensionPanel | undefined },
  ];
  const activeKey = screens.some((s) => s.key === screen) ? screen : screens[0].key;
  const currentScreen = screens.find((s) => s.key === activeKey)!;
  const current = { name: currentScreen.name, params: currentScreen.params };
  const isSummary = currentScreen.group === "summary";
  const isExtension = !!currentScreen.panel;
  const screenIndex = screens.findIndex((s) => s.key === activeKey);

  // Calculate buttons for fields shown on the current screen.
  const stepManuals = manualDefaults.filter((m) =>
    current.params.some((p) => p.controlName === m.controlName)
  );

  const sidebarItems: SidebarItem[] = screens.map((s, i) => ({
    key: s.key,
    label: s.name,
    group: s.group,
    complete: i < screenIndex,
  }));

  // Price from M1 whenever the summary is shown (and refresh if values changed).
  const priceKey = JSON.stringify(values);
  React.useEffect(() => {
    if (!isSummary) return;
    let active = true;
    setPricingLoading(true);
    fetchPrice(configuratorId, values)
      .then((p) => active && setPricing(p))
      .finally(() => active && setPricingLoading(false));
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSummary, priceKey, configuratorId]);

  const isDoor = visibleParams.some((p) => p.controlName === "NUMDOORWIDTH");
  const showControl = ["CMBACT1", "CMBACT2", "CMBACT3", "CMBACT4", "CMBRADAR1", "CMBRADAR2"].some(
    (k) => {
      const v = (values[k] ?? "").trim().toLowerCase();
      return v !== "" && v !== "not required";
    }
  );

  const selectedOptions = visibleParams
    .filter((p) => p.section !== "Size" && p.kind !== "number")
    .map((p) => {
      const raw = values[p.controlName] ?? "";
      const display = p.kind === "checkbox" ? (TRUTHY.has(raw.toLowerCase()) ? "Yes" : "") : raw;
      return { controlName: p.controlName, label: p.label, display };
    })
    .filter((o) => !NULLISH.has(o.display.trim().toLowerCase()));

  return (
    <Card>
      <CardHeader className="flex-row items-center gap-2 space-y-0">
        <Button variant="ghost" size="icon" onClick={onCancel} aria-label="Back">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <CardTitle>Configure — {configurator?.name ?? configuratorId}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading configurator…
          </div>
        ) : !configurator ? (
          <p className="py-10 text-sm text-muted-foreground">
            Configurator “{configuratorId}” not found.
          </p>
        ) : (
          <>
            <div className="grid gap-6 lg:grid-cols-[190px_1fr]">
              {/* Sidebar */}
              <div className="lg:sticky lg:top-4 lg:self-start">
                <ConfiguratorSidebar
                  items={sidebarItems}
                  activeKey={activeKey}
                  onSelect={setScreen}
                />
              </div>

              <div className={isDoor && !isExtension ? "grid gap-5 xl:grid-cols-[1fr_240px]" : "grid gap-5"}>
              {/* Main screen */}
              <div className="space-y-4">
                {isExtension ? (
                  <ExtensionScreen
                    panel={currentScreen.panel!}
                    configurator={allConfigurators.find(
                      (c) => c.id === currentScreen.panel!.configuratorId
                    )}
                    values={values}
                    onChange={setValue}
                    price={currentScreen.panel!.kind === "curtain" ? curtainPrice : null}
                  />
                ) : isSummary ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                      <SummaryStat label="Model" value={values.CMBDOORMODEL || "—"} />
                      <SummaryStat label="Width" value={width ? `${width.toLocaleString()} mm` : "—"} />
                      <SummaryStat label="Height" value={height ? `${height.toLocaleString()} mm` : "—"} />
                      <SummaryStat label="Qty" value={values.QTY || "1"} />
                    </div>
                    <div>
                      <p className="mb-1.5 text-sm font-medium">Selected options</p>
                      <div className="divide-y rounded-md border">
                        {selectedOptions.length === 0 ? (
                          <p className="px-3 py-2 text-sm text-muted-foreground">
                            No upgrades selected.
                          </p>
                        ) : (
                          selectedOptions.map((o) => (
                            <div
                              key={o.controlName}
                              className="flex justify-between gap-3 px-3 py-1.5 text-sm"
                            >
                              <span className="text-muted-foreground">{o.label}</span>
                              <span className="text-right font-medium">{o.display}</span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    <PriceSummary pricing={pricing} loading={pricingLoading} />

                    {result && (
                      <div className="space-y-2">
                        {result.unavailable && (
                          <p className="text-sm text-muted-foreground">
                            Validation service unavailable — configuration was not checked.
                          </p>
                        )}
                        {result.errors.map((e, i) => (
                          <div
                            key={`e${i}`}
                            className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive"
                          >
                            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                            <span>
                              {e.field ? <b>{e.field}: </b> : null}
                              {e.message}
                            </span>
                          </div>
                        ))}
                        {result.warnings.map((w, i) => (
                          <div
                            key={`w${i}`}
                            className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/5 px-3 py-2 text-sm text-amber-700 dark:text-amber-400"
                          >
                            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                            <span>
                              {w.field ? <b>{w.field}: </b> : null}
                              {w.message}
                            </span>
                          </div>
                        ))}
                        {result.is_valid && result.errors.length === 0 && !result.unavailable && (
                          <div className="flex items-center gap-2 text-sm text-success">
                            <CheckCircle2 className="h-4 w-4" /> No blocking errors.
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <>
                    {current.name === "Size" && (configurator.defaults?.length ?? 0) > 0 && (
                      <p className="text-xs text-muted-foreground">
                        Choosing a model pre-fills its standard options — change any
                        of them in the later steps.
                      </p>
                    )}
                    {stepManuals.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {stepManuals.map((m) => (
                          <Button
                            key={m.controlName}
                            variant="outline"
                            size="sm"
                            onClick={() => runCalculation(m)}
                            disabled={calculating === m.controlName}
                          >
                            {calculating === m.controlName ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Calculator className="h-4 w-4" />
                            )}
                            {m.controlName === "NUMFREIGHTALLOWANCE"
                              ? "Calculate freight"
                              : `Calculate ${m.controlName}`}
                          </Button>
                        ))}
                      </div>
                    )}
                    {groupParams(current.params).map((group) => (
                      <div key={group.name || "_"} className="space-y-3">
                        {group.name && (
                          <h3 className="border-b pb-1 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                            {group.name}
                          </h3>
                        )}
                        <div className="grid gap-4 sm:grid-cols-2">
                          {group.params.map((param) => (
                            <div
                              key={param.controlName}
                              className={
                                param.kind === "checkbox"
                                  ? "flex items-center justify-between gap-2 rounded-md border px-3 py-2"
                                  : "space-y-1.5"
                              }
                            >
                              <Label className="flex items-center gap-1">
                                {param.label}
                                {param.required && <span className="text-destructive">*</span>}
                              </Label>
                              {renderField(param)}
                              {param.helpText && param.kind !== "checkbox" && (
                                <p className="text-xs text-muted-foreground">{param.helpText}</p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </div>

              {/* Right: live preview (door screens only) */}
              {isDoor && !isExtension && (
                <div className="space-y-3 lg:sticky lg:top-4 lg:self-start">
                  <DoorPreview width={width} height={height} showControl={showControl} />
                  <p className="text-center text-xs text-muted-foreground">
                    {values.CMBDOORMODEL || "No model"} ·{" "}
                    {width && height ? `${width.toLocaleString()} × ${height.toLocaleString()} mm` : "size not set"}
                  </p>
                </div>
              )}
              </div>
            </div>

            {/* Footer nav */}
            <div className="flex items-center justify-between border-t pt-3">
              {screenIndex === 0 ? (
                <Button variant="outline" onClick={onCancel}>
                  Cancel
                </Button>
              ) : (
                <Button
                  variant="outline"
                  onClick={() => setScreen(screens[Math.max(0, screenIndex - 1)].key)}
                >
                  <ChevronLeft className="h-4 w-4" /> Back
                </Button>
              )}

              <div className="flex gap-1.5">
                {screens.map((s, i) => (
                  <span
                    key={s.key}
                    className={`h-1.5 w-1.5 rounded-full ${
                      i === screenIndex ? "bg-primary" : "bg-border"
                    }`}
                  />
                ))}
              </div>

              {isSummary ? (
                <Button onClick={handleValidateAndAdd} disabled={validating}>
                  {validating ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4" />
                  )}
                  Validate &amp; Add
                </Button>
              ) : (
                <Button
                  onClick={() =>
                    setScreen(screens[Math.min(screens.length - 1, screenIndex + 1)].key)
                  }
                >
                  Next <ChevronRight className="h-4 w-4" />
                </Button>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-muted/40 px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="truncate text-sm font-medium">{value}</p>
    </div>
  );
}

const money = (n: number) =>
  `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function PriceSummary({
  pricing,
  loading,
}: {
  pricing: PriceBreakdown | null;
  loading: boolean;
}) {
  if (loading && !pricing) {
    return (
      <div className="flex items-center gap-2 rounded-md border px-3 py-3 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Pricing from M1…
      </div>
    );
  }
  if (!pricing) {
    return (
      <div className="rounded-md border px-3 py-3 text-sm text-muted-foreground">
        Price unavailable — check the M1 connection.
      </div>
    );
  }

  const rows: [string, number, "add" | "sub" | "plain"][] = [
    ["Door Price", pricing.doorPrice, "plain"],
    ["Door Cost", pricing.doorCost, "plain"],
    ["Material Upgrade", pricing.materialUpgrade, "add"],
    ["Material Discount", pricing.materialDiscount, "sub"],
    ["Installation", pricing.installation, "add"],
  ];

  return (
    <div className="space-y-3 rounded-md border p-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">Price breakdown</p>
        {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
      </div>

      <div className="space-y-1">
        {rows.map(([label, value, kind]) => (
          <div key={label} className="flex justify-between text-sm">
            <span className="text-muted-foreground">{label}</span>
            <span
              className={`tabular-nums ${
                kind === "sub" ? "text-success" : "font-medium"
              }`}
            >
              {kind === "sub" ? "−" : ""}
              {money(value)}
            </span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-2 border-t pt-2">
        <Metric label="Total sell" value={money(pricing.totalSell)} />
        <Metric label="Total cost" value={money(pricing.totalCost)} />
        <Metric
          label="Margin"
          value={`${pricing.marginPercent.toFixed(1)}%`}
          accent
        />
      </div>

      {pricing.qty > 1 && (
        <p className="text-xs text-muted-foreground">
          Unit sell {money(pricing.unitSell)} × {pricing.qty}.
        </p>
      )}
    </div>
  );
}

function Metric({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-md bg-muted/40 px-2 py-1.5 text-center">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-sm font-semibold tabular-nums ${accent ? "text-primary" : ""}`}>
        {value}
      </p>
    </div>
  );
}
