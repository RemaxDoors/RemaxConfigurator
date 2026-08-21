import { test, expect } from "@playwright/test";

/**
 * Read-only checks over the configurator admin screens.
 *
 * Nothing here creates, edits or deletes anything: the only databases worth
 * running against hold real pricing configuration, and a test that tidies up
 * after itself is one failed assertion away from not tidying up.
 *
 * Where a test needs specific data it stubs the API rather than depending on
 * what happens to be in the database that day.
 */

test.describe("catalog", () => {
  test("lists configurators and links into their tabs", async ({ page }) => {
    await page.route("**/api/config", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          source: "api",
          configurators: [
            {
              id: "RRD-MOVIDOR-TEMPLATE",
              name: "RRD Movidor",
              doorTypeFilter: "RRD",
              parameters: [
                { controlName: "CMBDOORMODEL", label: "Door Model", kind: "dropdown", options: [{ value: "EX35", label: "EX35" }] },
              ],
              defaults: [],
            },
          ],
          rules: [
            {
              id: "RRD-01",
              configuratorId: "RRD-MOVIDOR-TEMPLATE",
              name: "UPS 1kVA",
              category: "ASSEMBLY_UPGRADE",
              resultPartId: "EL-UPS-1KVAASS",
              quantity: "1",
              isActive: true,
              conditions: [],
            },
          ],
        }),
      })
    );
    await page.goto("/configurators");

    await expect(page.getByRole("heading", { name: "Configurators" })).toBeVisible();
    await expect(page.getByText("RRD Movidor")).toBeVisible();

    // An active rule with no condition and no formula applies to every quote.
    // It is invisible on the rules tab, so the catalog has to say it.
    await expect(page.getByText(/no condition/)).toBeVisible();
  });
});

test.describe("formula help", () => {
  test("documents each preset with a worked result", async ({ page }) => {
    await page.goto("/configurator-setup/help");

    await expect(
      page.getByRole("heading", { name: "Rules and formulas" })
    ).toBeVisible();

    // The three shapes every activation rule is built from.
    await expect(page.getByText(/countStartsWith\(group\("CMBACT"\)/).first()).toBeVisible();
    await expect(page.getByText(/countEquals\(group\("CMBRADAR"\)/).first()).toBeVisible();
    await expect(page.getByText(/sumWhere\(group\("CMBACT"\)/).first()).toBeVisible();

    // The trap worth documenting: the quantity formula beats the Quantity box.
    await expect(page.getByText(/Quantity formula wins/i)).toBeVisible();
  });

  test("explains the spreadsheet columns that hold the logic", async ({ page }) => {
    await page.goto("/configurator-setup/help");
    await expect(page.getByText("Quantity Formula", { exact: true })).toBeVisible();
    await expect(page.getByText("Condition Formula", { exact: true })).toBeVisible();
    // Importing replaces the whole set — the warning that follows from the
    // incident where a two-row file deleted fifty parameters.
    await expect(page.getByText(/replaces the whole set/i)).toBeVisible();
  });
});

test.describe("rules list", () => {
  test("shows a formula rule's real test, not 'Always'", async ({ page }) => {
    // describeConditions() returns "Always" for an empty condition list, so a
    // rule whose entire test lives in a formula used to claim it always fired.
    await page.route("**/api/config", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          source: "api",
          configurators: [
            {
              id: "RRD-MOVIDOR-TEMPLATE",
              name: "RRD Movidor",
              parameters: [],
              defaults: [],
            },
          ],
          rules: [
            {
              id: "RRD-46",
              configuratorId: "RRD-MOVIDOR-TEMPLATE",
              name: "Elsema 2 Channel Remote",
              category: "MATERIAL_UPGRADE",
              resultPartId: "RRD-ELREM2C",
              quantity: "1",
              isActive: true,
              conditions: [],
              conditionFormula:
                'sumWhere(group("CMBACT"), "Elsema Remote - 2", group("NUMREMOTEQTY")) > 0',
              quantityFormula:
                'sumWhere(group("CMBACT"), "Elsema Remote - 2", group("NUMREMOTEQTY"))',
            },
          ],
        }),
      })
    );
    await page.goto("/configurator-setup?id=RRD-MOVIDOR-TEMPLATE&tab=rules");

    await expect(page.getByText("Elsema 2 Channel Remote")).toBeVisible();
    await expect(page.getByText("Always")).toHaveCount(0);
    // Quantity must show the formula, not the stored "1".
    await expect(
      page.getByText(/sumWhere\(group\("CMBACT"\)/).first()
    ).toBeVisible();
  });
});

test.describe("deep links", () => {
  for (const tab of ["parameters", "rules", "defaults"]) {
    test(`?tab=${tab} opens that tab`, async ({ page }) => {
      await page.goto(`/configurator-setup?tab=${tab}`);
      await expect(
        page.getByRole("tab", { name: new RegExp(tab, "i") })
      ).toHaveAttribute("data-state", "active");
    });
  }
});
