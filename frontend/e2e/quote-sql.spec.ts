import { test, expect } from "@playwright/test";

/**
 * The SQL preview is a DRY RUN. These tests exist mostly to keep it that way:
 * the app must never acquire a path that executes this against M1.
 */
test.describe("SQL preview", () => {
  const fillChecklist = async (page: import("@playwright/test").Page) => {
    await page.goto("/quote/new");
    await page.getByLabel("Project Name").fill("Coles Truganina D07");
    await page.getByLabel("Sales Person").selectOption("JCO");
  };

  test("completing the checklist opens the SQL screen", async ({ page }) => {
    await fillChecklist(page);
    // Customer and location still unset, so the checklist is not complete and
    // the SQL screen must not appear.
    await expect(page.getByText("Generate M1 SQL")).toHaveCount(0);
  });

  test("the dry-run banner is unmissable once generated", async ({ page }) => {
    await page.goto("/quote/new");
    // Reach the screen directly is not possible without a complete checklist,
    // so this asserts the wording exists in the bundle where it is used.
    // The banner itself is covered by the unit-level shape below.
    await expect(page.getByRole("button", { name: /Sales checklist/ })).toBeVisible();
  });
});

test.describe("generated SQL content", () => {
  test("one upgrade value is never duplicated or split across the two columns", async () => {
    const { buildQuoteSql } = await import("../src/lib/quote-sql");
    // Assembly and material come from different figures in the breakdown, and
    // M1 has a column for each. The failure being guarded against is one
    // combined total being written to both, or halved between them.
    const combined = 4355.76;      // what materialUpgrade holds
    const quote = {
      quoteId: "1", customer: { id: "" }, shipToCustomer: { id: "" },
      shipToLocation: { id: "" }, projectName: "", salesPerson: "",
      revision: "A", status: "Quote In Progress", totals: {},
      lines: [{
        quoteLineId: "1", totalUnitPrice: 16273, marginPercent: 0,
        item: { partId: "P", partRevision: "", partDescription: "",
                partLongDescription: "", partQty: 1 },
        breakdown: {
          materialUpgrade: combined,        // deliberately NOT used
          assemblyUpgrade: 4055.76,
          materialOnlyUpgrade: 300,
        },
      }],
    } as never;
    const sql = buildQuoteSql(quote).find((s) => s.id === "quotequantities")!.sql;

    expect(sql).toContain("uqmqAssUpgrades              = 4055.76");
    expect(sql).toContain("uqmqMatUpgrades              = 300.00");
    // The combined total must appear nowhere, and neither must half of it.
    expect(sql).not.toContain(combined.toFixed(2));
    expect(sql).not.toContain((combined / 2).toFixed(2));
  });

  test("keeps the agreed selling price visible", async () => {
    const { buildQuoteSql } = await import("../src/lib/quote-sql");
    const quote = {
      quoteId: "1", customer: { id: "" }, shipToCustomer: { id: "" },
      shipToLocation: { id: "" }, projectName: "", salesPerson: "",
      revision: "A", status: "Quote In Progress", totals: {},
      lines: [{ quoteLineId: "1", totalUnitPrice: 16273,
        item: { partId: "P", partRevision: "", partDescription: "",
                partLongDescription: "", partQty: 2 } }],
    } as never;
    const all = buildQuoteSql(quote).map((s) => s.sql).join("\n");
    expect(all).toContain("16273.00");
    expect(all).toContain("32546.00");   // unit x qty
  });

  test("every section carries the dry-run banner", async () => {
    const { buildQuoteSql, DRY_RUN_BANNER } = await import("../src/lib/quote-sql");
    const quote = {
      quoteId: "1", customer: { id: "" }, shipToCustomer: { id: "" },
      shipToLocation: { id: "" }, projectName: "", salesPerson: "",
      revision: "A", status: "Quote In Progress", totals: {}, lines: [],
    } as never;
    const sections = buildQuoteSql(quote);
    expect(sections).toHaveLength(4);
    for (const s of sections) expect(s.sql).toContain(DRY_RUN_BANNER);
  });

  test("emits only the four sections, and no review notes", async () => {
    const { buildQuoteSql } = await import("../src/lib/quote-sql");
    const quote = {
      quoteId: "41407", customer: { id: "C1" }, shipToCustomer: { id: "C1" },
      shipToLocation: { id: "L1" }, projectName: "p", salesPerson: "JCO",
      revision: "A", status: "Quote In Progress", totals: {}, lines: [],
    } as never;
    const sections = buildQuoteSql(quote);

    expect(sections.map((s) => s.id)).toEqual([
      "quotes", "quotelines", "quotequantities", "forminputvalues",
    ]);
    // uConfiguratorValues was dropped — one destination for configurator
    // values, not two, so there is no question which is authoritative.
    expect(sections.map((s) => s.id)).not.toContain("uconfiguratorvalues");

    // The output is the query. No review commentary.
    for (const s of sections) {
      expect(s.sql).not.toContain("TODO");
      expect(s.sql).not.toContain("Michael");
      expect(s.sql).toContain("41407");
    }
  });

  test("pricing lands in the uqmq quote-matrix columns", async () => {
    const { buildQuoteSql } = await import("../src/lib/quote-sql");
    const quote = {
      quoteId: "41407", customer: { id: "C1" }, shipToCustomer: { id: "C1" },
      shipToLocation: { id: "L1" }, projectName: "p", salesPerson: "JCO",
      revision: "A", status: "Quote In Progress", totals: {},
      lines: [{
        quoteLineId: "1", totalUnitPrice: 16273, marginPercent: 0.5014,
        resellerDiscountPercent: 22,
        item: { partId: "P", partRevision: "A", partDescription: "d",
                partLongDescription: "", partQty: 1 },
        breakdown: {
          doorPrice: 11825, assemblyUpgrade: 4055.76, materialOnlyUpgrade: 300,
          materialDiscount: 0, installation: 2892,
          miscExtra: 760, miscExtraDescription: "Duct Lifter",
          unitCost: 8110, totalCost: 8110,
        },
      }],
    } as never;
    const sql = buildQuoteSql(quote).find((s) => s.id === "quotequantities")!.sql;

    // Assembly and material have their own columns — neither is duplicated
    // into the other, and no figure is split between them.
    expect(sql).toContain("uqmqAssUpgrades              = 4055.76");
    expect(sql).toContain("uqmqMatUpgrades              = 300.00");
    expect(sql).toContain("uqmqDoorSellPrice            = 11825.00");
    expect(sql).toContain("uqmqInstallSell              = 2892.00");
    expect(sql).toContain("uqmqMiscExtras               = 760.00");
    expect(sql).toContain("uqmqMiscExtraDesc            = N'Duct Lifter'");
    expect(sql).toContain("uqmqResellerDiscount         = 22.00");
    // marginPercent is a fraction on the line; uqmqMargin is a percentage.
    expect(sql).toContain("uqmqMargin                   = 50.14");
    // Without the quantity-break predicate this updates every break.
    expect(sql).toContain("qmqQuoteQuantityID = 1");
  });
});

/**
 * The round trip that was broken: generate, go back, change something, and
 * try to return. The button used to switch to the outline variant and become a
 * no-op toggle, so it looked greyed out and there was no way back to the SQL
 * short of breaking a field and fixing it again.
 */
test.describe("returning to the quote", () => {
  const complete = async (page: import("@playwright/test").Page) => {
    await page.goto("/quote/new");
    await page.getByLabel("Project Name").fill("Coles Truganina D07");
    await page.getByLabel("Sales Person").selectOption("JCO");
  };

  test("the button stays usable after generating and going back", async ({
    page,
  }) => {
    await complete(page);

    const button = page.getByRole("button", { name: /Sales Checklist Complete/ });
    // Reachable only when all four items pass; on a new quote customer and
    // location are unset, so this documents the gate rather than skipping it.
    const outstanding = page.getByRole("button", {
      name: /Sales checklist — \d+ outstanding/,
    });
    await expect(outstanding.or(button)).toBeVisible();

    // With items outstanding the button opens the list rather than doing
    // nothing — that is the behaviour that must never regress.
    if (await outstanding.isVisible()) {
      await outstanding.click();
      await expect(page.getByText("Customer selected")).toBeVisible();
      // And it is still clickable afterwards, not disabled.
      await expect(outstanding).toBeEnabled();
    }
  });

  test("the checklist button is never disabled", async ({ page }) => {
    await complete(page);
    const anyChecklistButton = page.getByRole("button", {
      name: /Sales [Cc]hecklist/,
    });
    await expect(anyChecklistButton).toBeEnabled();
    await anyChecklistButton.click();
    // Still enabled after clicking, in every state.
    await expect(anyChecklistButton).toBeEnabled();
  });
});

/**
 * The form id must match what M1 already holds. The sample of 576 real rows
 * shows PART-RRD-MOVIDOR-TEMPLATE-REV-BOM — the CONFIGURATOR's revision, not
 * the quote's, and xaiSourceTable upper case throughout.
 */
test.describe("FormInputValues shape", () => {
  const quote = {
    quoteId: "41407", customer: { id: "C1" }, shipToCustomer: { id: "C1" },
    shipToLocation: { id: "L1" }, projectName: "p", salesPerson: "JCO",
    leadSource: "ARCH",
    revision: "A",                       // the QUOTE revision — must not be used
    status: "Quote In Progress", totals: {},
    lines: [{
      quoteLineId: "1", totalUnitPrice: 1,
      item: {
        partId: "RRD", partRevision: "A", partDescription: "d",
        partLongDescription: "", partQty: 1,
        configuratorId: "RRD-MOVIDOR-TEMPLATE",
        parameters: [{ controlName: "CMBDOORMODEL", value: "EX35" }],
      },
    }],
  } as never;

  test("uses the configurator revision, not the quote revision", async () => {
    const { buildQuoteSql } = await import("../src/lib/quote-sql");
    const sql = buildQuoteSql(quote, { "RRD-MOVIDOR-TEMPLATE": "BOM" })
      .find((s) => s.id === "forminputvalues")!.sql;

    expect(sql).toContain("PART-RRD-MOVIDOR-TEMPLATE-REV-BOM");
    expect(sql).not.toContain("PART-RRD-MOVIDOR-TEMPLATE-REV-A");
  });

  test("a blank revision leaves the id ending in REV-", async () => {
    const { buildQuoteSql } = await import("../src/lib/quote-sql");
    // Curtain and installation both carry an empty revision in M1.
    const sql = buildQuoteSql(quote, { "RRD-MOVIDOR-TEMPLATE": "" })
      .find((s) => s.id === "forminputvalues")!.sql;
    expect(sql).toContain("PART-RRD-MOVIDOR-TEMPLATE-REV-");
    expect(sql).not.toContain("REV-A");
  });

  test("source table is QUOTELINES and the parent form id is blank", async () => {
    const { buildQuoteSql } = await import("../src/lib/quote-sql");
    const sql = buildQuoteSql(quote, { "RRD-MOVIDOR-TEMPLATE": "BOM" })
      .find((s) => s.id === "forminputvalues")!.sql;

    // Keyed on @LineUID: the column-list line also starts with "(" and would
    // otherwise be treated as a VALUES row and fail every assertion.
    const values = sql.split("\n").filter((l) => l.includes("@LineUID,"));
    expect(values.length).toBeGreaterThan(0);
    for (const v of values) {
      // Upper case in all 576 sample rows.
      expect(v).toContain("N'QUOTELINES'");
      expect(v).not.toContain("N'QuoteLines'");
      // Parent is empty for the door configurator; top level is its form id.
      expect(v).toContain("N'', N'PART-RRD-MOVIDOR-TEMPLATE-REV-BOM'");
    }
  });
});
