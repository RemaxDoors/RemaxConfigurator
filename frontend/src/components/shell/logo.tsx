import Link from "next/link";
import { DoorOpen } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Company logo / wordmark. Clicking it returns to the home page.
 * This is a placeholder wordmark — drop the real brand asset in
 * `public/logo.svg` and swap the icon block for an <Image> when ready.
 */
export function Logo({ className }: { className?: string }) {
  return (
    <Link
      href="/"
      aria-label="Remax ConfigHub — go to home"
      className={cn(
        "group inline-flex items-center gap-2.5 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        className
      )}
    >
      <span className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-primary-foreground shadow-sm transition-transform group-hover:scale-105">
        <DoorOpen className="h-5 w-5" />
      </span>
      <span className="flex flex-col leading-none">
        <span className="text-base font-bold tracking-tight text-foreground">
          Remax<span className="text-primary">ConfigHub</span>
        </span>
        <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
          Remax Products
        </span>
      </span>
    </Link>
  );
}
