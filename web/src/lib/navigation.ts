/**
 * Central navigation config — used by both the desktop nav and the mobile
 * hamburger menu so they never drift apart.
 */

export interface NavItem {
  label: string;
  href: string;
}

export const PRIMARY_NAV: NavItem[] = [
  { label: "Home", href: "/" },
  { label: "Quotes", href: "/#quotes" },
  { label: "Orders", href: "/#orders" },
  { label: "M1", href: "/#m1" },
  { label: "Simpro", href: "/#simpro" },
];

export const NEW_QUOTE_HREF = "/quote/new";
export const SETTINGS_HREF = "/settings";
export const CONFIGURATOR_SETUP_HREF = "/configurator-setup";

/** Secondary links surfaced in the mobile menu (and the settings page). */
export const SECONDARY_NAV: NavItem[] = [
  { label: "Configurator Setup", href: CONFIGURATOR_SETUP_HREF },
  { label: "Settings", href: SETTINGS_HREF },
];
