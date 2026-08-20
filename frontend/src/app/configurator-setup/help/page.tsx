"use client";

/**
 * Formula and rule reference for whoever maintains the configurator.
 *
 * Every example on this page was evaluated against the one worked configuration
 * shown at the top, and the results are the real ones — not illustrations. If
 * you change an example, run it through `python backend/app/formula.py` or the
 * Formula tester and paste the actual answer back.
 */

import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

/** The single configuration every example below is evaluated against. */
const WORKED_EXAMPLE: [string, string][] = [
  ["CMBACT1", "Induction Loop - Single"],
  ["NUMREMOTEQTY1", "0"],
  ["CMBACT2", "Elsema Remote - 2 Button"],
  ["NUMREMOTEQTY2", "4"],
  ["CMBACT3", "Existing Induction Loop"],
  ["NUMREMOTEQTY3", "0"],
  ["CMBACT4", "(blank)"],
  ["NUMREMOTEQTY4", "0"],
  ["CMBRADAR1", "IXIO Sensor - Long Stalk"],
  ["CMBRADAR2", "IXIO Sensor - Long Stalk"],
  ["NUMDOORHEIGHT", "3400"],
  ["NUMDOORWIDTH", "4200"],
  ["CMBDOORMODEL", "MOVICHILL"],
];

interface Preset {
  formula: string;
  result: string;
  what: string;
  when: string;
}

const SLOT_PRESETS: Preset[] = [
  {
    formula: 'countStartsWith(group("CMBACT"), "Induction Loop - ")',
    result: "1",
    what: "How many activation slots start with that text.",
    when: "Only CMBACT1 starts with it. CMBACT3 is an Existing loop, so it does not count.",
  },
  {
    formula: 'countEquals(group("CMBRADAR"), "IXIO Sensor - Long Stalk")',
    result: "2",
    what: "How many slots are exactly that value.",
    when: "Both radars are set to it, so two assemblies are billed.",
  },
  {
    formula: 'countContains(group("CMBACT"), "Loop")',
    result: "2",
    what: "How many slots contain the text anywhere.",
    when: "Catches both the new loop and the existing one.",
  },
  {
    formula: 'countContains(group("CMBACT"), "Loop", "Existing")',
    result: "1",
    what: "Contains the first text but NOT the second.",
    when: "The second argument excludes. This is the shape M1 writes as Instr(v,\"Loop\")>0 AND Instr(v,\"Existing\")=0.",
  },
  {
    formula:
      'countWhere(group("CMBACT"), "starts:Induction Loop - ", "!has:Existing")',
    result: "1",
    what: "Several tests against the SAME slot. Prefixes: starts: is: has: !has:",
    when: "Use when two separate counts would wrongly match different slots — a loop in one and \"Only\" in another.",
  },
];

const QTY_PRESETS: Preset[] = [
  {
    formula: 'sumWhere(group("CMBACT"), "Elsema Remote - 2", group("NUMREMOTEQTY"))',
    result: "4",
    what: "Adds up the quantity box beside each matching slot, paired by slot number.",
    when: "CMBACT2 matches and NUMREMOTEQTY2 is 4, so four handsets. THIS is the remote count.",
  },
  {
    formula:
      'sumWhere(group("CMBACT"), "Induction Loop - Single", group("NUMREMOTEQTY"), "equals")',
    result: "0",
    what: "Same, but the slot must equal the text exactly.",
    when: "CMBACT1 matches exactly, but its quantity box is 0 — so nothing is added. The default mode is \"starts\".",
  },
  {
    formula: "metresOfOpening(NUMDOORHEIGHT)",
    result: "3.4",
    what: "Height in metres, rounded up to 0.1m.",
    when: "Anything charged per metre of opening, such as high wind track.",
  },
  {
    formula: "ceil(NUMDOORWIDTH / 1000)",
    result: "5",
    what: "Round up to a whole number.",
    when: "Whole units per metre. 4200mm bills as 5.",
  },
  {
    formula: 'IF(CMBDOORMODEL = "MOVICHILL", 2, 1)',
    result: "2",
    what: "Pick between two values.",
    when: "Nest them for a revision that depends on the model.",
  },
];

const TEXT_PRESETS: Preset[] = [
  {
    formula: 'left(TXTCONFIGID, 4) = "SWI-"',
    result: "true",
    what: "First N characters, compared to text.",
    when: "M1's Left(...) test. Also right(), mid(), upper(), lower().",
  },
  {
    formula: 'contains(CMBACT2, "Elsema")',
    result: "true",
    what: "One field contains text.",
    when: "A single field — not a numbered group.",
  },
  {
    formula: 'startsWith(CMBACT1, "Induction")',
    result: "true",
    what: "One field starts with text.",
    when: "M1's Left(v,n) = \"...\" written more directly.",
  },
];

function PresetTable({ rows }: { rows: Preset[] }) {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[38%]">Formula</TableHead>
            <TableHead className="w-[7%] text-right">Result</TableHead>
            <TableHead className="w-[25%]">What it does</TableHead>
            <TableHead>Why that answer</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.formula}>
              <TableCell className="whitespace-pre-wrap break-all font-mono text-xs">
                {r.formula}
              </TableCell>
              <TableCell className="text-right font-mono text-xs font-semibold tabular-nums">
                {r.result}
              </TableCell>
              <TableCell className="text-sm">{r.what}</TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {r.when}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export default function FormulaHelpPage() {
  return (
    <main className="mx-auto max-w-6xl space-y-6 p-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/configurator-setup">
            <ArrowLeft className="h-4 w-4" />
            Back to setup
          </Link>
        </Button>
      </div>

      <div>
        <h1 className="text-2xl font-semibold">Rules and formulas</h1>
        <p className="text-muted-foreground">
          How a rule decides to fire, and how it works out the quantity.
        </p>
      </div>

      {/* ---- the two questions ------------------------------------------- */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Every rule answers two questions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-md border p-3">
              <div className="mb-1 flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground">
                  1
                </span>
                <span className="font-medium">When does it fire?</span>
              </div>
              <p className="text-muted-foreground">
                Condition rows, and the condition formula. Both must pass — the
                formula is ANDed on top of the rows. In M1 this is the{" "}
                <code className="font-mono text-xs">imaPartID</code> /{" "}
                <code className="font-mono text-xs">immPartID</code> script.
              </p>
            </div>
            <div className="rounded-md border p-3">
              <div className="mb-1 flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground">
                  2
                </span>
                <span className="font-medium">What does it add?</span>
              </div>
              <p className="text-muted-foreground">
                The part, its revision, and the quantity. In M1 this is{" "}
                <code className="font-mono text-xs">immQuantityPerAssembly</code>{" "}
                and{" "}
                <code className="font-mono text-xs">imaPartRevisionID</code>.
              </p>
            </div>
          </div>
          <p className="rounded-md border-l-2 border-primary bg-muted/50 p-3 text-muted-foreground">
            <strong className="text-foreground">Condition rows:</strong> AND
            within a group, OR between groups — so{" "}
            <code className="font-mono text-xs">(A AND B) OR (C)</code>. A rule
            with no rows and no formula fires <em>always</em>.
          </p>
          <p className="rounded-md border-l-2 border-amber-500 bg-muted/50 p-3 text-muted-foreground">
            <strong className="text-foreground">Quantity formula wins.</strong>{" "}
            The Quantity box holds a fixed number, but whenever a quantity
            formula is set it overrides that number. A rule showing quantity 1
            with a formula of{" "}
            <code className="font-mono text-xs">sumWhere(...)</code> bills the
            formula&apos;s answer, not 1.
          </p>
        </CardContent>
      </Card>

      {/* ---- worked example ---------------------------------------------- */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            The configuration every example below uses
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-1.5">
            {WORKED_EXAMPLE.map(([k, v]) => (
              <Badge key={k} variant="outline" className="font-mono text-[11px]">
                {k} = {v}
              </Badge>
            ))}
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            Two induction loops (one new, one existing), four Elsema 2-button
            remotes in slot 2, and both radars on IXIO long stalk. Every{" "}
            <em>Result</em> below is the real answer for this configuration.
          </p>
        </CardContent>
      </Card>

      {/* ---- counting ----------------------------------------------------- */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Counting slots — for the &quot;when&quot;
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            <code className="font-mono text-xs">group(&quot;CMBACT&quot;)</code>{" "}
            means CMBACT1, CMBACT2, CMBACT3, CMBACT4 — every numbered slot that
            exists. Add a CMBACT6 later and these keep working, unlike M1&apos;s
            <code className="font-mono text-xs"> For i = 1 to 4</code>. A group
            that does not exist counts 0 rather than failing.
          </p>
        </CardHeader>
        <CardContent>
          <PresetTable rows={SLOT_PRESETS} />
          <p className="mt-3 text-sm text-muted-foreground">
            To turn any count into a condition, compare it:{" "}
            <code className="font-mono text-xs">
              countStartsWith(group(&quot;CMBACT&quot;), &quot;Induction Loop -
              &quot;) &gt; 0
            </code>
          </p>
        </CardContent>
      </Card>

      {/* ---- quantity ------------------------------------------------------ */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Working out the quantity — for the &quot;how many&quot;
          </CardTitle>
        </CardHeader>
        <CardContent>
          <PresetTable rows={QTY_PRESETS} />
        </CardContent>
      </Card>

      {/* ---- text ---------------------------------------------------------- */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Single fields and text</CardTitle>
        </CardHeader>
        <CardContent>
          <PresetTable rows={TEXT_PRESETS} />
        </CardContent>
      </Card>

      {/* ---- spreadsheet --------------------------------------------------- */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">In the exported spreadsheet</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p className="text-muted-foreground">
            Export CSV on the Rules tab writes every column the importer reads,
            so a round trip loses nothing. The two that hold the logic:
          </p>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[22%]">Column</TableHead>
                <TableHead>Holds</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell className="font-mono text-xs">
                  Quantity Formula
                </TableCell>
                <TableCell>
                  Qty per assembly. Overrides the Quantity column when set.
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-mono text-xs">
                  Condition Formula
                </TableCell>
                <TableCell>
                  The extra test, ANDed on top of the When column.
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-mono text-xs">When</TableCell>
                <TableCell>
                  The condition rows in readable form, e.g.{" "}
                  <code className="font-mono text-xs">
                    CHKHOLDOPEN is checked
                  </code>
                  .
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-mono text-xs">Unit</TableCell>
                <TableCell>
                  Labelling only — Per Door, Per Remote, Per Radar. It does not
                  change the maths.
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
          <p className="rounded-md border-l-2 border-destructive bg-muted/50 p-3 text-muted-foreground">
            <strong className="text-foreground">
              Importing replaces the whole set.
            </strong>{" "}
            Anything missing from the file is deleted. To change a few rows,
            edit them here instead of importing a short file.
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
