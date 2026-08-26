import { test, expect } from "@playwright/test";

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
    await page.goto("/quote/new");
    await page.getByRole("button", { name: /Sales checklist/ }).click();

    await page.getByLabel("Project Name").fill("Coles Truganina D07");
    await page.getByLabel("Sales Person").fill("JCO");

    // Two of four now pass, so the count drops rather than the button
    // becoming available while the customer is still unset.
    await expect(
      page.getByRole("button", { name: /Sales checklist — 2 outstanding/ })
    ).toBeVisible();
  });

  test("a project name over 50 characters fails the check", async ({ page }) => {
    await page.goto("/quote/new");
    await page.getByRole("button", { name: /Sales checklist/ }).click();

    // uqmpProjectName is nvarchar(50) and M1 already holds values at exactly
    // 50, so anything longer has nowhere to go.
    await page.getByLabel("Project Name").fill("x".repeat(51));
    await expect(page.getByText(/Too long — 51 characters/)).toBeVisible();
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
