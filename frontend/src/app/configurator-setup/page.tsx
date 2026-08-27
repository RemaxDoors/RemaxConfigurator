"use client";

import * as React from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Check,
  Copy,
  Download,
  FileDown,
  HelpCircle,
  Info,
  LayoutGrid,
  Loader2,
  Pencil,
  Plus,
  Save,
  Search,
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
import { DeleteParameterDialog } from "@/components/admin/delete-parameter-dialog";
import { DefaultEditorDialog } from "@/components/admin/default-editor-dialog";
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
  fetchParameterUsage,
  type ParameterUsage,
  replaceParametersInDb,
  deleteDefaultFromDb,
  updateConfiguratorInDb,
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
  type ConfiguratorDefault,
  type ConfiguratorParameter,
} from "@/types/configurator";
import {
  RULE_CATEGORY_LABELS,
  describeRuleQuantity,
  describeRuleWhen,
  type ConfiguratorRule,
  type RuleCategory,
} from "@/types/configurator-rule";
import {
  SHOW_UPGRADE_OVERRIDE_FIELD,
  readPref,
  writePref,
} from "@/lib/ui-prefs";

const SELECT_CLASS =
  "flex h-10 w-72 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

/** Tabs the ?tab= deep link may open. Anything else is ignored. */
const TAB_IDS = ["overview", "parameters", "rules", "defaults"];

/**
 * Next free rule code, in the style the configurator already uses.
 *
 * uCfgRules.RuleCode is NVARCHAR(30) and these codes are how a rule is referred
 * to in the M1 workbooks and in conversation ("RRD-13 is wrong"), so they have
 * to be short and readable. Follows whatever prefix the existing rules use and
 * takes the next number; falls back to the configurator id's first segment for
 * a configurator with no rules yet.
 */
function nextRuleCode(
  configuratorId: string,
  existing: ConfiguratorRule[]
): string {
  const counts = new Map<string, number>();
  let highest = 0;
  for (const r of existing) {
    const m = /^([A-Za-z]+)-(\d+)$/.exec(r.id.trim());
    if (!m) continue;
    counts.set(m[1], (counts.get(m[1]) ?? 0) + 1);
    highest = Math.max(highest, Number(m[2]));
  }
  let prefix = "";
  let best = 0;
  counts.forEach((n, p) => {
    if (n > best) {
      best = n;
      prefix = p;
    }
  });
  if (!prefix) {
    prefix =
      (configuratorId.split("-")[0] || "RULE").toUpperCase().slice(0, 6) ||
      "RULE";
  }
  const taken = new Set(existing.map((r) => r.id.toUpperCase()));
  let n = highest + 1;
  // Codes can be edited by hand and imported from CSV, so the highest number
  // is a starting guess, not a guarantee that the next one is free.
  for (;;) {
    const code = `${prefix}-${String(n).padStart(2, "0")}`;
    if (!taken.has(code.toUpperCase())) return code.slice(0, 30);
    n += 1;
  }
}

/**
 * Search box shared by the three tabs.
 *
 * Shows the match count rather than only filtering, so a search that finds
 * nothing reads as "0 of 51" instead of an empty list that looks like the data
 * failed to load.
 */
function SearchBox({
  value,
  onChange,
  placeholder,
  shown,
  total,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  shown: number;
  total: number;
}) {
  return (
    <div className="flex items-center gap-2">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          aria-label={placeholder}
          className="h-9 w-64 rounded-md border border-input bg-background pl-7 pr-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>
      {value.trim() !== "" && (
        <span className="text-xs text-muted-foreground">
          {shown} of {total}
        </span>
      )}
    </div>
  );
}

/**
 * A free control name for a copy of `controlName`.
 *
 * Trailing digits are incremented, so copying CMBACT1 suggests CMBACT2 rather
 * than CMBACT1_COPY — the numbered groups are the ones most worth copying, and
 * group("CMBACT") only picks up names that end in a number.
 * Anything already taken is skipped, since upsert_parameter() treats a name
 * that exists as an edit and would overwrite it.
 */
function suggestCopyName(controlName: string, taken: string[]): string {
  const used = new Set(taken.map((t) => t.toUpperCase()));
  const m = /^(.*?)(\d+)$/.exec(controlName.trim());
  if (m) {
    const [, stem, digits] = m;
    for (let n = Number(digits) + 1; n < Number(digits) + 50; n += 1) {
      const candidate = `${stem}${n}`;
      if (!used.has(candidate.toUpperCase())) return candidate.slice(0, 50);
    }
  }
  const base = `${controlName.trim()}_COPY`;
  if (!used.has(base.toUpperCase())) return base.slice(0, 50);
  for (let n = 2; n < 50; n += 1) {
    const candidate = `${base}${n}`;
    if (!used.has(candidate.toUpperCase())) return candidate.slice(0, 50);
  }
  return base.slice(0, 50);
}

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
  const [editingDefault, setEditingDefault] =
    React.useState<ConfiguratorDefault | null>(null);
  // Parameter deletion runs through a confirmation that lists what would go
  // with it. `pendingDelete` holds the control name while its usage loads.
  // One search box per tab. Kept separate so switching tabs does not carry a
  // filter across and leave the next list looking mysteriously empty.
  const [paramQuery, setParamQuery] = React.useState("");
  const [ruleQuery, setRuleQuery] = React.useState("");
  const [defaultQuery, setDefaultQuery] = React.useState("");
  // Two-step delete on a defaults row: the first click arms it, the second
  // does it. Cheaper than a dialog for a row that is one value.
  const [armedDefault, setArmedDefault] = React.useState<string | null>(null);
  // Name and revision are edited in place next to the picker. Revision is
  // what M1 puts in the form id — PART-{id}-REV-{revision} — so it has to be
  // visible where the configurator is chosen, not buried in a dialog.
  const [cfgDraft, setCfgDraft] = React.useState<{
    name: string;
    partRevision: string;
  } | null>(null);
  const [cfgSaving, setCfgSaving] = React.useState(false);
  const [pendingDelete, setPendingDelete] = React.useState<string | null>(null);
  const [deleteUsage, setDeleteUsage] = React.useState<ParameterUsage | null>(null);
  const [deleteBusy, setDeleteBusy] = React.useState(false);
  const [deleteError, setDeleteError] = React.useState<string | null>(null);
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

    // Honour ?id= and ?tab= so the catalog can open a specific configurator on
    // a specific tab. Read straight off the URL rather than useSearchParams(),
    // which would force this client page behind a Suspense boundary for no
    // benefit.
    //
    // Done BEFORE the fetch, and outside its success path: which tab is open
    // is a UI concern, and burying it after `if (!data.configurators?.length)
    // return` meant a deep link was silently ignored whenever the config API
    // was unreachable — exactly when someone following a link most needs the
    // page to land where they expected.
    const q =
      typeof window === "undefined"
        ? new URLSearchParams()
        : new URLSearchParams(window.location.search);
    const wanted = q.get("id");
    const wantedTab = q.get("tab");
    if (wantedTab && TAB_IDS.includes(wantedTab)) setTab(wantedTab);

    fetchConfigData()
      .then((data) => {
        if (!active) return;
        setSource(data.source);
        setConfigError(data.error ?? null);
        if (!data.configurators?.length) return;
        setConfigurators(data.configurators);
        setRules(data.rules ?? []);
        setConfiguratorId((prev) => {
          if (wanted && data.configurators.some((c) => c.id === wanted)) {
            return wanted;
          }
          return data.configurators.some((c) => c.id === prev)
            ? prev
            : data.configurators[0].id;
        });
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
  // Seed for a NEW parameter created by Copy. Kept apart from editingParam so
  // the editor stays in create mode and keeps its duplicate-name guard.
  const [seedParam, setSeedParam] =
    React.useState<ConfiguratorParameter | null>(null);

  const [ruleEditorOpen, setRuleEditorOpen] = React.useState(false);
  const [editingRule, setEditingRule] = React.useState<ConfiguratorRule | null>(
    null
  );

  const selected = configurators.find((c) => c.id === configuratorId);
  // Same reason as `defaults` below: the search filter memoises on this, and
  // `?? []` would hand it a fresh array on every render.
  const parameters = React.useMemo(
    () => selected?.parameters ?? [],
    [selected]
  );
  const controlNames = parameters.map((p) => p.controlName);
  const sectionNames = Array.from(
    new Set(parameters.map((p) => p.section).filter(Boolean))
  ) as string[];
  const shownParameters = React.useMemo(() => {
    const bySection = paramSection
      ? parameters.filter((p) => (p.section ?? "") === paramSection)
      : parameters;
    const q = paramQuery.trim().toLowerCase();
    if (!q) return bySection;
    // Matches the label, the control name, the section, and any option value —
    // "IXIO" should find the radar dropdowns, not just a field called IXIO.
    return bySection.filter((p) =>
      [
        p.label,
        p.controlName,
        p.section ?? "",
        ...(p.options ?? []).flatMap((o) => [o.value, o.label]),
      ]
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [parameters, paramSection, paramQuery]);

  // How many rules reference each control name (shown on the parameter cards).
  /**
   * How many rules depend on each parameter.
   *
   * Counts formula references as well as condition rows. A parameter used only
   * inside countStartsWith(group("CMBACT"), ...) has no condition row naming
   * it, so counting rows alone reported zero and made it look safe to delete.
   * This matches what the API's usage check finds, so the card and the delete
   * confirmation cannot disagree.
   */
  const ruleCountByControl = React.useMemo(() => {
    const counts = new Map<string, number>();
    const controls = (selected?.parameters ?? []).map((p) =>
      p.controlName.toUpperCase()
    );
    for (const rule of rules) {
      if (rule.configuratorId !== configuratorId) continue;
      const seen = new Set<string>();
      for (const c of rule.conditions) {
        seen.add(c.controlName.toUpperCase());
      }
      const formulas = [
        rule.conditionFormula,
        rule.quantityFormula,
        rule.resultRevisionFormula,
      ]
        .filter(Boolean)
        .join(" ")
        .toUpperCase();
      if (formulas) {
        for (const name of controls) {
          if (formulas.includes(name)) seen.add(name);
        }
      }
      seen.forEach((key) => {
        counts.set(key, (counts.get(key) ?? 0) + 1);
      });
    }
    return counts;
  }, [rules, configuratorId, selected]);
  const allRulesForCfg = rules.filter((r) => r.configuratorId === configuratorId);
  const visibleRules = React.useMemo(() => {
    const q = ruleQuery.trim().toLowerCase();
    if (!q) return allRulesForCfg;
    // Includes the formulas, so searching a control name finds the rules that
    // only mention it inside countStartsWith(...) as well as the ones with a
    // condition row for it.
    return allRulesForCfg.filter((r) =>
      [
        r.id,
        r.name,
        r.resultPartId ?? "",
        r.category,
        r.notes ?? "",
        r.conditionFormula ?? "",
        r.quantityFormula ?? "",
        r.resultRevisionFormula ?? "",
        ...r.conditions.map((c) => `${c.controlName} ${c.value}`),
      ]
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [allRulesForCfg, ruleQuery]);
  // Memoised because the filtered list below depends on it: `?? []` builds a
  // new array every render, which would defeat the memo entirely.
  const defaults = React.useMemo(
    () => selected?.defaults ?? [],
    [selected]
  );
  // A null door model means the row is conditional or manual, not per-model.
  const ALL_MODELS = "(all models)";
  const defaultModels = Array.from(
    new Set(defaults.map((d) => d.doorModel ?? ALL_MODELS))
  ).sort();
  const shownDefaults = React.useMemo(() => {
    const byModel = defaultModel
      ? defaults.filter((d) => (d.doorModel ?? ALL_MODELS) === defaultModel)
      : defaults;
    const q = defaultQuery.trim().toLowerCase();
    if (!q) return byModel;
    return byModel.filter((d) =>
      [d.controlName, d.doorModel ?? ALL_MODELS, d.value ?? "", d.specName ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [defaults, defaultModel, defaultQuery, ALL_MODELS]);

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

  /**
   * Ask what uses the parameter, then confirm.
   *
   * The previous version removed it from local state first and called the API
   * afterwards, so a refusal still looked like it had worked. Nothing is
   * removed from the screen now until the delete actually succeeds.
   */
  const deleteParameter = async (controlName: string) => {
    setPendingDelete(controlName);
    setDeleteUsage(null);
    setDeleteError(null);
    if (source !== "api") {
      // No API to ask — offer the plain confirmation rather than nothing.
      setDeleteUsage({ controlName, rules: [], validations: [], defaults: [] });
      return;
    }
    try {
      setDeleteUsage(await fetchParameterUsage(configuratorId, controlName));
    } catch (err) {
      setDeleteUsage({ controlName, rules: [], validations: [], defaults: [] });
      setDeleteError(
        err instanceof Error
          ? `Could not check what uses this parameter: ${err.message}`
          : "Could not check what uses this parameter."
      );
    }
  };

  const confirmDeleteParameter = async (cascade: boolean) => {
    const controlName = pendingDelete;
    if (!controlName) return;
    setDeleteBusy(true);
    setDeleteError(null);
    try {
      if (source === "api") {
        await deleteParameterFromDb(configuratorId, controlName, cascade);
      }
      setConfigurators((prev) =>
        prev.map((c) =>
          c.id === configuratorId
            ? {
                ...c,
                parameters: c.parameters.filter(
                  (p) => p.controlName !== controlName
                ),
                defaults: (c.defaults ?? []).filter(
                  (d) => d.controlName !== controlName
                ),
              }
            : c
        )
      );
      if (cascade) {
        const gone = new Set(
          (deleteUsage?.rules ?? []).map((r) => r.ruleCode)
        );
        setRules((prev) => prev.filter((r) => !gone.has(r.id)));
      }
      setPendingDelete(null);
      setDeleteUsage(null);
      setSaveNotice({ kind: "ok", text: `Deleted \u201C${controlName}\u201D.` });
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Delete failed.");
    } finally {
      setDeleteBusy(false);
    }
  };

  /** Key for a default row. A null door model must not become "null". */
  const defaultKey = (d: ConfiguratorDefault) =>
    `${d.doorModel ?? ""}|${d.controlName}`;

  const removeDefault = async (d: ConfiguratorDefault) => {
    try {
      if (source === "api") {
        await deleteDefaultFromDb(configuratorId, d.doorModel, d.controlName);
      }
      setConfigurators((prev) =>
        prev.map((c) =>
          c.id !== configuratorId
            ? c
            : {
                ...c,
                defaults: (c.defaults ?? []).filter(
                  (x) =>
                    !(
                      x.controlName === d.controlName &&
                      (x.doorModel ?? null) === (d.doorModel ?? null)
                    )
                ),
              }
        )
      );
      setSaveNotice({
        kind: "ok",
        text: `Deleted the default for ${d.controlName} on ${d.doorModel ?? "all models"}.`,
      });
    } catch (err) {
      setSaveNotice({
        kind: "error",
        text: err instanceof Error ? err.message : "Delete failed.",
      });
    } finally {
      setArmedDefault(null);
    }
  };

  const saveConfigurator = async () => {
    if (!cfgDraft || !selected) return;
    setCfgSaving(true);
    try {
      const res = await updateConfiguratorInDb(configuratorId, {
        name: cfgDraft.name,
        // Sent even when empty: clearing the revision is a real edit, and M1
        // has two configurators whose form ids end in "REV-".
        partRevision: cfgDraft.partRevision,
      });
      setConfigurators((prev) =>
        prev.map((c) =>
          c.id === configuratorId
            ? { ...c, name: cfgDraft.name, partRevision: res.partRevision }
            : c
        )
      );
      setCfgDraft(null);
      setSaveNotice({ kind: "ok", text: `Saved. Form id: ${res.formId}` });
    } catch (err) {
      setSaveNotice({
        kind: "error",
        text: err instanceof Error ? err.message : "Save failed.",
      });
    } finally {
      setCfgSaving(false);
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
        // The API saves each rule in its own savepoint and reports the ones it
        // could not save inside a 200. Reporting only `inserted` turned a
        // rejected rule into a success message and a silently missing rule.
        const skipped = res.skipped ?? [];
        if (skipped.length > 0) {
          setRulesStatus({
            kind: "error",
            text:
              `Saved ${res.inserted}, but the database rejected ` +
              `${skipped.length}: ` +
              skipped.map((s) => `${s.id} (${s.reason})`).join("; "),
          });
        } else {
          setRulesStatus({
            kind: "ok",
            text: `Saved ${res.inserted} rule${res.inserted === 1 ? "" : "s"} to the database.`,
          });
        }
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

  const saveRule = (rule: ConfiguratorRule) => {
    const withCode = rule.id
      ? rule
      : { ...rule, id: nextRuleCode(configuratorId, visibleRules) };
    applyRules((prev) =>
      prev.some((r) => r.id === withCode.id)
        ? prev.map((r) => (r.id === withCode.id ? withCode : r))
        : [...prev, withCode]
    );
  };

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
          onClick={() =>
            cfgDraft
              ? setCfgDraft(null)
              : setCfgDraft({
                  name: selected?.name ?? "",
                  partRevision: selected?.partRevision ?? "",
                })
          }
        >
          <Pencil className="h-4 w-4" />
          {cfgDraft ? "Cancel" : "Edit"}
        </Button>
        <Button variant="ghost" className="ml-auto" asChild>
          <Link href="/configurator-setup/help">
            <HelpCircle className="h-4 w-4" />
            Formula help
          </Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/configurators">
            <LayoutGrid className="h-4 w-4" />
            Catalog
          </Link>
        </Button>
        <Button variant="outline" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" />
          New configurator
        </Button>
      </div>

      <ShowOverrideFieldToggle />

      {cfgDraft && (
        <div className="flex flex-wrap items-end gap-3 rounded-md border p-3">
          <div className="space-y-1.5">
            <label htmlFor="cfg-name" className="text-sm font-medium">
              Configurator name
            </label>
            <input
              id="cfg-name"
              value={cfgDraft.name}
              maxLength={50}
              onChange={(e) =>
                setCfgDraft({ ...cfgDraft, name: e.target.value })
              }
              className="flex h-10 w-72 rounded-md border border-input bg-background px-3 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="cfg-rev" className="text-sm font-medium">
              Revision ID
            </label>
            <input
              id="cfg-rev"
              value={cfgDraft.partRevision}
              maxLength={5}
              placeholder="e.g. BOM"
              onChange={(e) =>
                setCfgDraft({ ...cfgDraft, partRevision: e.target.value })
              }
              className="flex h-10 w-28 rounded-md border border-input bg-background px-3 font-mono text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <span className="block text-sm font-medium">M1 form id</span>
            {/* Shown live, because this is the whole reason the field exists:
                the id has to match what M1 already holds in FormInputValues. */}
            <code className="block rounded bg-muted px-2 py-2 font-mono text-xs">
              PART-{configuratorId}-REV-{cfgDraft.partRevision}
            </code>
          </div>
          <Button onClick={saveConfigurator} disabled={cfgSaving}>
            {cfgSaving && <Loader2 className="h-4 w-4 animate-spin" />}
            <Save className="h-4 w-4" />
            Save
          </Button>
          <p className="w-full text-xs text-muted-foreground">
            Revision is M1&apos;s PartRevision, max 5 characters. It can be
            blank — curtain and installation both have an empty revision, so
            their form ids end in <code className="font-mono">REV-</code>. The
            configurator id itself is not editable: every rule, parameter and
            default keys off it.
          </p>
        </div>
      )}

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
            <SearchBox
              value={paramQuery}
              onChange={setParamQuery}
              placeholder="Search parameters, options…"
              shown={shownParameters.length}
              total={parameters.length}
            />
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
                setSeedParam(null);
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
                            setSeedParam(null);
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
                          className="h-7 w-7"
                          onClick={() => {
                            // Everything but the name, which must be free —
                            // the editor treats an existing name as an edit.
                            setEditingParam(null);
                            setSeedParam({
                              ...structuredClone(p),
                              controlName: suggestCopyName(
                                p.controlName,
                                controlNames
                              ),
                              label: `${p.label} (copy)`,
                            });
                            setParamEditorOpen(true);
                          }}
                          aria-label={`Copy ${p.controlName}`}
                          title="Copy this parameter"
                        >
                          <Copy className="h-3.5 w-3.5" />
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
          <SearchBox
            value={ruleQuery}
            onChange={setRuleQuery}
            placeholder="Search rules, parts, formulas…"
            shown={visibleRules.length}
            total={allRulesForCfg.length}
          />
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
                        <TableCell className="max-w-[22rem] text-muted-foreground">
                          <span
                            className="block truncate"
                            title={describeRuleWhen(rule)}
                          >
                            {describeRuleWhen(rule)}
                          </span>
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {rule.resultPartId}
                        </TableCell>
                        <TableCell>
                          <Badge variant={categoryVariant(rule.category)}>
                            {RULE_CATEGORY_LABELS[rule.category]}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-[16rem] text-right tabular-nums">
                          <span
                            className="block truncate"
                            title={describeRuleQuantity(rule)}
                          >
                            {describeRuleQuantity(rule)}
                          </span>
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
                              onClick={() => {
                                // A blank id is what marks this as new: the
                                // page assigns the next free code on save, so
                                // the copy cannot land on the original's code
                                // and overwrite it through replace_rules().
                                setEditingRule({
                                  ...structuredClone(rule),
                                  id: "",
                                  name: `${rule.name} (copy)`,
                                });
                                setRuleEditorOpen(true);
                              }}
                              aria-label={`Copy rule ${rule.id}`}
                              title="Copy this rule"
                            >
                              <Copy className="h-4 w-4" />
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
            <SearchBox
              value={defaultQuery}
              onChange={setDefaultQuery}
              placeholder="Search defaults, specifications…"
              shown={shownDefaults.length}
              total={defaults.length}
            />
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
                    <TableHead>Specification</TableHead>
                    <TableHead>Parameter</TableHead>
                    <TableHead>Default Value</TableHead>
                    <TableHead className="w-[1%] text-right">Edit</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {shownDefaults.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={5}
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
                        <TableCell className="text-xs text-muted-foreground">
                          {d.specName ?? "—"}
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
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setEditingDefault(d)}
                            aria-label={`Edit default for ${d.controlName}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:text-destructive"
                            onClick={() =>
                              armedDefault === defaultKey(d)
                                ? removeDefault(d)
                                : setArmedDefault(defaultKey(d))
                            }
                            onBlur={() =>
                              armedDefault === defaultKey(d) &&
                              setArmedDefault(null)
                            }
                            aria-label={
                              armedDefault === defaultKey(d)
                                ? `Confirm delete of the default for ${d.controlName}`
                                : `Delete the default for ${d.controlName}`
                            }
                            title={
                              armedDefault === defaultKey(d)
                                ? "Click again to delete"
                                : "Delete this default"
                            }
                          >
                            {armedDefault === defaultKey(d) ? (
                              <Check className="h-4 w-4" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </Button>
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
        seed={seedParam}
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

      <DeleteParameterDialog
        open={pendingDelete !== null}
        onOpenChange={(o) => {
          if (!o) {
            setPendingDelete(null);
            setDeleteUsage(null);
            setDeleteError(null);
          }
        }}
        usage={deleteUsage}
        busy={deleteBusy}
        error={deleteError}
        onConfirm={confirmDeleteParameter}
      />

      <DefaultEditorDialog
        open={editingDefault !== null}
        onOpenChange={(o) => !o && setEditingDefault(null)}
        configuratorId={configuratorId}
        value={editingDefault}
        parameters={parameters}
        allDefaults={defaults}
        onSaved={(updated, movedFrom) => {
          // Rows are identified by door model + control name, and a null
          // model must match a null rather than the string "null". After a
          // move the row is found by where it WAS, not where it now is.
          setConfigurators((prev) =>
            prev.map((c) =>
              c.id !== configuratorId
                ? c
                : {
                    ...c,
                    defaults: (c.defaults ?? []).map((d) =>
                      d.controlName === updated.controlName &&
                      (d.doorModel ?? null) ===
                        (movedFrom !== null ? movedFrom : updated.doorModel)
                        ? updated
                        : d
                    ),
                  }
            )
          );
          setSaveNotice({
            kind: "ok",
            text: movedFrom
              ? `Moved ${updated.controlName} to ${updated.doorModel ?? "all models"}.`
              : `Default for ${updated.controlName} saved.`,
          });
        }}
        onDeleted={(removed) => {
          setConfigurators((prev) =>
            prev.map((c) =>
              c.id !== configuratorId
                ? c
                : {
                    ...c,
                    defaults: (c.defaults ?? []).filter(
                      (d) =>
                        !(
                          d.controlName === removed.controlName &&
                          (d.doorModel ?? null) === (removed.doorModel ?? null)
                        )
                    ),
                  }
            )
          );
          setSaveNotice({
            kind: "ok",
            text: `Deleted the default for ${removed.controlName} on ${removed.doorModel ?? "all models"}.`,
          });
        }}
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

/**
 * Show the raw uqmlUpgradeOverridePrices field on the quote summary.
 *
 * Off by default: the field is there to be checked against QuoteLines while
 * the column is being agreed with M1, not to be read every day. It is a view
 * preference stored per browser, so switching it on here does not change what
 * anyone else sees — and it never changes what is written, only whether the
 * value is displayed.
 */
function ShowOverrideFieldToggle() {
  const [on, setOn] = React.useState(false);
  const [ready, setReady] = React.useState(false);

  // Read after mount, not during render: the server has no localStorage, and
  // reading during render would make the markup differ between the two.
  React.useEffect(() => {
    setOn(readPref(SHOW_UPGRADE_OVERRIDE_FIELD, false));
    setReady(true);
  }, []);

  return (
    <label className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
      <input
        type="checkbox"
        className="h-4 w-4"
        checked={on}
        disabled={!ready}
        onChange={(e) => {
          setOn(e.target.checked);
          writePref(SHOW_UPGRADE_OVERRIDE_FIELD, e.target.checked);
        }}
      />
      <span className="font-medium">Show the upgrade override field</span>
      <span className="text-muted-foreground">
        Displays <code className="font-mono text-xs">uqmlUpgradeOverridePrices</code>{" "}
        read-only on the quote summary. This browser only.
      </span>
    </label>
  );
}
