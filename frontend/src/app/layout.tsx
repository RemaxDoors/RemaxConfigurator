import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { cookies } from "next/headers";
import "./globals.css";

import { SiteHeader } from "@/components/shell/site-header";
import { SiteFooter } from "@/components/shell/site-footer";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { ThemeScript } from "@/components/theme/theme-script";
import { THEME_COOKIE, type Theme } from "@/lib/theme";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: {
    default: "Remax ConfigHub",
    template: "%s | Remax ConfigHub",
  },
  description: "Rapid door configurator and estimator for the REMAX sales team.",
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieTheme = (cookies().get(THEME_COOKIE)?.value as Theme) ?? "system";
  // Server can only apply an explicit choice; "system" is resolved by ThemeScript.
  const htmlClass = cookieTheme === "dark" ? "dark" : "";

  return (
    <html lang="en" className={htmlClass} suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeScript />
        <ThemeProvider initialTheme={cookieTheme}>
          <div className="flex min-h-screen flex-col">
            <SiteHeader />
            <main className="flex-1">{children}</main>
            <SiteFooter />
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
