"use client";

import * as React from "react";
import { Blinds, Check, ClipboardCheck, DoorOpen, Wrench } from "lucide-react";

export interface SidebarItem {
  key: string;
  label: string;
  /** "door" | "summary" | "curtain" | "installation" */
  group: string;
  /** Marked when the screen has been visited / has values. */
  complete?: boolean;
}

const ICONS: Record<string, React.ElementType> = {
  curtain: Blinds,
  installation: Wrench,
  summary: ClipboardCheck,
  door: DoorOpen,
};

/**
 * Left rail for the configurator: door steps first, then the sub-configurators
 * selected for this line. One click opens that screen — no nested accordions.
 */
export function ConfiguratorSidebar({
  items,
  activeKey,
  onSelect,
}: {
  items: SidebarItem[];
  activeKey: string;
  onSelect: (key: string) => void;
}) {
  const doorSteps = items.filter((i) => i.group === "door");
  const extras = items.filter((i) => i.group === "curtain" || i.group === "installation");
  const summary = items.filter((i) => i.group === "summary");

  const renderItem = (item: SidebarItem, index?: number) => {
    const active = item.key === activeKey;
    const Icon = ICONS[item.group];
    return (
      <button
        key={item.key}
        type="button"
        onClick={() => onSelect(item.key)}
        aria-current={active ? "step" : undefined}
        className={`flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm transition-colors ${
          active
            ? "bg-primary/10 font-medium text-primary"
            : "text-muted-foreground hover:bg-accent hover:text-foreground"
        }`}
      >
        {item.group === "door" ? (
          <span
            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[11px] ${
              active
                ? "border-primary bg-primary text-primary-foreground"
                : item.complete
                  ? "border-primary/40 text-primary"
                  : "border-border"
            }`}
          >
            {item.complete && !active ? (
              <Check className="h-3 w-3" />
            ) : (
              (index ?? 0) + 1
            )}
          </span>
        ) : (
          Icon && <Icon className="h-4 w-4 shrink-0" />
        )}
        <span className="truncate">{item.label}</span>
      </button>
    );
  };

  return (
    <nav className="space-y-4" aria-label="Configurator screens">
      <div className="space-y-0.5">
        <p className="px-2.5 pb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Door
        </p>
        {doorSteps.map((item, i) => renderItem(item, i))}
      </div>

      {extras.length > 0 && (
        <div className="space-y-0.5">
          <p className="px-2.5 pb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Extensions
          </p>
          {extras.map((item) => renderItem(item))}
        </div>
      )}

      {summary.length > 0 && (
        <div className="space-y-0.5 border-t pt-3">
          {summary.map((item) => renderItem(item))}
        </div>
      )}
    </nav>
  );
}
