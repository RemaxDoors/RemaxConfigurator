"use client";

import * as React from "react";
import { Loader2, Save } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  MAP_ENTITIES,
  fetchM1Columns,
  fetchMapping,
  saveMapping,
  type FieldMapEntry,
  type M1Column,
} from "@/lib/mapping";

const SELECT_CLASS =
  "h-9 w-full rounded-md border border-input bg-background px-2 text-sm";

export function M1FieldMapping() {
  const [columns, setColumns] = React.useState<Record<string, M1Column[]>>({});
  const [map, setMap] = React.useState<Record<string, string>>({}); // `${entity}.${field}` → m1Column
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [notice, setNotice] = React.useState<{ ok: boolean; text: string } | null>(null);

  React.useEffect(() => {
    let active = true;
    (async () => {
      const [cols, saved] = await Promise.all([
        Promise.all(MAP_ENTITIES.map((e) => fetchM1Columns(e.table))),
        fetchMapping(),
      ]);
      if (!active) return;
      const colMap: Record<string, M1Column[]> = {};
      MAP_ENTITIES.forEach((e, i) => (colMap[e.table] = cols[i]));
      setColumns(colMap);
      const m: Record<string, string> = {};
      saved.forEach((s: FieldMapEntry) => {
        if (s.m1Column) m[`${s.entity}.${s.appField}`] = s.m1Column;
      });
      setMap(m);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  const setCol = (entity: string, field: string, col: string) =>
    setMap((prev) => ({ ...prev, [`${entity}.${field}`]: col }));

  const save = async () => {
    setSaving(true);
    setNotice(null);
    const entries: FieldMapEntry[] = [];
    for (const e of MAP_ENTITIES) {
      for (const f of e.fields) {
        entries.push({
          entity: e.key,
          appField: f.key,
          m1Column: map[`${e.key}.${f.key}`] || null,
        });
      }
    }
    try {
      const r = await saveMapping(entries);
      setNotice({ ok: true, text: `Saved ${r.saved} field mappings.` });
    } catch (err) {
      setNotice({ ok: false, text: err instanceof Error ? err.message : "Save failed." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>M1 field mapping</CardTitle>
        <CardDescription>
          Map each app field to an M1 column. Drives the Quotes / QuoteLines /
          QuoteQuantities insert and the FormInputValues write-back. Unmapped
          fields are left out of the INSERT entirely (no defaults are invented).
          Fields marked <span className="text-destructive">*</span> are mandatory.
          Timestamp columns are excluded automatically.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {loading ? (
          <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading M1 columns…
          </div>
        ) : (
          <>
            {MAP_ENTITIES.map((entity) => {
              const cols = columns[entity.table] ?? [];
              return (
                <div key={entity.key} className="space-y-2">
                  <p className="text-sm font-medium">{entity.label}</p>
                  {cols.length === 0 && (
                    <p className="text-xs text-destructive">
                      Could not read columns for {entity.table} (check M1 connection).
                    </p>
                  )}
                  <div className="overflow-hidden rounded-md border">
                    {entity.fields.map((f, i) => (
                      <div
                        key={f.key}
                        className={`grid grid-cols-[1fr_1.2fr] items-center gap-3 px-3 py-2 ${
                          i % 2 ? "bg-muted/30" : ""
                        }`}
                      >
                        <div>
                          <span className="text-sm">
                            {f.label}
                            {f.required && (
                              <span className="ml-1 text-destructive">*</span>
                            )}
                          </span>
                          {f.hint && (
                            <span className="block text-xs text-muted-foreground">
                              {f.hint}
                            </span>
                          )}
                          {f.required && !map[`${entity.key}.${f.key}`] && (
                            <span className="block text-xs text-destructive">
                              Required — the M1 insert is blocked without this.
                            </span>
                          )}
                        </div>
                        <select
                          className={`${SELECT_CLASS} ${
                            f.required && !map[`${entity.key}.${f.key}`]
                              ? "border-destructive"
                              : ""
                          }`}
                          value={map[`${entity.key}.${f.key}`] ?? ""}
                          onChange={(e) => setCol(entity.key, f.key, e.target.value)}
                        >
                          <option value="">— not mapped —</option>
                          {cols
                            .filter((c) => !c.readOnly)
                            .map((c) => (
                              <option key={c.name} value={c.name}>
                                {c.name} ({c.type}
                                {c.nullable ? "" : ", required"})
                              </option>
                            ))}
                        </select>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}

            {notice && (
              <p
                className={`text-sm ${
                  notice.ok ? "text-success" : "text-destructive"
                }`}
              >
                {notice.text}
              </p>
            )}

            <Button onClick={save} disabled={saving}>
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Save mapping
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
