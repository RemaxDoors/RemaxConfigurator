/**
 * Small UI preferences set on the maintenance side.
 *
 * Stored in localStorage, so this is per browser rather than per company. That
 * is the right weight for "show me the raw field while we are still proving it
 * out" and the wrong weight for a policy everyone must follow — if one of these
 * ever needs to apply to the whole team it belongs in uCfg, not here.
 *
 * Every read is guarded: localStorage throws in private windows and in some
 * embedded contexts, and a preference is never worth breaking a page over.
 */

export const SHOW_UPGRADE_OVERRIDE_FIELD = "remax.showUpgradeOverrideField";

export function readPref(key: string, fallback: boolean): boolean {
  try {
    const raw = window.localStorage.getItem(key);
    return raw === null ? fallback : raw === "1";
  } catch {
    return fallback;
  }
}

export function writePref(key: string, value: boolean): void {
  try {
    window.localStorage.setItem(key, value ? "1" : "0");
    // Same-tab listeners: the storage event only fires in OTHER tabs, so a
    // toggle would not reach a panel on the same page without this.
    window.dispatchEvent(new CustomEvent("remax-pref", { detail: { key, value } }));
  } catch {
    /* preference not persisted — not worth surfacing */
  }
}

/**
 * Subscribe to a preference, in this tab and in others.
 *
 * Not a hook despite being used from one -- it takes no React state and
 * returns an unsubscribe, so naming it use* only confused the linter and the
 * reader.
 */
export function subscribePref(
  key: string,
  onChange: (value: boolean) => void
): () => void {
  const local = (e: Event) => {
    const d = (e as CustomEvent<{ key: string; value: boolean }>).detail;
    if (d?.key === key) onChange(d.value);
  };
  const cross = (e: StorageEvent) => {
    if (e.key === key) onChange(e.newValue === "1");
  };
  window.addEventListener("remax-pref", local);
  window.addEventListener("storage", cross);
  return () => {
    window.removeEventListener("remax-pref", local);
    window.removeEventListener("storage", cross);
  };
}
