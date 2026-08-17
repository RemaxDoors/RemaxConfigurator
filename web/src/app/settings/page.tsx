"use client";

import Link from "next/link";
import {
  Check,
  Monitor,
  Moon,
  ShieldCheck,
  SlidersHorizontal,
  Sun,
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
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useTheme } from "@/components/theme/theme-provider";
import { M1FieldMapping } from "@/components/settings/m1-field-mapping";
import { cn } from "@/lib/utils";
import { CONFIGURATOR_SETUP_HREF } from "@/lib/navigation";
import type { Theme } from "@/lib/theme";

const THEME_OPTIONS: { value: Theme; label: string; icon: React.ElementType }[] =
  [
    { value: "light", label: "Light", icon: Sun },
    { value: "dark", label: "Dark", icon: Moon },
    { value: "system", label: "System", icon: Monitor },
  ];

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="container max-w-3xl space-y-6 py-6">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href="/">Home</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Settings</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Manage your appearance, account and administration preferences.
        </p>
      </div>

      {/* Appearance */}
      <Card>
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
          <CardDescription>
            Choose your theme. Your choice is saved in a cookie and remembered
            next time.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-3">
            {THEME_OPTIONS.map((option) => {
              const OptionIcon = option.icon;
              const selected = theme === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setTheme(option.value)}
                  className={cn(
                    "relative flex flex-col items-start gap-3 rounded-lg border p-4 text-left transition-colors hover:bg-accent",
                    selected ? "border-primary ring-1 ring-primary" : "border-border"
                  )}
                >
                  {selected && (
                    <Check className="absolute right-3 top-3 h-4 w-4 text-primary" />
                  )}
                  <OptionIcon className="h-5 w-5 text-muted-foreground" />
                  <span className="text-sm font-medium">{option.label}</span>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Account / Microsoft auth (placeholder) */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CardTitle>Account</CardTitle>
            <Badge variant="secondary">Coming soon</Badge>
          </div>
          <CardDescription>
            Sign-in will use your Microsoft (Entra ID) work account once
            authentication is enabled.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-start gap-3">
          <Button variant="outline" disabled>
            <ShieldCheck className="h-4 w-4" />
            Sign in with Microsoft
          </Button>
          <p className="text-sm text-muted-foreground">
            Microsoft handles the login securely — the app only receives your
            identity and role (e.g. Engineering / Admin). No passwords are
            stored here.
          </p>
        </CardContent>
      </Card>

      {/* Administration */}
      <Card>
        <CardHeader>
          <CardTitle>Administration</CardTitle>
          <CardDescription>
            Tools for admin users (Engineering). Access will be restricted once
            roles are enabled.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline">
            <Link href={CONFIGURATOR_SETUP_HREF}>
              <SlidersHorizontal className="h-4 w-4" />
              Configurator Setup — rules
            </Link>
          </Button>
        </CardContent>
      </Card>

      {/* M1 field mapping */}
      <M1FieldMapping />
    </div>
  );
}
