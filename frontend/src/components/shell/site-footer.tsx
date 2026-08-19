export function SiteFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t bg-muted/30">
      <div className="container flex flex-col items-center justify-between gap-2 py-6 text-sm text-muted-foreground sm:flex-row">
        <p>
          &copy; {year} RemaxDoors. All rights reserved.
        </p>
        <p className="flex items-center gap-1.5">
          This is a{" "}
          <span className="font-semibold text-primary">RemaxDoors</span>{" "}
          product.
        </p>
      </div>
    </footer>
  );
}
