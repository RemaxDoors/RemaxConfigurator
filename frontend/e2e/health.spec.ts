import { test, expect } from "@playwright/test";

/**
 * The status page is the first thing to look at when someone reports a
 * problem, so its own failure modes matter more than most.
 *
 * These assert that it reports honestly rather than that everything is green:
 * a page that renders "healthy" when the database is unreachable is the
 * failure being guarded against, and that is exactly what happened when a
 * cached column check made a missing column invisible.
 */
/**
 * Is the Python API behind the BFF actually up?
 *
 * The BFF answers either way, with a degraded body naming the unreachable API,
 * so a down API produces a confusing assertion failure rather than an obvious
 * one. These tests skip instead — the assertions are kept exactly as strict,
 * they just do not pretend to have run.
 */
async function apiIsUp(request: { get: (u: string) => Promise<{ json: () => Promise<Record<string, unknown>> }> }) {
  try {
    const body = await (await request.get("/api/status")).json();
    return typeof body.version === "string";
  } catch {
    return false;
  }
}

test.describe("status page", () => {
  test("renders and names every check", async ({ page, request }) => {
    test.skip(!(await apiIsUp(request)), "Python API is not running");
    await page.goto("/status");

    await expect(
      page.getByRole("heading", { name: "System status" })
    ).toBeVisible();

    // The three probes the API always reports, healthy or not.
    for (const name of ["API", "M1 database", "Config database"]) {
      await expect(page.getByText(name, { exact: true })).toBeVisible();
    }
  });

  test("shows the running version", async ({ page, request }) => {
    test.skip(!(await apiIsUp(request)), "Python API is not running");
    await page.goto("/status");
    // Deploys pin the image to a commit SHA, which is invisible from the app;
    // this badge is the only way to tell which build is serving.
    await expect(page.getByText(/^v\d+\.\d+\.\d+$/)).toBeVisible();
  });

  test("a failed check is visibly failed, not silently omitted", async ({
    page,
  }) => {
    // Force the API to look unreachable and confirm the page says so rather
    // than rendering an empty, healthy-looking shell.
    await page.route("**/api/status", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: false,
          version: "0.0.0-test",
          checks: [
            { name: "API", ok: true, ms: 1, detail: "running" },
            {
              name: "Config database",
              ok: false,
              ms: 12,
              error: "Login failed for user 'cfg'.",
            },
          ],
          configurators: [],
          warnings: [],
        }),
      })
    );
    await page.goto("/status");
    await expect(page.getByText("Login failed for user 'cfg'.")).toBeVisible();
  });

  test("change log distinguishes 'not recording' from 'nothing happened'", async ({
    page,
  }) => {
    await page.route("**/api/status/changes*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          available: false,
          changes: [],
          note: "dbo.uCfgChangeLog does not exist in this database, so configuration changes are not being recorded.",
        }),
      })
    );
    await page.goto("/status");
    await expect(page.getByRole("heading", { name: "Change log" })).toBeVisible();
    await expect(page.getByText(/are not being recorded/)).toBeVisible();
  });

  test("change log lists recorded edits", async ({ page }) => {
    await page.route("**/api/status/changes*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          available: true,
          changes: [
            {
              id: 2,
              table: "uCfgRules",
              recordKey: "RRD-MOVIDOR-TEMPLATE",
              action: "REPLACE",
              changedBy: "admin",
              changedAt: "2026-08-21T02:00:00",
              oldValue: null,
              newValue: null,
            },
            {
              id: 1,
              table: "uCfgParameters",
              recordKey: "RRD-MOVIDOR-TEMPLATE/CMBBRUSHSEAL",
              action: "DELETE",
              changedBy: "gizem",
              changedAt: "2026-08-21T01:00:00",
              oldValue: null,
              newValue: null,
            },
          ],
        }),
      })
    );
    await page.goto("/status");

    // Scoped to the change-log row: "DELETE" also appears as an HTTP method
    // badge in the endpoint reference further down the same page.
    const row = page.getByRole("row").filter({
      hasText: "RRD-MOVIDOR-TEMPLATE/CMBBRUSHSEAL",
    });
    await expect(row).toBeVisible();
    await expect(row.getByText("DELETE")).toBeVisible();
    await expect(row.getByText("uCfgParameters")).toBeVisible();
    await expect(row.getByText("gizem")).toBeVisible();
  });
});

test.describe("API health", () => {
  test("/api/status answers with checks and a version", async ({ request }) => {
    test.skip(!(await apiIsUp(request)), "Python API is not running");
    const res = await request.get("/api/status");
    expect(res.status()).toBe(200);
    const body = await res.json();

    // The design decision worth protecting: database failures are reported
    // INSIDE a 200 so the Azure health check keeps the instance in rotation
    // and the reason stays visible. A 503 here would hide it.
    expect(Array.isArray(body.checks)).toBe(true);
    expect(body.checks.length).toBeGreaterThan(0);
    expect(body).toHaveProperty("version");

    for (const check of body.checks) {
      expect(check).toHaveProperty("name");
      expect(check).toHaveProperty("ok");
      // A failing check must say why, or it is no better than silence.
      if (!check.ok) expect(check.error ?? "").not.toBe("");
    }
  });
});
