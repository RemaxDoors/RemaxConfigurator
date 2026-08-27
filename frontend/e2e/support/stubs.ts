import type { Page } from "@playwright/test";

/**
 * Shared route stubs.
 *
 * The rest of the suite already stubs the API rather than depending on what
 * happens to be in the database that day; the quote header specs were the
 * exception, and they hard-depended on M1 being reachable to populate the
 * Sales Person dropdown. That made them unrunnable on a CI runner, which has
 * no M1 and no VNet to reach one.
 *
 * Stubbing keeps every assertion exactly as strict — the checklist still has
 * to see a real selection — while removing the dependency on a database being
 * up and containing a particular employee.
 */

/** Ids used by the specs. Kept here so a rename is a one-line change. */
export const QUOTER_ID = "JCO";
export const LEAD_SOURCE_ID = "ARCH";

export async function stubLookups(page: Page) {
  await page.route("**/api/m1/lookups", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        leadSources: [
          { id: LEAD_SOURCE_ID, name: "Architect" },
          { id: "REPEAT", name: "Repeat Customer" },
        ],
        quoters: [
          { id: QUOTER_ID, name: "J Connor" },
          { id: "MSM", name: "M Smith" },
        ],
      }),
    })
  );
}

/**
 * The other half of the fallback: M1 down.
 *
 * The header must still let a quote be written — the dropdown stays enabled
 * and a manual entry box appears beside it — so this is worth asserting
 * rather than only ever testing the happy path.
 */
export async function stubLookupsUnavailable(page: Page) {
  await page.route("**/api/m1/lookups", (route) =>
    route.fulfill({
      status: 502,
      contentType: "application/json",
      body: JSON.stringify({ error: "M1 unreachable" }),
    })
  );
}
