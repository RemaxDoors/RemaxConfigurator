"use client";

import * as React from "react";
import { GripVertical, Loader2, Plus, Check, AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PARAMETER_KIND_LABELS } from "@/types/configurator";
import type { ConfiguratorParameter } from "@/types/configurator";

/** "Overview > Controller" -> ["Overview", "Controller"]. */
function splitSection(section?: string): [string, string] {
  const parts = (section || "").split(">");
  const step = (parts[0] || "").trim();
  return [step, parts.length > 1 ? parts.slice(1).join(">").trim() : ""];
}

function joinSection(step: string, group: string): string {
  const s = step.trim();
  const g = group.trim();
  if (!s) return "";
  return g ? `${s} > ${g}` : s;
}

interface Column {
  /** The full section string, "" for ungrouped. */
  key: string;
  step: string;
  group: string;
  params: ConfiguratorParameter[];
}

/** Group parameters into columns, preserving the order they arrive in. */
function toColumns(params: ConfiguratorParameter[]): Column[] {
  const order: string[] = [];
  const byKey = new Map<string, ConfiguratorParameter[]>();
  for (const p of params) {
    const key = (p.section || "").trim();
    if (!byKey.has(key)) {
      byKey.set(key, []);
      order.push(key);
    }
    byKey.get(key)!.push(p);
  }
  // Ungrouped last — it's the "needs filing" pile.
  order.sort((a, b) => (a === "" ? 1 : b === "" ? -1 : 0));
  return order.map((key) => {
    const [step, group] = splitSection(key);
    return { key, step, group, params: byKey.get(key)! };
  });
}

/**
 * Visual layout editor for the form. Drag a field onto another section to move
 * it; drop it between fields to reorder. Saves Section + SortOrder only, so a
 * field's dropdown options are never at risk.
 */
export function SectionBoard({
  configuratorId,
  parameters,
  onSaved,
}: {
  configuratorId: string;
  parameters: ConfiguratorParameter[];
  onSaved?: () => void;
}) {
  const [items, setItems] = React.useState<ConfiguratorParameter[]>(parameters);
  const [dragging, setDragging] = React.useState<string | null>(null);
  const [dropTarget, setDropTarget] = React.useState<string | null>(null);
  const [dirty, setDirty] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [result, setResult] = React.useState<string | null>(null);
  const [newSection, setNewSection] = React.useState("");
  // Sections with nothing in them yet — they have no parameter to derive from,
  // so they live here until something is dropped in.
  const [emptyColumns, setEmptyColumns] = React.useState<string[]>([]);

  React.useEffect(() => {
    setItems(parameters);
    setDirty(false);
  }, [parameters]);

  const columns = React.useMemo(() => {
    const cols = toColumns(items);
    const have = new Set(cols.map((c) => c.key));
    const extra = emptyColumns
      .filter((key) => !have.has(key))
      .map((key) => {
        const [step, group] = splitSection(key);
        return { key, step, group, params: [] as ConfiguratorParameter[] };
      });
    // Keep "Ungrouped" last however many empty columns were added.
    const ungrouped = cols.filter((c) => c.key === "");
    return [...cols.filter((c) => c.key !== ""), ...extra, ...ungrouped];
  }, [items, emptyColumns]);

  /** Move the dragged field into `sectionKey`, landing before `beforeControl`. */
  const move = (control: string, sectionKey: string, beforeControl?: string) => {
    setItems((prev) => {
      const moving = prev.find((p) => p.controlName === control);
      if (!moving) return prev;
      const rest = prev.filter((p) => p.controlName !== control);
      const updated = { ...moving, section: sectionKey || undefined };
      const at = beforeControl
        ? rest.findIndex((p) => p.controlName === beforeControl)
        : -1;
      if (at === -1) {
        // Append to the end of that section's run, so it lands where it looks.
        let last = -1;
        rest.forEach((p, i) => {
          if ((p.section || "").trim() === sectionKey) last = i;
        });
        if (last === -1) return [...rest, updated];
        return [...rest.slice(0, last + 1), updated, ...rest.slice(last + 1)];
      }
      return [...rest.slice(0, at), updated, ...rest.slice(at)];
    });
    setDirty(true);
    setResult(null);
  };

  const renameSection = (oldKey: string, step: string, group: string) => {
    const next = joinSection(step, group);
    setItems((prev) =>
      prev.map((p) =>
        (p.section || "").trim() === oldKey
          ? { ...p, section: next || undefined }
          : p
      )
    );
    setDirty(true);
    setResult(null);
  };

  const save = async () => {
    setSaving(true);
    setResult(null);
    try {
      const res = await fetch("/api/config/layout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          configuratorId,
          items: items.map((p) => ({
            controlName: p.controlName,
            section: (p.section || "").trim() || null,
          })),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setResult(data.detail || data.error || "Save failed.");
        return;
      }
      setDirty(false);
      setResult(`Saved — ${data.moved ?? 0} field(s) moved.`);
      onSaved?.();
    } catch {
      setResult("Could not reach the API. Nothing was saved.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-medium">Form sections</h3>
        <span className="text-xs text-muted-foreground">
          Drag a field to move it. Drop between fields to reorder.
        </span>
        <div className="ml-auto flex items-center gap-2">
          {result && (
            <span
              className={`flex items-center gap-1 text-xs ${
                result.startsWith("Saved") ? "text-emerald-600" : "text-destructive"
              }`}
            >
              {result.startsWith("Saved") ? (
                <Check className="h-3.5 w-3.5" />
              ) : (
                <AlertTriangle className="h-3.5 w-3.5" />
              )}
              {result}
            </span>
          )}
          <Button size="sm" onClick={save} disabled={!dirty || saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {dirty ? "Save layout" : "Saved"}
          </Button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {columns.map((col) => (
          <div
            key={col.key || "_ungrouped"}
            className={`rounded-lg border bg-muted/20 p-2 transition-colors ${
              dropTarget === col.key ? "border-primary bg-primary/5" : ""
            }`}
            onDragOver={(e) => {
              e.preventDefault();
              setDropTarget(col.key);
            }}
            onDragLeave={() => setDropTarget((t) => (t === col.key ? null : t))}
            onDrop={(e) => {
              e.preventDefault();
              if (dragging) move(dragging, col.key);
              setDragging(null);
              setDropTarget(null);
            }}
          >
            <div className="mb-2 space-y-1">
              {col.key === "" ? (
                <p className="text-sm font-semibold text-amber-600">Ungrouped</p>
              ) : (
                <div className="flex gap-1">
                  <Input
                    className="h-8 text-sm font-semibold"
                    value={col.step}
                    onChange={(e) => renameSection(col.key, e.target.value, col.group)}
                    aria-label="Step name"
                  />
                  <Input
                    className="h-8 w-28 text-xs"
                    value={col.group}
                    placeholder="sub-group"
                    onChange={(e) => renameSection(col.key, col.step, e.target.value)}
                    aria-label="Group name"
                  />
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                {col.params.length} parameter{col.params.length === 1 ? "" : "s"}
              </p>
            </div>

            <ul className="space-y-1">
              {col.params.map((p) => (
                <li
                  key={p.controlName}
                  draggable
                  onDragStart={() => setDragging(p.controlName)}
                  onDragEnd={() => {
                    setDragging(null);
                    setDropTarget(null);
                  }}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    if (dragging && dragging !== p.controlName) {
                      move(dragging, col.key, p.controlName);
                    }
                    setDragging(null);
                    setDropTarget(null);
                  }}
                  className={`flex cursor-grab items-center gap-2 rounded-md border bg-background px-2 py-1.5 text-sm active:cursor-grabbing ${
                    dragging === p.controlName ? "opacity-40" : ""
                  }`}
                >
                  <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate">{p.label}</span>
                  <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase text-muted-foreground">
                    {PARAMETER_KIND_LABELS[p.kind] ?? p.kind}
                  </span>
                </li>
              ))}
              {col.params.length === 0 && (
                <li className="rounded-md border border-dashed px-2 py-3 text-center text-xs text-muted-foreground">
                  Drop a field here
                </li>
              )}
            </ul>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <Input
          className="h-9 max-w-xs"
          value={newSection}
          placeholder="New section name"
          onChange={(e) => setNewSection(e.target.value)}
        />
        <Button
          variant="outline"
          size="sm"
          disabled={
            !newSection.trim() ||
            columns.some((c) => c.key === newSection.trim())
          }
          onClick={() => {
            setEmptyColumns((prev) => [...prev, newSection.trim()]);
            setNewSection("");
          }}
        >
          <Plus className="h-4 w-4" />
          Add section
        </Button>
      </div>
    </div>
  );
}
