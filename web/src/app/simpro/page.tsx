"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronDown, Info, Layers, Loader2, Search } from "lucide-react";

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
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { JsonGrid } from "@/components/json-grid";
import { fetchSimproJob, searchSimproJobs } from "@/lib/simpro";
import type {
  SimproCostCentre,
  SimproJobDetail,
  SimproJobsResult,
} from "@/types/simpro";

function money(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return `$${n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export default function SimproPage() {
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
            <BreadcrumbPage>Simpro</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div>
        <h1 className="text-2xl font-bold tracking-tight">Simpro Jobs</h1>
        <p className="text-muted-foreground">
          Search a job and view its details and cost centres. Requests run
          server-side so your Simpro token stays safe.
        </p>
      </div>

      <JobLookup />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Job lookup
// ---------------------------------------------------------------------------

function JobLookup() {
  const [term, setTerm] = React.useState("");
  const [searching, setSearching] = React.useState(false);
  const [result, setResult] = React.useState<SimproJobsResult | null>(null);

  const [job, setJob] = React.useState<SimproJobDetail | null>(null);
  const [jobLoading, setJobLoading] = React.useState<string | number | null>(
    null
  );
  const [jobError, setJobError] = React.useState<string | null>(null);

  const search = async () => {
    setSearching(true);
    setJob(null);
    setJobError(null);
    try {
      setResult(await searchSimproJobs(term));
    } catch (err) {
      setResult({
        configured: true,
        ok: false,
        status: 0,
        jobs: [],
        error: err instanceof Error ? err.message : "Search failed",
      });
    } finally {
      setSearching(false);
    }
  };

  const openJob = async (id: string | number) => {
    setJobLoading(id);
    setJobError(null);
    setJob(null);
    try {
      const res = await fetchSimproJob(id);
      if (!res.configured) setJobError(res.error ?? "Simpro is not configured.");
      else if (!res.ok || !res.job) setJobError(res.error ?? "Could not load job.");
      else setJob(res.job);
    } catch (err) {
      setJobError(err instanceof Error ? err.message : "Could not load job.");
    } finally {
      setJobLoading(null);
    }
  };

  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            search();
          }}
        >
          <div className="min-w-[280px] flex-1 space-y-1.5">
            <label htmlFor="job-search" className="text-sm font-medium">
              Search jobs
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="job-search"
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                placeholder="Job number (e.g. 606849) or a keyword from the description…"
                className="pl-9"
              />
            </div>
          </div>
          <Button type="submit" disabled={searching}>
            {searching ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Search className="h-4 w-4" />
            )}
            Search
          </Button>
        </form>

        {result && !result.configured && (
          <div className="flex items-center gap-2 rounded-md border border-primary/30 bg-primary/5 px-4 py-3 text-sm">
            <Info className="h-4 w-4 shrink-0 text-primary" />
            <span>{result.error}</span>
          </div>
        )}

        {result && result.configured && result.error && (
          <div className="rounded-md border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            {result.error}
          </div>
        )}

        {result && result.configured && !result.error && (
          <div className="space-y-1.5">
            <p className="text-sm text-muted-foreground">
              {result.jobs.length} job{result.jobs.length === 1 ? "" : "s"} found
            </p>
            {result.jobs.length > 0 && (
              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-20">Job #</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Site</TableHead>
                      <TableHead>Stage</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="w-24" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {result.jobs.map((j) => (
                      <TableRow key={String(j.id)}>
                        <TableCell className="font-mono text-xs">{j.id}</TableCell>
                        <TableCell className="font-medium">{j.name ?? "—"}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {j.customer ?? "—"}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {j.site ?? "—"}
                        </TableCell>
                        <TableCell>
                          {j.stage ? <Badge variant="secondary">{j.stage}</Badge> : "—"}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {money(j.total)}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={jobLoading !== null}
                            onClick={() => openJob(j.id)}
                          >
                            {jobLoading === j.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              "Details"
                            )}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        )}

        {jobError && (
          <div className="rounded-md border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            {jobError}
          </div>
        )}

        {job && <JobDetail job={job} />}
      </CardContent>
    </Card>
  );
}

function JobDetail({ job }: { job: SimproJobDetail }) {
  const [showRaw, setShowRaw] = React.useState(false);
  const costCentres = job.sections.flatMap((s) => s.costCentres);
  const itemCount = costCentres.reduce((n, c) => n + c.items.length, 0);

  return (
    <div className="space-y-4 rounded-md border p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-semibold">
          Job #{job.id}
          {job.name ? ` — ${job.name}` : ""}
        </h2>
        {job.stage && <Badge variant="secondary">{job.stage}</Badge>}
        {job.type && <Badge variant="outline">{job.type}</Badge>}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Customer" value={job.customer} />
        <Field label="Site" value={job.site} />
        <Field label="Site Contact" value={job.siteContact} />
        <Field label="Job Total" value={money(job.total)} />
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-primary" />
          <h3 className="font-medium">
            Structure — {job.sections.length} section
            {job.sections.length === 1 ? "" : "s"}, {costCentres.length} cost
            centre{costCentres.length === 1 ? "" : "s"}, {itemCount} item
            {itemCount === 1 ? "" : "s"}
          </h3>
        </div>

        {costCentres.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No sections or cost centres returned for this job.
          </p>
        ) : (
          job.sections.map((section) => (
            <div key={String(section.id)} className="space-y-3">
              {job.sections.length > 1 && (
                <p className="text-sm font-semibold">
                  Section: {section.name || `#${section.id}`}
                </p>
              )}
              {section.costCentres.map((cc) => (
                <CostCentreCard key={String(cc.id)} cc={cc} />
              ))}
            </div>
          ))
        )}
      </div>

      <div>
        <button
          type="button"
          onClick={() => setShowRaw((v) => !v)}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronDown
            className={`h-4 w-4 transition-transform ${showRaw ? "rotate-180" : ""}`}
          />
          {showRaw ? "Hide" : "Show"} raw Simpro data
        </button>
        {showRaw && (
          <div className="mt-2 max-h-[420px] overflow-auto">
            <JsonGrid data={job.raw} />
          </div>
        )}
      </div>
    </div>
  );
}

function CostCentreCard({ cc }: { cc: SimproCostCentre }) {
  return (
    <div className="rounded-md border">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b bg-muted/40 px-4 py-2">
        <span className="font-medium">{cc.name ?? `Cost centre #${cc.id}`}</span>
        <span className="ml-auto text-sm text-muted-foreground">
          Sell{" "}
          <span className="font-medium text-foreground tabular-nums">
            {money(cc.total)}
          </span>
        </span>
        <span className="text-sm text-muted-foreground">
          Cost{" "}
          <span className="font-medium text-foreground tabular-nums">
            {money(cc.cost)}
          </span>
        </span>
      </div>
      {cc.items.length === 0 ? (
        <p className="px-4 py-3 text-sm text-muted-foreground">
          No items in this cost centre.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-28">Type</TableHead>
                <TableHead>Part No</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cc.items.map((it) => (
                <TableRow key={`${it.type}-${it.id}`}>
                  <TableCell>
                    <Badge variant="outline">{it.type}</Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {it.partNo ?? "—"}
                  </TableCell>
                  <TableCell>{it.name ?? "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {it.qty ?? "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {money(it.amount)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value?: string }) {
  return (
    <div className="space-y-0.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium">{value || "—"}</p>
    </div>
  );
}
