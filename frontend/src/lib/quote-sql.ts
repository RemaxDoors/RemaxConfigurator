/**
 * Turn a quote into SQL for review — a dry run, never executed.
 *
 * WHY SQL RATHER THAN A MAPPING SCREEN
 *
 * The M1 data dictionary is still settling. A mapping UI bakes today's guesses
 * into components, so every change to the dictionary is a change to the app.
 * Emitting SQL text instead makes the mapping something you edit in place:
 * rename a column, point a statement at another table, delete a block — no
 * code change, no redeploy.
 *
 * WHAT IS AND IS NOT EMITTED
 *
 * The output is the query and nothing else — no commentary, no review notes.
 * That puts the burden on this file to emit only statements it can stand
 * behind, because there is no longer a TODO to carry the doubt. So: every
 * column below was read from M1's catalogue and exists, with the type and
 * length checked. Anything not settled is simply not written.
 *
 * The uqmq* columns on QuoteQuantities line up one-for-one with M1's quote
 * matrix screen, which is where the pricing mapping comes from. Assembly and
 * material upgrades have their own columns, so neither is duplicated into the
 * other and no value is split between them.
 *
 * Nothing in this module performs I/O. It returns strings.
 */

import type { Quote, QuoteLine } from "@/types/quote";
import { isDoor } from "@/types/door";

export const DRY_RUN_BANNER = "DRY RUN — TEST COMPANY REVIEW ONLY — NOT EXECUTED";

export interface SqlSection {
  id: string;
  title: string;
  table: string;
  note: string;
  sql: string;
}

/** SQL string literal. Doubling the quote is the whole escape — no dynamic SQL. */
function lit(value: unknown): string {
  if (value === null || value === undefined || value === "") return "NULL";
  return `N'${String(value).replace(/'/g, "''")}'`;
}

/** Numeric literal for a numeric column. Never quoted; never NULL — the uqmq* */
/** columns are NOT NULL, so an absent figure is a zero, not a missing value.  */
function num(value: unknown, dp = 2): string {
  const n = Number(value);
  return (Number.isFinite(n) ? n : 0).toFixed(dp);
}

function header(quote: Quote, what: string): string {
  const now = new Date().toISOString().slice(0, 16).replace("T", " ");
  return [
    "/* " + "=".repeat(68),
    `   ${DRY_RUN_BANNER}`,
    `   ${what} — Quote ${quote.quoteId || "(unsaved)"} — generated ${now}`,
    "   " + "=".repeat(68) + " */",
    "",
  ].join("\n");
}

/** Quote header → dbo.Quotes. */
function buildQuotes(quote: Quote): SqlSection {
  const sql = [
    header(quote, "Quote header"),
    `DECLARE @QuoteID nvarchar(10) = ${lit(quote.quoteId)};`,
    "",
    "UPDATE dbo.Quotes",
    `SET    uqmpProjectName           = ${lit(quote.projectName)},`,
    `       qmpQuoterEmployeeID       = ${lit(quote.salesPerson)},`,
    `       qmpCustomerOrganizationID = ${lit(quote.customer?.id)},`,
    `       qmpShipOrganizationID     = ${lit(quote.shipToCustomer?.id)},`,
    `       qmpShipLocationID         = ${lit(quote.shipToLocation?.id)},`,
    `       uqmpRevision              = ${lit(quote.revision)},`,
    `       uqmpMarketingProgramID    = ${lit(quote.leadSource)}`,
    "WHERE  qmpQuoteID = @QuoteID;",
  ].join("\n");

  return {
    id: "quotes",
    title: "Quotes",
    table: "dbo.Quotes",
    note: "Header fields.",
    sql,
  };
}

/** Quote lines → dbo.QuoteLines. */
function buildQuoteLines(quote: Quote): SqlSection {
  const out = [
    header(quote, "Quote lines"),
    `DECLARE @QuoteID nvarchar(10) = ${lit(quote.quoteId)};`,
    "",
  ];

  quote.lines.forEach((line, i) => {
    // isDoor is a type guard, so it has to narrow the value itself — storing
    // its result in a boolean gives back a bare boolean and loses the type.
    const item = line.item;
    const door = isDoor(item) ? item : null;
    const model = door?.parameters?.find(
      (p) => p.controlName?.toUpperCase() === "CMBDOORMODEL"
    )?.value;

    out.push(
      "UPDATE dbo.QuoteLines",
      `SET    qmlPartID               = ${lit(item.partId)},`,
      `       qmlPartRevisionID       = ${lit(item.partRevision)},`,
      `       qmlPartShortDescription = ${lit(item.partDescription)}${
        model ? "," : ""
      }`,
      ...(model ? [`       uqmlDoorModelID         = ${lit(model)}`] : []),
      "WHERE  qmlQuoteID = @QuoteID",
      `  AND  qmlQuoteLineID = ${Number(line.quoteLineId) || 0};`
    );
    if (i < quote.lines.length - 1) out.push("");
  });

  return {
    id: "quotelines",
    title: "QuoteLines",
    table: "dbo.QuoteLines",
    note: "One statement per line.",
    sql: out.join("\n"),
  };
}

/**
 * Line pricing → dbo.QuoteQuantities.
 *
 * The uqmq* columns mirror M1's quote matrix screen field for field, which is
 * where this mapping comes from. Assembly and material upgrades have separate
 * columns, so each takes its own figure.
 *
 * qmqQuoteQuantityID is part of the key: M1 holds several quantity breaks per
 * line, and without it in the WHERE clause every break on the line is updated.
 */
function buildQuoteQuantities(quote: Quote): SqlSection {
  const out = [
    header(quote, "Line pricing"),
    `DECLARE @QuoteID nvarchar(10) = ${lit(quote.quoteId)};`,
    "",
  ];

  quote.lines.forEach((line, i) => {
    const b = line.breakdown;
    const qty = Number(line.item.partQty) || 0;
    const unit = Number(line.totalUnitPrice) || 0;

    out.push(
      "UPDATE dbo.QuoteQuantities",
      `SET    qmqQuoteQuantity             = ${num(qty, 5)},`,
      `       uqmqDoorSellPrice            = ${num(b?.doorPrice)},`,
      `       uqmqAssUpgrades              = ${num(b?.assemblyUpgrade)},`,
      `       uqmqMatUpgrades              = ${num(b?.materialOnlyUpgrade)},`,
      `       uqmqMatDiscounts             = ${num(b?.materialDiscount)},`,
      `       uqmqInstallSell              = ${num(b?.installation)},`,
      `       uqmqMiscExtras               = ${num(b?.miscExtra)},`,
      `       uqmqMiscExtraDesc            = ${lit(b?.miscExtraDescription)},`,
      `       uqmqResellerDiscount         = ${num(line.resellerDiscountPercent)},`,
      // marginPercent is a fraction on the line; uqmqMargin is a percentage.
      `       uqmqMargin                   = ${num(
        (Number(line.marginPercent) || 0) * 100
      )},`,
      `       qmqTotalUnitCost             = ${num(b?.unitCost, 5)},`,
      `       qmqTotalCost                 = ${num(b?.totalCost, 5)},`,
      `       qmqFullRevisedUnitPriceBase  = ${num(unit, 5)},`,
      `       qmqRevisedUnitPriceBase      = ${num(unit, 5)},`,
      `       qmqTotalUnitPrice            = ${num(unit, 5)},`,
      `       qmqTotalPrice                = ${num(unit * qty, 5)}`,
      "WHERE  qmqQuoteID = @QuoteID",
      `  AND  qmqQuoteLineID = ${Number(line.quoteLineId) || 0}`,
      "  AND  qmqQuoteQuantityID = 1;"
    );
    if (i < quote.lines.length - 1) out.push("");
  });

  return {
    id: "quotequantities",
    title: "QuoteQuantities",
    table: "dbo.QuoteQuantities",
    note: "Pricing, mapped to the uqmq* quote matrix columns.",
    sql: out.join("\n"),
  };
}

/**
 * Configurator values → dbo.FormInputValues.
 *
 * The one confirmed destination. uConfiguratorValues was dropped: it does not
 * exist in M1_RP under that or any similar name, and writing the same values
 * to two places would leave no answer to which one is authoritative.
 *
 * xaiFormInputValueID is an IDENTITY column, so it is omitted.
 * xaiSourceUniqueID is read from the quote line rather than invented, because
 * a made-up value inserts orphans.
 */
function buildFormInputValues(
  quote: Quote,
  revisions: Record<string, string>
): SqlSection {
  const out = [
    header(quote, "Configurator values"),
    `DECLARE @QuoteID nvarchar(10) = ${lit(quote.quoteId)};`,
    "DECLARE @LineUID uniqueidentifier;",
    "",
  ];

  quote.lines.forEach((line) => {
    const item = line.item;
    if (!isDoor(item)) return;
    // The CONFIGURATOR's revision, not the quote's. Using quote.revision
    // produced PART-RRD-MOVIDOR-TEMPLATE-REV-A, which matches nothing in M1 —
    // the real form id is ...-REV-BOM. Blank is legitimate: curtain and
    // installation carry an empty revision, so their ids end in "REV-".
    const revision =
      revisions[item.configuratorId] ?? item.configuratorRevision ?? "";
    const formId = `PART-${item.configuratorId}-REV-${revision}`;
    const params = (item.parameters ?? []).filter(
      (p) => p.controlName && String(p.value ?? "").trim() !== ""
    );
    if (params.length === 0) return;

    out.push(
      "SELECT @LineUID = qmlUniqueID FROM dbo.QuoteLines",
      `WHERE  qmlQuoteID = @QuoteID AND qmlQuoteLineID = ${
        Number(line.quoteLineId) || 0
      };`,
      "",
      "DELETE FROM dbo.FormInputValues WHERE xaiSourceUniqueID = @LineUID;",
      "",
      `-- ${formId}`,
      "INSERT INTO dbo.FormInputValues",
      "       (xaiFormID, xaiControlName, xaiValue, xaiSourceUniqueID,",
      "        xaiSourceTable, xaiParentFormID, xaiTopLevelFormID)",
      "VALUES"
    );
    params.forEach((p, i) => {
      const end = i === params.length - 1 ? ";" : ",";
      out.push(
        // xaiSourceTable is QUOTELINES, upper case, in every one of the 576
        // sample rows. xaiParentFormID is empty for the door configurator —
        // it is the parent — while xaiTopLevelFormID is the door's form id on
        // every row. An earlier version put the form id in all three.
        `       (${lit(formId)}, ${lit(p.controlName)}, ${lit(
          p.value
        )}, @LineUID, N'QUOTELINES', N'', ${lit(formId)})${end}`
      );
    });
    out.push("");
  });

  return {
    id: "forminputvalues",
    title: "FormInputValues",
    table: "dbo.FormInputValues",
    note: "Configurator values via the xai* fields.",
    sql: out.join("\n"),
  };
}

/**
 * All sections, in the order they would run.
 *
 * `revisions` maps a configurator id to its PartRevision — the value M1 puts
 * in the form id. It is passed in rather than read off the quote line because
 * it belongs to the CONFIGURATOR, not the quote: Movidor is "BOM" while
 * curtain and installation are blank, and the quote's own revision ("A") has
 * nothing to do with it.
 */
export function buildQuoteSql(
  quote: Quote,
  revisions: Record<string, string> = {}
): SqlSection[] {
  return [
    buildQuotes(quote),
    buildQuoteLines(quote),
    buildQuoteQuantities(quote),
    buildFormInputValues(quote, revisions),
  ];
}

/** Every section joined, for Copy all. */
export function joinSections(sections: SqlSection[]): string {
  return sections.map((s) => s.sql).join("\n\n\n");
}

export type { QuoteLine };
