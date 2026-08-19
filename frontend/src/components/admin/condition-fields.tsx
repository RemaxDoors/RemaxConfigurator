"use client";

import * as React from "react";
import { Plus, X } from "lucide-react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { ConfiguratorParameter } from "@/types/configurator";

export const SELECT_CLASS =
  "flex h-10 w-full rounded-md border border-input bg-background px-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

/** Operators whose value is a list of choices rather than a single one. */
export const LIST_OPERATORS = new Set(["in", "not_in"]);
/** Operators that take no value at all. */
export const NO_VALUE_OPERATORS = new Set(["is_checked", "not_checked"]);

/** Pick a parameter by control name — no typing, so no typos. */
export function ControlSelect({
  parameters,
  value,
  onChange,
  className,
}: {
  parameters: ConfiguratorParameter[];
  value: string;
  onChange: (controlName: string) => void;
  className?: string;
}) {
  // Keep an unknown control (e.g. imported from CSV) selectable so it isn't lost.
  const known = parameters.some(
    (p) => p.controlName.toUpperCase() === value.toUpperCase()
  );
  return (
    <select
      className={cn(SELECT_CLASS, className)}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">— choose a field —</option>
      {!known && value && (
        <option value={value}>{value} (not in this configurator)</option>
      )}
      {parameters.map((p) => (
        <option key={p.controlName} value={p.controlName}>
          {p.label} · {p.controlName}
        </option>
      ))}
    </select>
  );
}

/**
 * Value editor that matches the field and the operator:
 *  - list operators (in / not in) -> multi-select, shown as removable chips
 *  - a field with options         -> single dropdown
 *  - anything else                -> free text
 */
export function ValueEditor({
  parameter,
  operator,
  value,
  onChange,
}: {
  parameter?: ConfiguratorParameter;
  operator: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const options = (parameter?.options ?? []).filter((o) => o.value !== "");
  const isList = LIST_OPERATORS.has(operator);

  const selected = React.useMemo(
    () =>
      value
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean),
    [value]
  );

  const labelFor = (v: string) =>
    options.find((o) => o.value.toLowerCase() === v.toLowerCase())?.label || v;

  // --- multi-select: chips + an "add" dropdown -----------------------------
  if (isList) {
    const remaining = options.filter(
      (o) => !selected.some((s) => s.toLowerCase() === o.value.toLowerCase())
    );
    return (
      <div className="w-full space-y-1.5 rounded-md border p-2">
        {selected.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No values chosen — add at least one.
          </p>
        ) : (
          <div className="flex flex-wrap gap-1">
            {selected.map((v) => (
              <span
                key={v}
                className="inline-flex items-center gap-1 rounded bg-primary/10 py-0.5 pl-2 pr-1 text-xs text-primary"
              >
                {labelFor(v)}
                <button
                  type="button"
                  onClick={() =>
                    onChange(selected.filter((s) => s !== v).join(", "))
                  }
                  aria-label={`Remove ${v}`}
                  className="rounded hover:bg-primary/20"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}

        {options.length > 0 ? (
          remaining.length > 0 && (
            <select
              className={cn(SELECT_CLASS, "h-8 text-xs")}
              value=""
              onChange={(e) => {
                if (!e.target.value) return;
                onChange([...selected, e.target.value].join(", "));
              }}
            >
              <option value="">+ add a value…</option>
              {remaining.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label || o.value}
                </option>
              ))}
            </select>
          )
        ) : (
          <AddFreeValue
            onAdd={(v) => onChange([...selected, v].join(", "))}
          />
        )}
      </div>
    );
  }

  // --- single value --------------------------------------------------------
  if (options.length > 0) {
    const known = options.some(
      (o) => o.value.toLowerCase() === value.toLowerCase()
    );
    return (
      <select
        className={SELECT_CLASS}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">— choose a value —</option>
        {!known && value && <option value={value}>{value} (custom)</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label || o.value}
          </option>
        ))}
      </select>
    );
  }

  return (
    <Input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={parameter?.kind === "number" ? "e.g. 4000" : "Value"}
    />
  );
}

/** Free-text add box, used when the field has no option list. */
function AddFreeValue({ onAdd }: { onAdd: (value: string) => void }) {
  const [draft, setDraft] = React.useState("");
  const commit = () => {
    const v = draft.trim();
    if (!v) return;
    onAdd(v);
    setDraft("");
  };
  return (
    <div className="flex gap-1">
      <Input
        className="h-8 text-xs"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
          }
        }}
        placeholder="type a value, then Enter"
      />
      <button
        type="button"
        onClick={commit}
        className="rounded border px-2 text-xs hover:bg-accent"
        aria-label="Add value"
      >
        <Plus className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
