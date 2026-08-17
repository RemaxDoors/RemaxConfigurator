"use client";

import * as React from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  RefreshCw,
  XCircle,
} from "lucide-react";

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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface Check {
  name: string;
  ok: boolean;
  ms: number;
  detail?: string;
  error?: string;
}
interface CfgCount {
  id: string;
  name: string;
  parameters: number;
  options: number;
  rules: number;
  defaults: number;
  validations: number;
}
interface Warning {
  kind: string;
  message: string;
}
interface Endpoint {
  method: string;
  path: string;
  summary: string;
  description: string;
  tags: string[];
  responses: string[];
}

const METHOD_TONE: Record<string, string> = {
  GET: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
  POST: "bg-green-600/10 text-green-700 dark:text-green-400",
  PUT: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  DELETE: "bg-destructive/10 text-destructive",
};

export default function StatusPage() {
  const [health, setHealth] = React.useState<{
    ok: boolean;
    checks: Check[];
    configurators: CfgCount[];
    warnings: Warning[];
  } | null>(null);
  const [endpoints, setEndpoints] = React.useState<Endpoint[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [checkedAt, setCheckedAt] = React.useState<string>("");

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const [h, e] = await Promise.all([
        fetch("/api/status", { cache: "no-store" }).then((r) => r.json()),
        fetch("/api/status/endpoints", { cache: "no-store" }).then((r) => r.json()),
      ]);
      setHealth(h);
      setEndpoints(e.endpoints ?? []);
      setCheckedAt(new Date().toLocaleTimeString());
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  const grouped = endpoints.reduce<Record<string, Endpoint[]>>((acc, e) => {
    const tag = e.tags[0] ?? "other";
    (acc[tag] ??= []).push(e);
    return acc;
  }, {});

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
            <BreadcrumbPage>Status</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">System status</h1>
          <p className="text-muted-foreground">
            Health of the app, the API and both databases — plus the API reference.
          </p>
        </div>
        <Button variant="outline" onClick={load} disabled={loading}>
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          Refresh
        </Button>
      </div>

      {/* Health checks */}
      <div className="grid gap-3 sm:grid-cols-3">
        {(health?.checks ?? []).map((c) => (
          <div
            key={c.name}
            className={`rounded-lg border p-3 ${
              c.ok ? "" : "border-destructive/40 bg-destructive/5"
            }`}
          >
            <div className="flex items-center gap-2">
              {c.ok ? (
                <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
              ) : (
                <XCircle className="h-4 w-4 text-destructive" />
              )}
              <span className="text-sm font-medium">{c.name}</span>
              <span className="ml-auto text-xs text-muted-foreground tabular-nums">
                {c.ms}ms
              </span>
            </div>
            <p
              className={`mt-1 text-xs ${
                c.ok ? "text-muted-foreground" : "text-destructive"
              }`}
            >
              {c.detail ?? c.error}
            </p>
          </div>
        ))}
        {!health && loading && (
          <p className="text-sm text-muted-foreground">Checking…</p>
        )}
      </div>
      {checkedAt && (
        <p className="-mt-3 text-xs text-muted-foreground">
          Last checked {checkedAt}
        </p>
      )}

      {/* Configuration data */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Configurator</TableHead>
                <TableHead className="text-right">Parameters</TableHead>
                <TableHead className="text-right">Options</TableHead>
                <TableHead className="text-right">Rules</TableHead>
                <TableHead className="text-right">Defaults</TableHead>
                <TableHead className="text-right">Validations</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(health?.configurators ?? []).map((c) => (
                <TableRow key={c.id}>
                  <TableCell>
                    <span className="font-medium">{c.name}</span>
                    <code className="ml-2 text-xs text-muted-foreground">{c.id}</code>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{c.parameters}</TableCell>
                  <TableCell className="text-right tabular-nums">{c.options}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {c.rules === 0 ? (
                      <span className="text-amber-600 dark:text-amber-400">0</span>
                    ) : (
                      c.rules
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{c.defaults}</TableCell>
                  <TableCell className="text-right tabular-nums">{c.validations}</TableCell>
                </TableRow>
              ))}
              {(health?.configurators ?? []).length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                    No configuration data — is the config database reachable?
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Warnings */}
      {(health?.warnings ?? []).length > 0 && (
        <div className="space-y-1.5">
          <h2 className="flex items-center gap-2 text-sm font-medium">
            <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            Configuration warnings ({health!.warnings.length})
          </h2>
          <div className="divide-y rounded-md border">
            {health!.warnings.map((w, i) => (
              <p key={i} className="px-3 py-1.5 text-sm">
                <Badge variant="outline" className="mr-2">
                  {w.kind}
                </Badge>
                {w.message}
              </p>
            ))}
          </div>
        </div>
      )}

      {/* API reference */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">
          API reference{" "}
          <span className="text-sm font-normal text-muted-foreground">
            ({endpoints.length} endpoints)
          </span>
        </h2>
        {Object.entries(grouped).map(([tag, list]) => (
          <div key={tag}>
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {tag}
            </p>
            <div className="divide-y overflow-hidden rounded-md border">
              {list.map((e) => (
                <div
                  key={`${e.method}-${e.path}`}
                  className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm"
                >
                  <span
                    className={`shrink-0 rounded px-1.5 py-0.5 font-mono text-xs font-medium ${
                      METHOD_TONE[e.method] ?? "bg-muted"
                    }`}
                  >
                    {e.method}
                  </span>
                  <code className="shrink-0 font-mono text-xs">{e.path}</code>
                  <span className="min-w-0 flex-1 truncate text-muted-foreground">
                    {e.summary || e.description}
                  </span>
                  <span className="shrink-0 font-mono text-xs text-muted-foreground">
                    {e.responses.join(" · ")}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
        {endpoints.length === 0 && !loading && (
          <p className="text-sm text-muted-foreground">
            Endpoint list unavailable — the API is not reachable.
          </p>
        )}
      </div>
    </div>
  );
}
