import { test, expect } from "@playwright/test";
import { QUOTER_ID, stubLookups, stubLookupsUnavailable } from "./support/stubs";

/**
 * The sales checklist gates a quote leaving "Quote In Progress".
 *
 * Its four items are exactly the fields that map to NOT NULL columns on
 * dbo.Quotes, so a quote that fails them cannot be written back to M1 — the
 * point is to say so while the salesperson still has the fields on screen.
 */
test.describe("quote header", () => {
  test("a new quote starts In Progress with the checklist outstanding", async ({
    page,
  }) => {
    await page.goto("/quote/new");

    await expect(page.getByLabel("Quote status")).toHaveValue(
      "Quote In Progress"
    );
    // A brand new quote has no customer, location, project name or quoter.
    await expect(
      page.getByRole("button", { name: /Sales checklist — 4 outstanding/ })
    ).toBeVisible();
  });

  test("the button names what is missing rather than going dead", async ({
    page,
  }) => {
    await page.goto("/quote/new");
    // Pressing it opens the list instead of silently doing nothing — a
    // disabled button that will not say why is what this replaces.
    await page
      .getByRole("button", { name: /Sales checklist/ })
      .click();

    for (const label of [
      "Customer selected",
      "Location selected",
      "Project name filled",
      "Sales person selected",
    ]) {
      await expect(page.getByText(label)).toBeVisible();
    }
  });

  test("filling project name and sales person ticks those two", async ({
    page,
  }) => {
    await stubLookups(page);
    await page.goto("/quote/new");
    await page.getByRole("button", { name: /Sales checklist/ }).click();

    await page.getByLabel("Project Name").fill("Coles Truganina D07");
    // Exact: when M1 is unreachable a manual-entry box appears beside the
    // dropdown, and its label starts with the same words.
    await page
      .getByLabel("Sales Person", { exact: true })
      .selectOption(QUOTER_ID);

    // Two of four now pass, so the count drops rather than the button
    // becoming available while the customer is still unset.
    await expect(
      page.getByRole("button", { name: /Sales checklist — 2 outstanding/ })
    ).toBeVisible();
  });

  test("project name is capped at what M1 will hold", async ({ page }) => {
    await page.goto("/quote/new");

    // uqmpProjectName is nvarchar(50) and M1 already holds values at exactly
    // 50. The field now prevents the overrun rather than warning after the
    // fact, so 51 characters cannot be typed in the first place.
    await page.getByLabel("Project Name").fill("x".repeat(51));
    await expect(page.getByLabel("Project Name")).toHaveValue("x".repeat(50));
    await expect(page.getByText("50/50")).toBeVisible();

    // The length check in buildChecklist still stands for values that arrive
    // from somewhere other than this input — a quote loaded out of M1, say.
    const { buildChecklist } = await import("../src/components/quote/sales-checklist");
    const items = buildChecklist({
      customer: { id: "C1" } as never,
      shipToLocation: { id: "L1" } as never,
      projectName: "x".repeat(51),
      salesPerson: "JCO",
    });
    const nameCheck = items.find((i) => i.label === "Project name filled")!;
    expect(nameCheck.ok).toBe(false);
    expect(nameCheck.hint).toContain("51 characters");
  });

  test("an M1 outage does not block quoting", async ({ page }) => {
    // The regression this guards: the dropdown used to disable itself while
    // loading and stay disabled on failure. Sales Person is required by the
    // checklist, so that made an M1 outage a total stop on quoting.
    await stubLookupsUnavailable(page);
    await page.goto("/quote/new");

    const select = page.getByLabel("Sales Person", { exact: true });
    await expect(select).toBeEnabled();

    // And there is a way to supply the id by hand, which the checklist accepts.
    const manual = page.getByLabel("Sales Person (manual entry)");
    await expect(manual).toBeVisible();
    await manual.fill(QUOTER_ID);
    await page.getByLabel("Project Name").fill("Coles Truganina D07");
    await expect(
      page.getByRole("button", { name: /Sales checklist — 2 outstanding/ })
    ).toBeVisible();
  });

  test("status offers exactly the three sales statuses", async ({ page }) => {
    await page.goto("/quote/new");
    const options = await page
      .getByLabel("Quote status")
      .locator("option")
      .allTextContents();
    expect(options).toEqual([
      "Quote In Progress",
      "Quote Sent to Customer",
      "Quote Won",
    ]);
  });
});
