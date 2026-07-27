"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Building2,
  Contact,
  FileText,
  Info,
  PackageSearch,
  Plus,
  Search,
  Users,
  Wrench,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NEW_QUOTE_HREF } from "@/lib/navigation";

interface LauncherAction {
  label: string;
  icon: React.ElementType;
}

interface LauncherBox {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  actions: LauncherAction[];
}

const BOXES: LauncherBox[] = [
  {
    id: "quotes",
    title: "Quotes",
    description: "Start a new quote or reopen an existing one.",
    icon: FileText,
    actions: [{ label: "Search existing quotes", icon: Search }],
  },
  {
    id: "orders",
    title: "Orders",
    description: "Look up sales orders across M1.",
    icon: PackageSearch,
    actions: [
      { label: "Search orders", icon: Search },
      { label: "Search M1 sales orders", icon: Search },
    ],
  },
  {
    id: "m1",
    title: "M1 Records",
    description: "Find customers held in M1.",
    icon: Building2,
    actions: [{ label: "Search M1 customers", icon: Users }],
  },
  {
    id: "simpro",
    title: "Simpro",
    description: "Search jobs, customers and contacts in Simpro.",
    icon: Wrench,
    actions: [
      { label: "Search Simpro jobs", icon: Search },
      { label: "Search Simpro customers", icon: Users },
      { label: "Search Simpro contacts", icon: Contact },
    ],
  },
];

export default function HomePage() {
  const router = useRouter();
  const [quoteQuery, setQuoteQuery] = React.useState("");
  const [notice, setNotice] = React.useState<string | null>(null);

  const openQuote = () => {
    const id = quoteQuery.trim();
    if (id) router.push(`/quote/${encodeURIComponent(id)}`);
  };

  const comingSoon = (label: string) =>
    setNotice(`${label} — the search backend isn't wired up yet (coming next).`);

  return (
    <div className="container space-y-8 py-8">
      {/* Hero */}
      <section className="flex flex-col items-start justify-between gap-4 rounded-xl border bg-card p-6 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            What would you like to do?
          </h1>
          <p className="mt-1 text-muted-foreground">
            Create a new quote, or search existing records across M1 and Simpro.
          </p>
        </div>
        <Button asChild size="lg">
          <Link href={NEW_QUOTE_HREF}>
            <Plus className="h-5 w-5" />
            Add new quote
          </Link>
        </Button>
      </section>

      {notice && (
        <div className="flex items-center gap-2 rounded-md border border-primary/30 bg-primary/5 px-4 py-3 text-sm">
          <Info className="h-4 w-4 shrink-0 text-primary" />
          <span>{notice}</span>
          <button
            type="button"
            className="ml-auto text-muted-foreground hover:text-foreground"
            onClick={() => setNotice(null)}
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* 4 boxes */}
      <section className="grid gap-4 sm:grid-cols-2">
        {BOXES.map((box) => {
          const BoxIcon = box.icon;
          return (
            <Card key={box.id} id={box.id} className="flex flex-col scroll-mt-20">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <BoxIcon className="h-5 w-5" />
                  </span>
                  <div>
                    <CardTitle>{box.title}</CardTitle>
                    <CardDescription>{box.description}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="mt-auto space-y-2">
                {/* Quotes box gets a live "open by id" field */}
                {box.id === "quotes" && (
                  <div className="flex gap-2">
                    <Input
                      value={quoteQuery}
                      onChange={(e) => setQuoteQuery(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && openQuote()}
                      placeholder="Quote ID or customer…"
                    />
                    <Button
                      variant="secondary"
                      onClick={openQuote}
                      disabled={!quoteQuery.trim()}
                    >
                      Open
                    </Button>
                  </div>
                )}

                {box.actions.map((action) => {
                  const ActionIcon = action.icon;
                  return (
                    <button
                      key={action.label}
                      type="button"
                      onClick={() => comingSoon(action.label)}
                      className="group flex w-full items-center gap-3 rounded-md border px-3 py-2.5 text-left text-sm font-medium transition-colors hover:border-primary/40 hover:bg-accent"
                    >
                      <ActionIcon className="h-4 w-4 text-muted-foreground" />
                      {action.label}
                      <ArrowRight className="ml-auto h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                    </button>
                  );
                })}
              </CardContent>
            </Card>
          );
        })}
      </section>
    </div>
  );
}
