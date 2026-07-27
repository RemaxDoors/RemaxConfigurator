"use client";

import * as React from "react";
import Link from "next/link";
import { Info, Pencil, Plus, Trash2 } from "lucide-react";

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
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { RuleEditorDialog } from "@/components/admin/rule-editor-dialog";
import { MOCK_RULES } from "@/lib/mock-rules";
import {
  CONFIGURATORS,
  RULE_CATEGORY_LABELS,
  describeConditions,
  type ConfiguratorRule,
  type RuleCategory,
} from "@/types/configurator-rule";

const SELECT_CLASS =
  "flex h-10 w-64 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

function categoryVariant(
  category: RuleCategory
): "default" | "secondary" | "outline" {
  if (category === "MATERIAL_DISCOUNT") return "outline";
  if (category === "BASE" || category === "INSTALLATION") return "secondary";
  return "default";
}

export default function ConfiguratorSetupPage() {
  const [rules, setRules] = React.useState<ConfiguratorRule[]>(MOCK_RULES);
  const [configuratorId, setConfiguratorId] = React.useState(
    CONFIGURATORS[0].id
  );
  const [editorOpen, setEditorOpen] = React.useState(false);
  const [editingRule, setEditingRule] = React.useState<ConfiguratorRule | null>(
    null
  );

  const visibleRules = rules.filter((r) => r.configuratorId === configuratorId);

  const handleSave = (rule: ConfiguratorRule) =>
    setRules((prev) => {
      const exists = prev.some((r) => r.id === rule.id);
      return exists
        ? prev.map((r) => (r.id === rule.id ? rule : r))
        : [...prev, rule];
    });

  const handleDelete = (id: string) =>
    setRules((prev) => prev.filter((r) => r.id !== id));

  const toggleActive = (id: string) =>
    setRules((prev) =>
      prev.map((r) => (r.id === id ? { ...r, isActive: !r.isActive } : r))
    );

  const openAdd = () => {
    setEditingRule(null);
    setEditorOpen(true);
  };

  const openEdit = (rule: ConfiguratorRule) => {
    setEditingRule(rule);
    setEditorOpen(true);
  };

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
            <BreadcrumbPage>Configurator Setup</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Configurator Setup
          </h1>
          <p className="text-muted-foreground">
            Add, edit and remove the rules that drive each configurator.
          </p>
        </div>
        <Button onClick={openAdd}>
          <Plus className="h-4 w-4" />
          Add rule
        </Button>
      </div>

      <div className="flex items-center gap-2 rounded-md border border-primary/30 bg-primary/5 px-4 py-3 text-sm">
        <Info className="h-4 w-4 shrink-0 text-primary" />
        <span>
          These rules currently mirror the hard-coded logic. Editing here changes
          local state only — persistence and admin-only access come with the
          backend and Microsoft sign-in.
        </span>
      </div>

      <div className="flex items-center gap-3">
        <label htmlFor="configurator" className="text-sm font-medium">
          Configurator
        </label>
        <select
          id="configurator"
          className={SELECT_CLASS}
          value={configuratorId}
          onChange={(e) => setConfiguratorId(e.target.value)}
        >
          {CONFIGURATORS.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Rule</TableHead>
                <TableHead>When</TableHead>
                <TableHead>Adds part</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-center">Active</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleRules.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="py-10 text-center text-muted-foreground"
                  >
                    No rules for this configurator yet. Click “Add rule”.
                  </TableCell>
                </TableRow>
              ) : (
                visibleRules.map((rule) => (
                  <TableRow key={rule.id}>
                    <TableCell className="font-medium">{rule.name}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {describeConditions(rule.conditions)}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {rule.resultPartId}
                    </TableCell>
                    <TableCell>
                      <Badge variant={categoryVariant(rule.category)}>
                        {RULE_CATEGORY_LABELS[rule.category]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {rule.quantity}
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex justify-center">
                        <Switch
                          checked={rule.isActive}
                          onCheckedChange={() => toggleActive(rule.id)}
                          aria-label={`Toggle ${rule.name}`}
                        />
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEdit(rule)}
                          aria-label="Edit rule"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive"
                          onClick={() => handleDelete(rule.id)}
                          aria-label="Delete rule"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <RuleEditorDialog
        open={editorOpen}
        onOpenChange={setEditorOpen}
        configuratorId={configuratorId}
        rule={editingRule}
        onSave={handleSave}
      />
    </div>
  );
}
