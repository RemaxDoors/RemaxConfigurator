"use client";

import * as React from "react";
import { ChevronRight } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Json = unknown;

function isPlainObject(v: Json): v is Record<string, Json> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
function isPrimitive(v: Json): boolean {
  return v === null || ["string", "number", "boolean"].includes(typeof v);
}

function PrimitiveValue({ value }: { value: Json }) {
  if (value === null || value === undefined || value === "") {
    return <span className="text-muted-foreground">—</span>;
  }
  if (typeof value === "boolean") {
    return <span className="font-mono">{value ? "true" : "false"}</span>;
  }
  return <span className="whitespace-pre-wrap break-words">{String(value)}</span>;
}

/** Collapsible section for nested objects/arrays. Top level opens by default. */
function Section({
  title,
  count,
  defaultOpen,
  children,
}: {
  title: string;
  count?: number;
  defaultOpen: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(defaultOpen);
  return (
    <div className="rounded-md border">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium transition-colors hover:bg-accent"
      >
        <ChevronRight
          className={cn("h-4 w-4 shrink-0 transition-transform", open && "rotate-90")}
        />
        <span className="font-mono text-xs">{title}</span>
        {count !== undefined && (
          <Badge variant="secondary" className="ml-1">
            {count}
          </Badge>
        )}
      </button>
      {open && <div className="border-t p-3">{children}</div>}
    </div>
  );
}

function KeyValueGrid({ rows }: { rows: [string, Json][] }) {
  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full text-sm">
        <tbody>
          {rows.map(([key, value]) => (
            <tr key={key} className="border-b last:border-0 align-top">
              <td className="w-1/3 min-w-[140px] bg-muted/40 px-3 py-1.5 font-mono text-xs">
                {key}
              </td>
              <td className="px-3 py-1.5">
                <PrimitiveValue value={value} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ObjectGrid({
  obj,
  depth,
}: {
  obj: Record<string, Json>;
  depth: number;
}) {
  const entries = Object.entries(obj);
  const scalars = entries.filter(([, v]) => isPrimitive(v));
  const complex = entries.filter(([, v]) => !isPrimitive(v));

  return (
    <div className="space-y-2">
      {scalars.length > 0 && <KeyValueGrid rows={scalars} />}
      {complex.map(([key, val]) => (
        <Section
          key={key}
          title={key}
          count={Array.isArray(val) ? val.length : undefined}
          defaultOpen={depth === 0}
        >
          <Node data={val} depth={depth + 1} />
        </Section>
      ))}
    </div>
  );
}

function ArrayGrid({ arr, depth }: { arr: Json[]; depth: number }) {
  if (arr.length === 0) {
    return <p className="text-sm text-muted-foreground">Empty.</p>;
  }
  if (arr.every(isPrimitive)) {
    return (
      <ul className="list-disc space-y-1 pl-5 text-sm">
        {arr.map((v, i) => (
          <li key={i}>
            <PrimitiveValue value={v} />
          </li>
        ))}
      </ul>
    );
  }
  if (arr.every(isPlainObject)) {
    const columns = Array.from(
      new Set(arr.flatMap((o) => Object.keys(o as object)))
    );
    return (
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/40">
              {columns.map((c) => (
                <th
                  key={c}
                  className="whitespace-nowrap px-3 py-1.5 text-left font-medium"
                >
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {arr.map((row, i) => (
              <tr key={i} className="border-b align-top last:border-0">
                {columns.map((c) => {
                  const cell = (row as Record<string, Json>)[c];
                  return (
                    <td key={c} className="px-3 py-1.5">
                      {isPrimitive(cell) ? (
                        <PrimitiveValue value={cell} />
                      ) : (
                        <details>
                          <summary className="cursor-pointer text-xs text-primary underline-offset-2 hover:underline">
                            {Array.isArray(cell) ? `[${cell.length}]` : "{…}"}
                          </summary>
                          <div className="mt-2">
                            <Node data={cell} depth={depth + 1} />
                          </div>
                        </details>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  // Mixed array — render each item as its own section.
  return (
    <div className="space-y-2">
      {arr.map((v, i) => (
        <Section key={i} title={`[${i}]`} defaultOpen={depth === 0}>
          <Node data={v} depth={depth + 1} />
        </Section>
      ))}
    </div>
  );
}

function Node({ data, depth }: { data: Json; depth: number }) {
  if (isPrimitive(data)) return <PrimitiveValue value={data} />;
  if (Array.isArray(data)) return <ArrayGrid arr={data} depth={depth} />;
  if (isPlainObject(data)) return <ObjectGrid obj={data} depth={depth} />;
  return <PrimitiveValue value={String(data)} />;
}

/** Renders arbitrary JSON as a grid, with nested objects/arrays as expandable sections. */
export function JsonGrid({ data }: { data: Json }) {
  return <Node data={data} depth={0} />;
}
