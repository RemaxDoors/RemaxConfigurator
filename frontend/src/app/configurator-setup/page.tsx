"use client";

import * as React from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Download,
  FileDown,
  Info,
  Loader2,
  Pencil,
  Plus,
  Save,
  Trash2,
  Upload,
} from "lucide-react";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ParameterEditorDialog } from "@/components/admin/parameter-editor-dialog";
import { RuleEditorDialog } from "@/components/admin/rule-editor-dialog";
import {
  ImportReportDialog,
  type ImportReport,
} from "@/components/admin/import-report-dialog";
import {
  ImportConfirmDialog,
  type ImportPlan,
} from "@/components/admin/import-confirm-dialog";
import { CsvInstructions } from "@/components/admin/csv-instructions";
import { ConfiguratorOverview } from "@/components/admin/configurator-overview";
import { ConfiguratorCreateDialog } from "@/components/admin/configurator-create-dialog";
import { fetchConfigData } from "@/lib/config-data";
import {
  saveParameterToDb,
  deleteParameterFromDb,
  replaceParametersInDb,
  replaceDefaultsInDb,
  replaceRulesInDb,
  createConfigurator,
  type NewConfigurator,
} from "@/lib/config-admin";
import { downloadCsv } from "@/lib/csv";
import {
  parametersToCsv,
  parseParameterCsv,
  PARAM_TEMPLATE_CSV,
} from "@/lib/param-csv";
import { rulesToCsv, parseRuleCsv, RULE_TEMPLATE_CSV } from "@/lib/rule-csv";
import {
  defaultsToCsv,
  parseDefaultCsv,
  DEFAULT_TEMPLATE_CSV,
} from "@/lib/default-csv";
import {
  PARAMETER_KIND_LABELS,
  type Configurator,
  type ConfiguratorParameter,
} from "@/types/configurator";
import {
  RULE_CATEGORY_LABELS,
  describeConditions,
  type ConfiguratorRule,
  type RuleCategory,
} from "@/types/configurator-rule";

const SELECT_CLASS =
  "flex h-10 w-72 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

function categoryVariant(
  category: RuleCategory
): "default" | "secondary" | "outline" {
  if (category === "MATERIAL_DISCOUNT") return "outline";
  if (category === "BASE" || category === "INSTALLATION") return "secondary";
  return "default";
}

function rangeSummary(p: ConfiguratorParameter): string {
  if (p.kind === "dropdown") return `${p.options?.length ?? 0} options`;
  if (p.kind === "number") {
    const min = p.min ?? "–";
    const max = p.max ?? "–";
    return `${min} – ${max}`;
  }
  return "—";
}

export default function ConfiguratorSetupPage() {
  const [configurators, setConfigurators] =
    React.useState<Configurator[]>([]);
  const [rules, setRules] = React.useState<ConfiguratorRule[]>([]);
  const [configuratorId, setConfiguratorId] = React.useState("");
  const [source, setSource] = React.useState<"unavailable" | "api">("unavailable");
  const [configError, setConfigError] = React.useState<string | null>(null);
  const [tab, setTab] = React.useState("overview");
  const [saveNotice, setSaveNotice] = React.useState<{
    kind: "ok" | "error";
    text: string;
  } | null>(null);

  // Load configurators + rules from the Python API. There is no fallback:
  // if this fails the screen stays empty and says why, rather than showing
  // a stand-in configurator that nobody should be editing.
  const reloadConfig = React.useCallback(async () => {
    const data = await fetchConfigData();
    setSource(data.source);
    setConfigError(data.error ?? null);
    if (!data.configurators?.length) return;
    setConfigurators(data.configurators);
    setConfiguratorId((prev) =>
      data.configurators.some((c) => c.id === prev)
        ? prev
        : data.configurators[0].id
    );
  }, []);

  React.useEffect(() => {
    let active = true;
    fetchConfigData()
      .then((data) => {
        if (!active) return;
        setSource(data.source);
        setConfigError(data.error ?? null);
        if (!data.configurators?.length) return;
        setConfigurators(data.configurators);
        setRules(data.rules ?? []);
        setConfiguratorId((prev) =>
          data.configurators.some((c) => c.id === prev)
            ? prev
            : data.configurators[0].id
        );
      })
      .catch(() => active && setConfigError("Could not reach the config API."));
    return () => {
      active = false;
    };
  }, []);

  // CSV import: hidden file inputs + result dialog.
  const paramFileRef = React.useRef<HTMLInputElement>(null);
  const ruleFileRef = React.useRef<HTMLInputElement>(null);
  const defaultFileRef = React.useRef<HTMLInputElement>(null);
  const [report, setReport] = React.useState<ImportReport | null>(null);
  const [reportOpen, setReportOpen] = React.useState(false);
  const [confirmPlan, setConfirmPlan] = React.useState<ImportPlan | null>(null);
  const confirmResolve = React.useRef<((ok: boolean) => void) | null>(null);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [defaultModel, setDefaultModel] = React.useState("");
  const [paramSection, setParamSection] = React.useState("");
  const [rulesStatus, setRulesStatus] = React.useState<{
    kind: "ok" | "error" | "saving";
    text: string;
  } | null>(null);

  const [paramEditorOpen, setParamEditorOpen] = React.useState(false);
  const [editingParam, setEditingParam] =
    React.useState<ConfiguratorParameter | null>(null);

  const [ruleEditorOpen, setRuleEditorOpen] = React.useState(false);
  const [editingRule, setEditingRule] = React.useState<ConfiguratorRule | null>(
    null
  );

  const selected = configurators.find((c) => c.id === configuratorId);
  const parameters = selected?.parameters ?? [];
  const controlNames = parameters.map((p) => p.controlName);
  const sectionNames = Array.from(
    new Set(parameters.map((p) => p.section).filter(Boolean))
  ) as string[];
  const shownParameters = paramSection
    ? parameters.filter((p) => (p.section ?? "") === paramSection)
    : parameters;

  // How many rules reference each control name (shown on the parameter cards).
  const ruleCountByControl = React.useMemo(() => {
    const counts = new Map<string, number>();
    for (const rule of rules) {
      if (rule.configuratorId !== configuratorId) continue;
      const seen = new Set<string>();
      for (const c of rule.conditions) {
        const key = c.controlName.toUpperCase();
        if (seen.has(key)) continue;
        seen.add(key);
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
    }
    return counts;
  }, [rules, configuratorId]);
  const visibleRules = rules.filter((r) => r.configuratorId === configuratorId);
  const defaults = selected?.defaults ?? [];
  // A null door model means the row is conditional or manual, not per-model.
  const ALL_MODELS = "(all models)";
  const defaultModels = Array.from(
    new Set(defaults.map((d) => d.doorModel ?? ALL_MODELS))
  ).sort();
  const shownDefaults = defaultModel
    ? defaults.filter((d) => (d.doorModel ?? ALL_MODELS) === defaultModel)
    : defaults;

  // ---- parameter handlers ----
  const saveParameter = async (param: ConfiguratorParameter) => {
    // optimistic local update
    setConfigurators((prev) =>
      prev.map((c) => {
        if (c.id !== configuratorId) return c;
        const exists = c.parameters.some(
          (p) => p.controlName === param.controlName
        );
        return {
          ...c,
          parameters: exists
            ? c.parameters.map((p) =>
                p.controlName === param.controlName ? param : p
              )
            : [...c.parameters, param],
        };
      })
    );
    // persist to the config DB (only when served by the API)
    if (source !== "api") {
      setSaveNotice({
        kind: "error",
        text: "Not connected to the API — changes are local only. Start the Python API to save.",
      });
      return;
    }
    try {
      await saveParameterToDb(configuratorId, param);
      setSaveNotice({ kind: "ok", text: `Saved “${param.label}” to the config DB.` });
    } catch (err) {
      setSaveNotice({
        kind: "error",
        text: err instanceof Error ? err.message : "Save failed.",
      });
    }
  };

  const deleteParameter = async (controlName: string) => {
    setConfigurators((prev) =>
      prev.map((c) =>
        c.id === configuratorId
          ? {
              ...c,
              parameters: c.parameters.filter(
                (p) => p.controlName !== controlName
              ),
            }
          : c
      )
    );
    if (source !== "api") return;
    try {
      await deleteParameterFromDb(configuratorId, controlName);
      setSaveNotice({ kind: "ok", text: `Deleted “${controlName}”.` });
    } catch (err) {
      setSaveNotice({
        kind: "error",
        text: err instanceof Error ? err.message : "Delete failed.",
      });
    }
  };

  // ---- rule handlers (each change is saved to the config DB) ----
  /** Persist the rule set for the current configurator. */
  const persistRules = React.useCallback(
    async (next: ConfiguratorRule[]) => {
      if (!configuratorId) return;
      if (source !== "api") {
        setRulesStatus({
          kind: "error",
          text: "Not connected to the API — rules are NOT saved. Start the Python API.",
        });
        return;
      }
      setRulesStatus({ kind: "saving", text: "Saving rules…" });
      try {
        const mine = next.filter((r) => r.configuratorId === configuratorId);
        const res = await replaceRulesInDb(configuratorId, mine);
        setRulesStatus({
          kind: "ok",
          text: `Saved ${res.inserted} rule${res.inserted === 1 ? "" : "s"} to the database.`,
        });
      } catch (err) {
        setRulesStatus({
          kind: "error",
          text: err instanceof Error ? err.message : "Rule save failed.",
        });
      }
    },
    [configuratorId, source]
  );

  /** Apply a change to the rule list and immediately save it. */
  const applyRules = (updater: (prev: ConfiguratorRule[]) => ConfiguratorRule[]) => {
    setRules((prev) => {
      const next = updater(prev);
      void persistRules(next);
      return next;
    });
  };

  const saveRule = (rule: ConfiguratorRule) =>
    applyRules((prev) =>
      prev.some((r) => r.id === rule.id)
        ? prev.map((r) => (r.id === rule.id ? rule : r))
        : [...prev, rule]
    );

  const deleteRule = (id: string) =>
    applyRules((prev) => prev.filter((r) => r.id !== id));

  const toggleActive = (id: string) =>
    applyRules((prev) =>
      prev.map((r) => (r.id === id ? { ...r, isActive: !r.isActive } : r))
    );

  // ---- CSV export / import ----
  const slug = (configuratorId || "configurator").toLowerCase();

  const exportParameters = () =>
    downloadCsv(`${slug}-parameters.csv`, parametersToCsv(parameters));

  const exportRules = () =>
    downloadCsv(`${slug}-rules.csv`, rulesToCsv(visibleRules));

  const exportDefaults = () =>
    downloadCsv(`${slug}-defaults.csv`, defaultsToCsv(defaults));

  const showReport = (r: ImportReport) => {
    setReport(r);
    setReportOpen(true);
  };

  /**
   * Show what an import would delete and wait for a yes. Every CSV import is a
   * whole-set replace, so a short "patch" file silently wipes everything it
   * omits — this is the guard against that.
   */
  const confirmImport = (plan: ImportPlan) =>
    new Promise<boolean>((resolve) => {
      if (plan.removing.length === 0) {
        resolve(true);
        return;
      }
      setConfirmPlan(plan);
      confirmResolve.current = resolve;
    });

  const importDefaults = async (file: File) => {
    const text = await file.text();
    const parsed = parseDefaultCsv(text);
    if (parsed.columnError) {
      showReport({
        title: "Import defaults",
        columnError: parsed.columnError,
        imported: 0,
        deleted: 0,
        errors: [],
      });
      return;
    }
    if (source !== "api") {
      showReport({
        title: "Import defaults",
        columnError:
          "Not connected to the API — defaults can only be imported when the Python API is running.",
        imported: 0,
        deleted: 0,
        errors: parsed.errors,
      });
      return;
    }
    const keepDef = new Set(
      parsed.valid.map((d) => `${d.doorModel}|${d.controlName}`.toUpperCase())
    );
    const removingDefaults = defaults
      .filter(
        (d) =>
          !keepDef.has(`${d.doorModel ?? ""}|${d.controlName}`.toUpperCase())
      )
      .map(
        (d) =>
          `${d.doorModel ?? ALL_MODELS} · ${d.controlName} = ${d.value}` +
          (d.doorModel ? "" : "   (conditional/manual — not in the file)")
      );
    const okDefaults = await confirmImport({
      noun: "defaults",
      keeping: parsed.valid.length,
      removing: removingDefaults,
    });
    if (!okDefaults) return;
    try {
      const result = await replaceDefaultsInDb(configuratorId, parsed.valid);
      await reloadConfig();
      showReport({
        title: "Import defaults",
        imported: result.inserted,
        deleted: result.deleted,
        errors: parsed.errors,
      });
    } catch (err) {
      showReport({
        title: "Import defaults",
        columnError: err instanceof Error ? err.message : "Import failed.",
        imported: 0,
        deleted: 0,
        errors: parsed.errors,
      });
    }
  };

  const importParameters = async (file: File) => {
    const text = await file.text();
    const parsed = parseParameterCsv(text);
    if (parsed.columnError) {
      showReport({
        title: "Import parameters",
        columnError: parsed.columnError,
        imported: 0,
        deleted: 0,
        errors: [],
      });
      return;
    }
    if (source !== "api") {
      showReport({
        title: "Import parameters",
        columnError:
          "Not connected to the API — parameters can only be imported when the Python API is running.",
        imported: 0,
        deleted: 0,
        errors: parsed.errors,
      });
      return;
    }
    const keep = new Set(parsed.valid.map((p) => p.controlName.toUpperCase()));
    const removing = parameters
      .filter((p) => !keep.has(p.controlName.toUpperCase()))
      .map((p) => `${p.controlName}  (${p.label})`);
    const ok = await confirmImport({
      noun: "parameters",
      keeping: parsed.valid.length,
      removing,
      knockOn: [
        "Their dropdown options are deleted too.",
        "Rules, defaults and validations that mention these fields are kept, but will stop matching until the field exists again.",
      ],
    });
    if (!ok) return;
    try {
      const result = await replaceParametersInDb(configuratorId, parsed.valid);
      await reloadConfig();
      showReport({
        title: "Import parameters",
        imported: result.applied,
        deleted: result.deleted,
        errors: parsed.errors,
      });
    } catch (err) {
      showReport({
        title: "Import parameters",
        columnError: err instanceof Error ? err.message : "Import failed.",
        imported: 0,
        deleted: 0,
        errors: parsed.errors,
      });
    }
  };

  const importRules = async (file: File) => {
    const text = await file.text();
    const parsed = parseRuleCsv(text);
    if (parsed.columnError) {
      showReport({
        title: "Import rules",
        columnError: parsed.columnError,
        imported: 0,
        deleted: 0,
        errors: [],
      });
      return;
    }
    // Replace the set for this configurator, preserving anything the file
    // leaves out when a rule id matches. The save below writes it to the DB.
    const existingById = new Map(visibleRules.map((r) => [r.id, r]));
    const importedIds = new Set(parsed.valid.map((r) => r.id));
    const removingRules = visibleRules.filter((r) => !importedIds.has(r.id));
    const deleted = removingRules.length;
    const okRules = await confirmImport({
      noun: "rules",
      keeping: parsed.valid.length,
      removing: removingRules.map((r) => `${r.id}  ${r.name}`),
      knockOn: ["Their conditions are deleted with them."],
    });
    if (!okRules) return;
    const nextForConfig: ConfiguratorRule[] = parsed.valid.map((r) => {
      const existing = existingById.get(r.id);
      return {
        id: r.id,
        configuratorId,
        name: r.name,
        category: r.category,
        // Prefer conditions parsed from the "When" column; otherwise keep the
        // existing rule's conditions (so a condition-less re-import won't wipe them).
        conditions: r.conditions.length ? r.conditions : existing?.conditions ?? [],
        resultPartId: r.resultPartId,
        quantity: r.quantity,
        isActive: r.isActive,
        // Optional columns: keep the existing value when the file omits one.
        resultRevision: r.resultRevision ?? existing?.resultRevision,
        quantityUnit: r.quantityUnit ?? existing?.quantityUnit,
        quantityFormula: r.quantityFormula ?? existing?.quantityFormula,
        conditionFormula: r.conditionFormula ?? existing?.conditionFormula,
        notes: r.notes ?? existing?.notes,
      };
    });
    const next = [
      ...rules.filter((r) => r.configuratorId !== configuratorId),
      ...nextForConfig,
    ];
    setRules(next);

    // Persist immediately — an import that only lives in state is lost on refresh.
    let saveError: string | null = null;
    if (source === "api") {
      try {
        await replaceRulesInDb(configuratorId, nextForConfig);
        setRulesStatus({
          kind: "ok",
          text: `Saved ${nextForConfig.length} rules to the database.`,
        });
      } catch (err) {
        saveError = err instanceof Error ? err.message : "Rule save failed.";
        setRulesStatus({ kind: "error", text: saveError });
      }
    } else {
      saveError =
        "Not connected to the API — rules were NOT saved to the database.";
      setRulesStatus({ kind: "error", text: saveError });
    }

    showReport({
      title: "Import rules",
      columnError: saveError ?? undefined,
      imported: parsed.valid.length,
      deleted,
      errors: parsed.errors,
    });
  };

  const onFileChosen = (
    e: React.ChangeEvent<HTMLInputElement>,
    handler: (file: File) => void
  ) => {
    const file = e.target.files?.[0];
    if (file) handler(file);
    e.target.value = ""; // allow re-importing the same file
  };

  const handleCreateConfigurator = async (input: NewConfigurator) => {
    await createConfigurator(input);
    await reloadConfig();
    setConfiguratorId(input.partId);
    setSaveNotice({ kind: "ok", text: `Created configurator “${input.name}”.` });
  };

  return (
    <div className="container space-y-6 py-6">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href="/">Home</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Configurator Setup</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold tracking-tight">
            Configurator Setup
          </h1>
          <Badge variant={source === "api" ? "success" : "destructive"}>
            {source === "api" ? "Source: Python API" : "Config API unavailable"}
          </Badge>
        </div>
        <p className="text-muted-foreground">
          Define the parameters and rules for each of the 7 configurators.
        </p>
      </div>

      {configError && (
        <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          <div>
            <p className="font-medium">Configuration could not be loaded.</p>
            <p className="text-muted-foreground">{configError}</p>
            <p className="mt-1 text-muted-foreground">
              Nothing is shown and nothing can be saved until this is fixed —
              there is no offline copy of the configurator to fall back on.
            </p>
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 rounded-md border border-primary/30 bg-primary/5 px-4 py-3 text-sm">
        <Info className="h-4 w-4 shrink-0 text-primary" />
        <span>
          Parameters are the inputs shown in the configurator; rules connect a
          parameter selection to a part. Parameter edits save to the config DB
          when connected to the API. Rules and admin-only access still come with
          later backend work and Microsoft sign-in.
        </span>
      </div>

      <CsvInstructions />

      {saveNotice && (
        <div
          className={`flex items-center gap-2 rounded-md border px-4 py-3 text-sm ${
            saveNotice.kind === "ok"
              ? "border-green-600/30 bg-green-600/5 text-green-700 dark:text-green-400"
              : "border-destructive/40 bg-destructive/5 text-destructive"
          }`}
        >
          <Info className="h-4 w-4 shrink-0" />
          <span>{saveNotice.text}</span>
          <button
            type="button"
            className="ml-auto opacity-70 hover:opacity-100"
            onClick={() => setSaveNotice(null)}
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      )}

      <div className="flex items-center gap-3">
        <label htmlFor="configurator" className="text-sm font-medium">
          Configurator
        </label>
        <select
          id="configurator"
          className={SELECT_CLASS}
          value={configuratorId}
          onChange={(e) => setConfiguratorId(e.target.value)}
        >
          {configurators.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        {selected?.doorTypeFilter && (
          <Badge variant="secondary">Door type: {selected.doorTypeFilter}</Badge>
        )}
        <Button
          variant="outline"
          className="ml-auto"
          onClick={() => setCreateOpen(true)}
        >
          <Plus className="h-4 w-4" />
          New configurator
        </Button>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="parameters">
            Parameters ({parameters.length})
          </TabsTrigger>
          <TabsTrigger value="rules">Rules ({visibleRules.length})</TabsTrigger>
          <TabsTrigger value="defaults">Defaults ({defaults.length})</TabsTrigger>
        </TabsList>

        {/* ---------------- Overview ---------------- */}
        <TabsContent value="overview">
          <ConfiguratorOverview
            configurator={selected}
            parameters={parameters}
            rules={visibleRules}
            defaultsCount={defaults.length}
            onLayoutSaved={reloadConfig}
          />
        </TabsContent>

        {/* ---------------- Parameters ---------------- */}
        <TabsContent value="parameters" className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            {sectionNames.length > 0 && (
              <>
                <span className="text-sm text-muted-foreground">Section</span>
                <select
                  className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                  value={paramSection}
                  onChange={(e) => setParamSection(e.target.value)}
                >
                  <option value="">All ({parameters.length})</option>
                  {sectionNames.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </>
            )}
            <input
              ref={paramFileRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => onFileChosen(e, importParameters)}
            />
            <div className="ml-auto" />
            <Button
              variant="ghost"
              onClick={() =>
                downloadCsv("parameters-template.csv", PARAM_TEMPLATE_CSV)
              }
            >
              <FileDown className="h-4 w-4" />
              Template
            </Button>
            <Button variant="outline" onClick={exportParameters}>
              <Download className="h-4 w-4" />
              Export CSV
            </Button>
            <Button
              variant="outline"
              onClick={() => paramFileRef.current?.click()}
            >
              <Upload className="h-4 w-4" />
              Import CSV
            </Button>
            <Button
              onClick={() => {
                setEditingParam(null);
                setParamEditorOpen(true);
              }}
            >
              <Plus className="h-4 w-4" />
              Add parameter
            </Button>
          </div>
          {shownParameters.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                No parameters {paramSection ? "in this section" : "yet"}.
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {shownParameters.map((p) => {
                const usedBy = ruleCountByControl.get(
                  p.controlName.toUpperCase()
                );
                return (
                  <div
                    key={p.controlName}
                    className="group rounded-lg border p-3 transition-colors hover:border-primary/40"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{p.label}</p>
                        <code className="block truncate font-mono text-xs text-muted-foreground">
                          {p.controlName}
                        </code>
                      </div>
                      <div className="flex shrink-0 gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => {
                            setEditingParam(p);
                            setParamEditorOpen(true);
                          }}
                          aria-label="Edit parameter"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => deleteParameter(p.controlName)}
                          aria-label="Delete parameter"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-1">
                      <Badge variant="secondary">
                        {PARAMETER_KIND_LABELS[p.kind]}
                      </Badge>
                      {p.section && <Badge variant="outline">{p.section}</Badge>}
                      {p.required && <Badge>Required</Badge>}
                      {usedBy ? (
                        <Badge variant="outline" className="border-primary/40">
                          {usedBy} rule{usedBy === 1 ? "" : "s"}
                        </Badge>
                      ) : null}
                    </div>
                    <p className="mt-1.5 text-xs text-muted-foreground">
                      {rangeSummary(p)}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* ---------------- Rules ---------------- */}
        <TabsContent value="rules" className="space-y-3">
          {rulesStatus && (
            <div
              className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm ${
                rulesStatus.kind === "ok"
                  ? "border-green-600/30 bg-green-600/5 text-green-700 dark:text-green-400"
                  : rulesStatus.kind === "saving"
                    ? "text-muted-foreground"
                    : "border-destructive/40 bg-destructive/5 text-destructive"
              }`}
            >
              {rulesStatus.kind === "saving" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Info className="h-4 w-4 shrink-0" />
              )}
              <span>{rulesStatus.text}</span>
            </div>
          )}
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => persistRules(rules)}
              disabled={rulesStatus?.kind === "saving"}
            >
              <Save className="h-4 w-4" />
              Save rules
            </Button>
            <input
              ref={ruleFileRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => onFileChosen(e, importRules)}
            />
            <Button
              variant="ghost"
              onClick={() => downloadCsv("rules-template.csv", RULE_TEMPLATE_CSV)}
            >
              <FileDown className="h-4 w-4" />
              Template
            </Button>
            <Button variant="outline" onClick={exportRules}>
              <Download className="h-4 w-4" />
              Export CSV
            </Button>
            <Button
              variant="outline"
              onClick={() => ruleFileRef.current?.click()}
            >
              <Upload className="h-4 w-4" />
              Import CSV
            </Button>
            <Button
              onClick={() => {
                setEditingRule(null);
                setRuleEditorOpen(true);
              }}
            >
              <Plus className="h-4 w-4" />
              Add rule
            </Button>
          </div>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Rule</TableHead>
                    <TableHead>When</TableHead>
                    <TableHead>Adds part</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-center">Active</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleRules.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={7}
                        className="py-10 text-center text-muted-foreground"
                      >
                        No rules for this configurator yet. Click “Add rule”.
                      </TableCell>
                    </TableRow>
                  ) : (
                    visibleRules.map((rule) => (
                      <TableRow key={rule.id}>
                        <TableCell className="font-medium">{rule.name}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {describeConditions(rule.conditions)}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {rule.resultPartId}
                        </TableCell>
                        <TableCell>
                          <Badge variant={categoryVariant(rule.category)}>
                            {RULE_CATEGORY_LABELS[rule.category]}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {rule.quantity}
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex justify-center">
                            <Switch
                              checked={rule.isActive}
                              onCheckedChange={() => toggleActive(rule.id)}
                              aria-label={`Toggle ${rule.name}`}
                            />
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setEditingRule(rule);
                                setRuleEditorOpen(true);
                              }}
                              aria-label="Edit rule"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive hover:text-destructive"
                              onClick={() => deleteRule(rule.id)}
                              aria-label="Delete rule"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ---------------- Defaults ---------------- */}
        <TabsContent value="defaults" className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted-foreground">
              When a door model is chosen, these parameters are pre-set.
            </span>
            {defaultModels.length > 0 && (
              <select
                className="ml-2 h-9 rounded-md border border-input bg-background px-2 text-sm"
                value={defaultModel}
                onChange={(e) => setDefaultModel(e.target.value)}
              >
                <option value="">All models ({defaults.length})</option>
                {defaultModels.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            )}
            <div className="ml-auto flex flex-wrap gap-2">
              <input
                ref={defaultFileRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => onFileChosen(e, importDefaults)}
              />
              <Button
                variant="ghost"
                onClick={() =>
                  downloadCsv("defaults-template.csv", DEFAULT_TEMPLATE_CSV)
                }
              >
                <FileDown className="h-4 w-4" />
                Template
              </Button>
              <Button variant="outline" onClick={exportDefaults}>
                <Download className="h-4 w-4" />
                Export CSV
              </Button>
              <Button
                variant="outline"
                onClick={() => defaultFileRef.current?.click()}
              >
                <Upload className="h-4 w-4" />
                Import CSV
              </Button>
            </div>
          </div>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Door Model</TableHead>
                    <TableHead>Parameter</TableHead>
                    <TableHead>Default Value</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {shownDefaults.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={3}
                        className="py-10 text-center text-muted-foreground"
                      >
                        No defaults for this configurator. Import a CSV to add them.
                      </TableCell>
                    </TableRow>
                  ) : (
                    shownDefaults.map((d, i) => (
                      <TableRow key={`${d.doorModel}-${d.controlName}-${i}`}>
                        <TableCell>
                          <Badge variant={d.doorModel ? "secondary" : "outline"}>
                            {d.doorModel ?? ALL_MODELS}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {d.controlName}
                        </TableCell>
                        <TableCell
                          className={
                            d.value ? "font-medium" : "text-muted-foreground"
                          }
                        >
                          {d.value || "— (cleared)"}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <ParameterEditorDialog
        open={paramEditorOpen}
        onOpenChange={setParamEditorOpen}
        parameter={editingParam}
        existingControlNames={controlNames.map((n) => n.toUpperCase())}
        existingSections={sectionNames}
        onSave={saveParameter}
      />

      <RuleEditorDialog
        open={ruleEditorOpen}
        onOpenChange={setRuleEditorOpen}
        configuratorId={configuratorId}
        rule={editingRule}
        controlNames={controlNames}
        parameters={parameters}
        onSave={saveRule}
      />

      <ImportReportDialog
        open={reportOpen}
        onOpenChange={setReportOpen}
        report={report}
      />

      <ImportConfirmDialog
        open={confirmPlan !== null}
        plan={confirmPlan}
        onCancel={() => {
          confirmResolve.current?.(false);
          confirmResolve.current = null;
          setConfirmPlan(null);
        }}
        onConfirm={() => {
          confirmResolve.current?.(true);
          confirmResolve.current = null;
          setConfirmPlan(null);
        }}
      />

      <ConfiguratorCreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        existingIds={configurators.map((c) => c.id)}
        onCreate={handleCreateConfigurator}
      />
    </div>
  );
}
