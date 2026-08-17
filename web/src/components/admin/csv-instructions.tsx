"use client";

import * as React from "react";
import { ChevronDown, FileSpreadsheet } from "lucide-react";

/** Collapsible CSV import/export help for the configurator setup page. */
export function CsvInstructions() {
  const [open, setOpen] = React.useState(false);
  return (
    <div className="rounded-md border">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-medium"
      >
        <FileSpreadsheet className="h-4 w-4 text-primary" />
        CSV import / export — how it works
        <ChevronDown
          className={`ml-auto h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="space-y-3 border-t px-4 py-3 text-sm text-muted-foreground">
          <p>
            <strong className="text-foreground">Export</strong> downloads the
            current list as a CSV you can edit in Excel.{" "}
            <strong className="text-foreground">Import</strong> reads a CSV back
            in and <em>replaces the whole list</em> for the selected
            configurator — anything not in the file is deleted.
          </p>

          <div>
            <p className="font-medium text-foreground">Parameters CSV columns</p>
            <ul className="ml-4 list-disc">
              <li>
                <code className="text-foreground">Control Name</code> — required,
                unique (e.g. <code>CMBDOORMODEL</code>)
              </li>
              <li>
                <code className="text-foreground">Label</code> — required (the
                friendly name shown on the form)
              </li>
              <li>
                <code className="text-foreground">Type</code> — one of{" "}
                <code>Dropdown</code>, <code>Checkbox</code>, <code>Number</code>,{" "}
                <code>Text</code>
              </li>
              <li>
                <code className="text-foreground">Options</code> (optional) —
                dropdown choices as <code>value=label</code> joined by{" "}
                <code>|</code> (e.g. <code>ES40|1P10A=1-Ph 10A + N + E</code>).
                Use just <code>value</code> when it equals the label.
              </li>
            </ul>
            <p className="mt-1 text-xs">
              If you leave out the Options column, existing options are preserved
              (only labels/types update). Include it to set them.
            </p>
          </div>

          <div>
            <p className="font-medium text-foreground">Rules CSV columns</p>
            <ul className="ml-4 list-disc">
              <li>
                <code className="text-foreground">Rule ID</code> — required,
                unique
              </li>
              <li>
                <code className="text-foreground">Name</code>,{" "}
                <code className="text-foreground">Result Part</code> — required
              </li>
              <li>
                <code className="text-foreground">Category</code> — one of Base,
                Assembly Upgrade, Material Upgrade, Material Discount, Installation
              </li>
              <li>
                <code className="text-foreground">Quantity</code> — a number ·{" "}
                <code className="text-foreground">Active</code> — Yes/No
              </li>
            </ul>
          </div>

          <p className="text-xs">
            After import you’ll see how many rows were{" "}
            <strong className="text-foreground">imported</strong>,{" "}
            <strong className="text-foreground">deleted</strong>, and how many had{" "}
            <strong className="text-foreground">errors</strong> (with a message
            for each: wrong type, missing label, missing control name, duplicate,
            or a missing column).
          </p>
        </div>
      )}
    </div>
  );
}
