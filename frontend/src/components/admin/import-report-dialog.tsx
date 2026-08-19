"use client";

import * as React from "react";
import { AlertTriangle, CheckCircle2, Trash2 } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export interface ImportReport {
  title: string;
  /** Fatal parse error (e.g. missing column); when set, counts are ignored. */
  columnError?: string;
  imported: number;
  deleted: number;
  errors: { row: number; message: string }[];
}

export function ImportReportDialog({
  open,
  onOpenChange,
  report,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  report: ImportReport | null;
}) {
  if (!report) return null;
  const errorCount = report.errors.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{report.title}</DialogTitle>
          <DialogDescription>
            {report.columnError
              ? "The file could not be imported."
              : "Import finished. Review the summary below."}
          </DialogDescription>
        </DialogHeader>

        {report.columnError ? (
          <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{report.columnError}</span>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <Stat
                icon={<CheckCircle2 className="h-4 w-4" />}
                value={report.imported}
                label="Imported"
                tone="ok"
              />
              <Stat
                icon={<Trash2 className="h-4 w-4" />}
                value={report.deleted}
                label="Deleted"
                tone="muted"
              />
              <Stat
                icon={<AlertTriangle className="h-4 w-4" />}
                value={errorCount}
                label="Errors"
                tone={errorCount ? "error" : "muted"}
              />
            </div>

            {errorCount > 0 && (
              <div className="space-y-1.5">
                <p className="text-sm font-medium">Errors (these rows were skipped)</p>
                <ul className="max-h-56 space-y-1 overflow-auto rounded-md border p-2 text-sm">
                  {report.errors.map((e, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="shrink-0 font-mono text-xs text-muted-foreground">
                        row {e.row}
                      </span>
                      <span className="text-destructive">{e.message}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        <div className="flex justify-end">
          <Button onClick={() => onOpenChange(false)}>Done</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Stat({
  icon,
  value,
  label,
  tone,
}: {
  icon: React.ReactNode;
  value: number;
  label: string;
  tone: "ok" | "error" | "muted";
}) {
  const toneClass =
    tone === "ok"
      ? "text-green-700 dark:text-green-400"
      : tone === "error"
        ? "text-destructive"
        : "text-muted-foreground";
  return (
    <div className="rounded-md border p-3 text-center">
      <div className={`flex items-center justify-center gap-1 ${toneClass}`}>
        {icon}
        <span className="text-2xl font-bold tabular-nums">{value}</span>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
