"use client";

import * as React from "react";
import {
  ArrowLeft,
  Blinds,
  Check,
  DoorClosed,
  DoorOpen,
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
import { searchM1Parts, type M1Part } from "@/lib/mock-parts";
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

export function NewLineDialog({
  open,
  onOpenChange,
  onCreate,
}: NewLineDialogProps) {
  const [step, setStep] = React.useState<Step>("entry");

  // Part path
  const [partQuery, setPartQuery] = React.useState("");
  const [selectedPart, setSelectedPart] = React.useState<M1Part | null>(null);
  const [partQty, setPartQty] = React.useState(1);

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
  const partResults = searchM1Parts(partQuery);

  const finishPart = () => {
    if (!selectedPart || partQty < 1) return;
    const item: Part = {
      partId: selectedPart.partId,
      partRevision: selectedPart.partRevision,
      partDescription: selectedPart.partDescription,
      partLongDescription: selectedPart.partLongDescription,
      partQty,
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
    onCreate({
      item,
      runCurtain: doorType.needsCurtain && runCurtain,
      runInstallation,
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
                Enter at least 2 characters to search.
              </p>
            ) : partResults.length === 0 ? (
              <p className="px-1 py-4 text-sm text-muted-foreground">
                No matching parts found.
              </p>
            ) : (
              <ul className="max-h-56 divide-y overflow-auto rounded-md border">
                {partResults.map((part) => {
                  const key = `${part.partId}-${part.partRevision}`;
                  const selected =
                    selectedPart?.partId === part.partId &&
                    selectedPart?.partRevision === part.partRevision;
                  return (
                    <li key={key}>
                      <button
                        type="button"
                        onClick={() => setSelectedPart(part)}
                        className={cn(
                          "flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-accent",
                          selected && "bg-accent"
                        )}
                      >
                        <span>
                          <span className="font-mono text-xs">
                            {part.partId}
                          </span>
                          <span className="text-muted-foreground">
                            {" "}
                            rev {part.partRevision} — {part.partDescription}
                          </span>
                        </span>
                        {selected && <Check className="h-4 w-4 text-primary" />}
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
                  setModel(type.models[0] ?? "");
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
                <Label htmlFor="door-model">Model</Label>
                <select
                  id="door-model"
                  className={SELECT_CLASS}
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                >
                  {doorType.models.map((m) => (
                    <option key={m} value={m}>
                      {m}
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

            {doorType.needsCurtain && (
              <div className="flex items-center gap-3 rounded-md border p-3">
                <Blinds className="h-5 w-5 text-muted-foreground" />
                <div className="flex-1">
                  <p className="text-sm font-medium">Curtain configurator</p>
                  <p className="text-xs text-muted-foreground">
                    Required for Rapid doors.
                  </p>
                </div>
                <Switch
                  checked={runCurtain}
                  onCheckedChange={setRunCurtain}
                  aria-label="Run curtain configurator"
                />
              </div>
            )}

            <div className="flex items-center gap-3 rounded-md border p-3">
              <Wrench className="h-5 w-5 text-muted-foreground" />
              <div className="flex-1">
                <p className="text-sm font-medium">Installation configurator</p>
                <p className="text-xs text-muted-foreground">
                  Add installation if applicable.
                </p>
              </div>
              <Switch
                checked={runInstallation}
                onCheckedChange={setRunInstallation}
                aria-label="Run installation configurator"
              />
            </div>

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
