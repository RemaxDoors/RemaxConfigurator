"use client";

import * as React from "react";
import {
  ArrowLeft,
  Blinds,
  Check,
  DoorClosed,
  DoorOpen,
  Loader2,
  Package,
  PackageSearch,
  Search,
  Wrench,
  Zap,
} from "lucide-react";

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
  DOOR_TYPES,
  configuratorFor,
  partIdFor,
  type DoorTypeDef,
  type DoorTypeId,
} from "@/lib/door-types";
import { searchM1Parts, type M1Part } from "@/lib/m1-parts";
import { money } from "@/lib/format";
import { fetchConfigData } from "@/lib/config-data";
import {
  fetchConfiguratorLinks,
  type ConfiguratorLink,
} from "@/lib/configurator-links";
import type { Configurator } from "@/types/configurator";
import type { Door } from "@/types/door";
import type { Part } from "@/types/part";

const SELECT_CLASS =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

const DOOR_ICONS: Record<DoorTypeId, React.ElementType> = {
  RRD: Zap,
  ENTURI: DoorOpen,
  STRIPDOOR: Blinds,
  SWI: DoorClosed,
};

export interface NewLineResult {
  item: Part | Door;
  runCurtain: boolean;
  runInstallation: boolean;
  /** Sub-configurator template ids the user opted into (from uCfgConfiguratorLinks). */
  curtainConfiguratorId?: string;
  installationConfiguratorId?: string;
}

type Step = "entry" | "part" | "door-type" | "door-details" | "door-config";

interface NewLineDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (result: NewLineResult) => void;
}

function ChoiceBox({
  icon: Icon,
  title,
  description,
  onClick,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-start gap-3 rounded-lg border p-4 text-left transition-colors hover:border-primary/50 hover:bg-accent"
    >
      <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="h-5 w-5" />
      </span>
      <span className="font-semibold">{title}</span>
      <span className="text-sm text-muted-foreground">{description}</span>
    </button>
  );
}

interface ModelOption {
  value: string;
  label: string;
}

export function NewLineDialog({
  open,
  onOpenChange,
  onCreate,
}: NewLineDialogProps) {
  const [step, setStep] = React.useState<Step>("entry");

  // Configurator definitions from the DB (via the API) — used so the model
  // dropdown shows the same label + options as the configurator setup page.
  const [configurators, setConfigurators] = React.useState<Configurator[]>([]);
  React.useEffect(() => {
    if (!open) return;
    let active = true;
    fetchConfigData()
      .then((data) => {
        if (active) setConfigurators(data.configurators ?? []);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [open]);

  // Sub-configurator relationships from the config DB.
  const [links, setLinks] = React.useState<ConfiguratorLink[]>([]);
  React.useEffect(() => {
    if (!open) return;
    let active = true;
    fetchConfiguratorLinks()
      .then((l) => active && setLinks(l))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [open]);

  // The CMBDOORMODEL parameter for a door type's configurator, if the DB has one.
  const modelParamFor = React.useCallback(
    (type: DoorTypeDef | undefined) => {
      if (!type) return undefined;
      const cfg = configurators.find((c) => c.id === type.configuratorId);
      return cfg?.parameters.find(
        (p) => p.controlName.toUpperCase() === "CMBDOORMODEL"
      );
    },
    [configurators]
  );

  // DB options (non-empty) when available, otherwise the hardcoded fallback list.
  const modelOptionsFor = React.useCallback(
    (type: DoorTypeDef | undefined): ModelOption[] => {
      const param = modelParamFor(type);
      const dbOptions = (param?.options ?? []).filter((o) => o.value !== "");
      if (dbOptions.length) {
        return dbOptions.map((o) => ({ value: o.value, label: o.label || o.value }));
      }
      return (type?.models ?? []).map((m) => ({ value: m, label: m }));
    },
    [modelParamFor]
  );

  // Part path
  const [partQuery, setPartQuery] = React.useState("");
  const [selectedPart, setSelectedPart] = React.useState<M1Part | null>(null);
  const [partQty, setPartQty] = React.useState(1);
  const [partResults, setPartResults] = React.useState<M1Part[]>([]);
  const [partSearching, setPartSearching] = React.useState(false);

  // Debounced M1 part search.
  React.useEffect(() => {
    const q = partQuery.trim();
    if (q.length < 2) {
      setPartResults([]);
      setPartSearching(false);
      return;
    }
    setPartSearching(true);
    let active = true;
    const t = setTimeout(() => {
      searchM1Parts(q)
        .then((r) => active && setPartResults(r))
        .finally(() => active && setPartSearching(false));
    }, 250);
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [partQuery]);

  // Door path
  const [doorTypeId, setDoorTypeId] = React.useState<DoorTypeId | null>(null);
  const [model, setModel] = React.useState("");
  const [doorName, setDoorName] = React.useState("");
  const [width, setWidth] = React.useState(0);
  const [height, setHeight] = React.useState(0);
  const [runCurtain, setRunCurtain] = React.useState(true);
  const [runInstallation, setRunInstallation] = React.useState(true);

  const reset = React.useCallback(() => {
    setStep("entry");
    setPartQuery("");
    setSelectedPart(null);
    setPartQty(1);
    setPartResults([]);
    setPartSearching(false);
    setDoorTypeId(null);
    setModel("");
    setDoorName("");
    setWidth(0);
    setHeight(0);
    setRunCurtain(true);
    setRunInstallation(true);
  }, []);

  React.useEffect(() => {
    if (open) reset();
  }, [open, reset]);

  const doorType: DoorTypeDef | undefined = DOOR_TYPES.find(
    (t) => t.id === doorTypeId
  );

  // Which sub-configurators this door's configurator links to.
  const activeConfiguratorId = doorType
    ? configuratorFor(doorType, model)
    : "";
  const myLinks = links.filter((l) => l.parentId === activeConfiguratorId);
  const curtainLink = myLinks.find((l) => l.linkType === "curtain");
  const installLink = myLinks.find((l) => l.linkType === "installation");
  // Fall back to the hardcoded catalogue when the API is unavailable.
  const hasCurtainLink = curtainLink ? true : links.length === 0 && !!doorType?.needsCurtain;
  const hasInstallLink = installLink ? true : links.length === 0;

  const finishPart = () => {
    if (!selectedPart || partQty < 1) return;
    const item: Part = {
      partId: selectedPart.partId,
      partRevision: selectedPart.partRevision,
      partDescription: selectedPart.partDescription,
      partLongDescription: selectedPart.partLongDescription,
      partQty,
      sell: selectedPart.sell,
      cost: selectedPart.cost,
    };
    onCreate({ item, runCurtain: false, runInstallation: false });
    onOpenChange(false);
  };

  const finishDoor = () => {
    if (!doorType || !model || width <= 0 || height <= 0) return;
    const item: Door = {
      partId: partIdFor(doorType.id, model),
      partRevision: "A",
      partDescription: doorName || `${doorType.label} ${model}`,
      partLongDescription: `${doorType.label} ${model} — ${height}H x ${width}W`,
      partQty: 1,
      configuratorId: configuratorFor(doorType, model),
      parameters: [
        { controlName: "CMBDOORMODEL", value: model },
        { controlName: "NUMDOORHEIGHT", value: String(height) },
        { controlName: "NUMDOORWIDTH", value: String(width) },
      ],
    };
    const wantsCurtain = hasCurtainLink && runCurtain;
    const wantsInstall = hasInstallLink && runInstallation;
    onCreate({
      item,
      runCurtain: wantsCurtain,
      runInstallation: wantsInstall,
      curtainConfiguratorId: wantsCurtain
        ? curtainLink?.childId ?? "CURTAIN-TEMPLATE"
        : undefined,
      installationConfiguratorId: wantsInstall
        ? installLink?.childId ?? "INSTALLATION-TEMPLATE"
        : undefined,
    });
    onOpenChange(false);
  };

  const back = () => {
    if (step === "part" || step === "door-type") setStep("entry");
    else if (step === "door-details") setStep("door-type");
    else if (step === "door-config") setStep("door-details");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            {step !== "entry" && (
              <Button
                variant="ghost"
                size="icon"
                className="-ml-2 h-8 w-8"
                onClick={back}
                aria-label="Back"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            <DialogTitle>New line</DialogTitle>
          </div>
          <DialogDescription>
            {step === "entry" && "What would you like to add to this quote?"}
            {step === "part" && "Search the M1 part list and choose a part."}
            {step === "door-type" && "Choose the door type."}
            {step === "door-details" && "Enter the door details."}
            {step === "door-config" && "Choose the configurators to run."}
          </DialogDescription>
        </DialogHeader>

        {/* Step: entry */}
        {step === "entry" && (
          <div className="grid gap-3 sm:grid-cols-2">
            <ChoiceBox
              icon={Package}
              title="Part entry"
              description="Pick a sellable part from the M1 catalogue."
              onClick={() => setStep("part")}
            />
            <ChoiceBox
              icon={DoorOpen}
              title="Door"
              description="Configure a door — sizes, options and pricing."
              onClick={() => setStep("door-type")}
            />
          </div>
        )}

        {/* Step: part search */}
        {step === "part" && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="part-search">Search part ID / description</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="part-search"
                  value={partQuery}
                  onChange={(e) => setPartQuery(e.target.value)}
                  placeholder="At least 2 characters…"
                  className="pl-9"
                />
              </div>
            </div>

            {partQuery.trim().length < 2 ? (
              <p className="px-1 py-4 text-sm text-muted-foreground">
                Enter at least 2 characters to search M1.
              </p>
            ) : partSearching ? (
              <p className="flex items-center gap-2 px-1 py-4 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Searching M1…
              </p>
            ) : partResults.length === 0 ? (
              <p className="px-1 py-4 text-sm text-muted-foreground">
                No matching parts found.
              </p>
            ) : (
              <ul className="max-h-56 divide-y overflow-auto rounded-md border">
                {partResults.map((part, i) => {
                  const key = `${part.partId}-${part.partRevision}-${i}`;
                  const selected =
                    selectedPart?.partId === part.partId &&
                    selectedPart?.partRevision === part.partRevision;
                  return (
                    <li key={key}>
                      <button
                        type="button"
                        onClick={() => setSelectedPart(part)}
                        className={cn(
                          "flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm transition-colors hover:bg-accent",
                          selected && "bg-accent"
                        )}
                      >
                        <span className="min-w-0 flex-1">
                          <span className="font-mono text-xs">{part.partId}</span>
                          <span className="text-muted-foreground">
                            {part.partRevision ? ` rev ${part.partRevision}` : ""} —{" "}
                            {part.partDescription}
                          </span>
                        </span>
                        <span className="shrink-0 tabular-nums">
                          {money(part.sell)}
                        </span>
                        {selected && <Check className="h-4 w-4 shrink-0 text-primary" />}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}

            <div className="flex items-end gap-3">
              <div className="w-28 space-y-1.5">
                <Label htmlFor="part-qty">Qty</Label>
                <Input
                  id="part-qty"
                  type="number"
                  min={1}
                  value={partQty}
                  onChange={(e) => setPartQty(Number(e.target.value))}
                />
              </div>
              <Button
                className="ml-auto"
                disabled={!selectedPart || partQty < 1}
                onClick={finishPart}
              >
                Add part
              </Button>
            </div>
          </div>
        )}

        {/* Step: door type */}
        {step === "door-type" && (
          <div className="grid gap-3 sm:grid-cols-2">
            {DOOR_TYPES.map((type) => (
              <ChoiceBox
                key={type.id}
                icon={DOOR_ICONS[type.id]}
                title={type.label}
                description={type.description}
                onClick={() => {
                  setDoorTypeId(type.id);
                  setModel(modelOptionsFor(type)[0]?.value ?? "");
                  setStep("door-details");
                }}
              />
            ))}
          </div>
        )}

        {/* Step: door details */}
        {step === "door-details" && doorType && (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="door-model">
                  {modelParamFor(doorType)?.label || "Model"}
                </Label>
                <select
                  id="door-model"
                  className={SELECT_CLASS}
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                >
                  {modelOptionsFor(doorType).map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="door-name">Door name</Label>
                <Input
                  id="door-name"
                  value={doorName}
                  onChange={(e) => setDoorName(e.target.value)}
                  placeholder="e.g. Dock 3 main door"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="door-width">Width (mm)</Label>
                <Input
                  id="door-width"
                  type="number"
                  min={0}
                  value={width || ""}
                  onChange={(e) => setWidth(Number(e.target.value))}
                  placeholder="e.g. 3500"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="door-height">Height (mm)</Label>
                <Input
                  id="door-height"
                  type="number"
                  min={0}
                  value={height || ""}
                  onChange={(e) => setHeight(Number(e.target.value))}
                  placeholder="e.g. 3000"
                />
              </div>
            </div>
            <div className="flex justify-end">
              <Button
                disabled={!model || width <= 0 || height <= 0}
                onClick={() => setStep("door-config")}
              >
                Next
              </Button>
            </div>
          </div>
        )}

        {/* Step: door configurators */}
        {step === "door-config" && doorType && (
          <div className="space-y-3">
            <div className="flex items-center gap-3 rounded-md border p-3">
              <DoorOpen className="h-5 w-5 text-primary" />
              <div className="flex-1">
                <p className="text-sm font-medium">Door configurator</p>
                <p className="text-xs text-muted-foreground">
                  {doorType.label} — {model} · included
                </p>
              </div>
              <Check className="h-4 w-4 text-primary" />
            </div>

            {/* Sub-configurators come from the config DB (uCfgConfiguratorLinks),
                so curtain only offers itself where it actually applies. */}
            {hasCurtainLink && (
              <div className="flex items-center gap-3 rounded-md border p-3">
                <Blinds className="h-5 w-5 text-muted-foreground" />
                <div className="flex-1">
                  <p className="text-sm font-medium">Curtain configurator</p>
                  <p className="text-xs text-muted-foreground">
                    Rapid doors only — curtain size and windows.
                  </p>
                </div>
                <Switch
                  checked={runCurtain}
                  onCheckedChange={setRunCurtain}
                  aria-label="Run curtain configurator"
                />
              </div>
            )}

            {hasInstallLink && (
              <div className="flex items-center gap-3 rounded-md border p-3">
                <Wrench className="h-5 w-5 text-muted-foreground" />
                <div className="flex-1">
                  <p className="text-sm font-medium">Installation configurator</p>
                  <p className="text-xs text-muted-foreground">
                    Install options and labour for this door.
                  </p>
                </div>
                <Switch
                  checked={runInstallation}
                  onCheckedChange={setRunInstallation}
                  aria-label="Run installation configurator"
                />
              </div>
            )}

            <div className="flex justify-end pt-1">
              <Button onClick={finishDoor}>
                <PackageSearch className="h-4 w-4" />
                Add door line
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
