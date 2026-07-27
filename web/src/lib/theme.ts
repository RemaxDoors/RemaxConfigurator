export type Theme = "light" | "dark" | "system";

export const THEME_COOKIE = "theme";
/** 1 year */
export const THEME_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export const THEMES: { value: Theme; label: string }[] = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "System" },
];
