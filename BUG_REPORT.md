# Remax Configurator — Review & Defect Report

**Date:** 2026‑07‑31 · **Phase:** Review only (no code changed) · **Evidence:** build log, `tsc`, `next lint`, curl API probes, code inspection.

---

## A. Executive summary

**Overall condition:** The **configure‑and‑price engine is solid and real** — door and part prices, upgrades, discounts and margin all come from M1 and are verified end‑to‑end. However, the app is **not release‑ready** because the **quote itself cannot be saved**, the **customer picker is wired to an empty mock**, and there is **no GST/tax/reseller‑discount**. Several input‑validation gaps let invalid dimensions produce prices or crash the pricing API.

**Release readiness:** ❌ Not ready for production. Suitable for internal demo of the *pricing/configurator* only.

**Issue counts:** Critical **5** · High **6** · Medium **6** · Low/cleanup **5**.

**Main business risks**
- No quote is persisted or written to M1 → the core SOW deliverable (uQuotes/uQuoteLines) is missing.
- Customer cannot actually be selected (mock) → no quote can be attributed to a customer.
- No GST/reseller discount → quoted totals are commercially incomplete.
- Invalid dimensions can yield a (wrong) price; missing M1 cost shows a misleading ~100% margin.

**Main technical risks**
- No automated tests at all.
- All quote/wizard state is in‑memory only (lost on refresh).
- Pricing API not hardened against non‑numeric/negative input.
- Mock modules still sit in production code paths as silent fallbacks.

---

## B. Critical defects (S1)

### BUG‑C1 — Quotes cannot be saved / no M1 payload
- **Area:** Quote page / integration.
- **Description:** There is no Save/Submit action, no persistence, and no uQuotes/uQuoteLines payload creation. All lines live in React state only.
- **Repro:** `/quote/new` → add lines → there is no save; refresh → everything gone.
- **Expected:** Persist the quote (draft) and produce the M1 write payload (per SOW).
- **Actual:** Nothing is saved.
- **Probable cause:** Feature not yet built (post‑configurator step).
- **Evidence:** `grep -niE "save|POST|fetch|localStorage" frontend/src/app/quote/[id]/page.tsx` → only a toast string.
- **Fix:** Add a Save flow → persist draft (DB or localStorage interim) + build the uQuotes/uQuoteLines/uConfiguratorValues payload; wire to the API write endpoint (coordinate with ECI’s "Create Quote from HubSpot" contract).
- **Regression risk:** New feature — low risk to existing flows.

### BUG‑C2 — Customer picker uses empty mock, not the working M1 API
- **Area:** Customer selection.
- **Description:** `customer-picker.tsx` reads `MOCK_PARTIES` / `MOCK_LOCATIONS` (emptied). The real endpoint `/api/m1/customers` works (returns 50 for "pty") but is never called.
- **Repro:** Quote → Search/Change Customer → type anything → empty list.
- **Expected:** Live M1 customer search + selection.
- **Actual:** Always empty.
- **Evidence:** `customer-picker.tsx:18,40,109`; `GET /customers?q=pty` → 50 results.
- **Fix:** Replace the mock lookups with `fetch('/api/m1/customers?q=...')` (debounced), and load ship‑to sites/locations from M1 too.
- **Regression risk:** Medium — customer state shape must match.

### BUG‑C3 — Negative dimensions return a price
- **Area:** Pricing / validation.
- **Repro:** `POST /price {W:-3000,H:-3000, model:HS35}` → **$13,179.44**.
- **Expected:** Reject negative dimensions (or price $0 + error).
- **Cause:** `uaeHeight >= -3000` matches the smallest matrix cell; no input validation.
- **Evidence:** curl probe.
- **Fix:** Validate `width>0 && height>0` on the client (number inputs `min`, plus a guard) and in `m1_pricing.price_configuration` (return 0 / flag when W/H ≤ 0).
- **Regression risk:** Low.

### BUG‑C4 — Non‑numeric dimension crashes pricing (502)
- **Area:** Pricing API robustness.
- **Repro:** `POST /price {W:"abc"}` → `502 "Pricing failed: could not convert string to float: 'abc'"`.
- **Cause:** The reused rule engine does `float(values["NUMDOORWIDTH"])` which throws; only `m1_pricing._num()` is safe.
- **Evidence:** curl probe.
- **Fix:** Coerce/validate numeric fields before calling the rule engine (sanitise the `values` dict), or wrap and return a clean 400.
- **Regression risk:** Low.

### BUG‑C5 — No GST/tax on the quote
- **Area:** Pricing / commercial correctness.
- **Description:** No GST anywhere. An AU sales quote total without GST is incorrect/misleading.
- **Evidence:** `grep gst|tax` → none.
- **Fix:** Add GST (10%) handling — line ex‑tax + tax + inc‑tax, using M1 tax codes where available; show on the quote total.
- **Regression risk:** Medium — touches totals.

---

## C. Functional defects (S2)

### BUG‑F1 — Reseller discount is display‑only
`Reseller %` is a table column with no editor; `resellerDiscountPercent` is always 0 and never applied to `totalUnitPrice`. **Fix:** add an editable discount per line (or quote‑level) and apply it. Evidence: `quote-lines.tsx:177`.

### BUG‑F2 — Curtain & Installation configurators never run
`NewLineResult.runCurtain/runInstallation` are set in the dialog but **ignored** by the quote page; only the door configurator opens. Installation lines are computed from door values alone, so installation is effectively $0 and curtain pricing is skipped. **Fix:** after the door wizard, chain the curtain/installation configurators when their toggles are on (or fold their inputs into the wizard). Evidence: grep — quote page has no `runCurtain/runInstallation`.

### BUG‑F3 — `Quote.totals` is dead; no header‑level cost/margin rollup
`quote.totals` is initialised to 0 and never read/updated. `QuoteLines` computes its own visual total. There is no quote‑level total cost or blended margin. **Fix:** compute quote totals (sell, cost, margin, GST) from lines and render them. Evidence: `grep "\.totals"` → no reads.

### BUG‑F4 — Huge / out‑of‑matrix dimensions silently price $0
No matrix cell ≥ requested size → door price $0 with no warning. **Fix:** when no cell is found, surface "no price for this size" instead of $0. Evidence: probe (99,999,999 → $0).

### BUG‑F5 — Delete line has no confirmation
`handleDelete` removes immediately. **Fix:** confirm before destructive removal.

### BUG‑F6 — Required fields not enforced before "Validate & Add"
The wizard renders `required` markers but does not block Add when a required field is empty. **Fix:** gate the Summary/Add on required fields.

---

## D. Integration & data‑flow defects

- **BUG‑I1 — Retrieve saved quote:** opening `/quote/<id>` loads empty `MOCK_QUOTE_LINES` (placeholder), not a real record. Ties to BUG‑C1. Evidence: `page.tsx makeQuote`.
- **BUG‑I2 — Config API mock fallback in prod path:** `/api/config` and `configurator-setup` fall back to (empty) `MOCK_CONFIGURATORS/MOCK_RULES` when the API is down — the admin then silently shows nothing rather than an error state. Evidence: `backend/config/route.ts`, `configurator-setup/page.tsx:65‑66`.
- **BUG‑I3 — Rules not persisted:** admin rules live in local state; `uCfgRules` is empty; rule edits/imports don’t persist to the DB. Known/expected but blocks rule‑driven pricing from being admin‑managed. 
- **Data‑flow trace (door):** user input → wizard state → `/price` (M1) → breakdown → line fields (✅ now) → **STOPS** (no save → no M1 payload → no persisted record). The break is at persistence (BUG‑C1).

---

## E. Validation defects
- No client/server guard on **dimensions** (BUG‑C3/C4/F4).
- **Required** fields not enforced (BUG‑F6).
- **Qty 0** silently becomes 1 (TC‑27).
- **Unknown model** silently $0 with no feedback (TC‑28).
- Validation engine itself works (`/validate` returns structured results) but the wizard only runs it at "Validate & Add", not live.

---

## F. User‑experience issues
- Customer selection appears broken (empty) — top‑of‑funnel blocker (BUG‑C2).
- **Margin shows ~100%** when M1 cost is $0 — misleading; add a "cost missing" indicator.
- `Reseller %` column implies editability but isn’t (BUG‑F1).
- No confirmation before **Delete** (BUG‑F5).
- **Refresh loses everything** — no autosave/draft (BUG‑C1/TC‑48).
- Simpro job **Name** is raw HTML source in some data (handled/stripped) — OK.
- UNABLE to assess mobile/tablet, keyboard, contrast this session — recommend manual pass.

---

## G. Unused / disconnected / incomplete code

**Component & module inventory (key items)**

| Component / module | File | Purpose | Used? | Working? | Issue |
|---|---|---|---|---|---|
| `customer-picker` | components/quote | pick customer/site | Yes | **No** | reads empty mock, not API (C2) |
| `mock-data` (MOCK_PARTIES/LOCATIONS/QUOTE_LINES) | lib | placeholder data | Yes (picker, quote) | n/a | empty stubs still in prod path |
| `mock-parts` | lib | old part search | **No** | n/a | **orphan** — superseded by `m1-parts` |
| `mock-configurators`,`mock-rules` | lib | API fallback | Yes (fallback) | n/a | empty; silent fallback |
| `configurator-form` (wizard) | components/quote | door wizard | Yes | Yes | required not enforced (F6) |
| `door-preview` | components/quote | roll‑door SVG | Yes | Yes | roll‑door only (others TODO) |
| `pricing`/`m1_pricing` | lib/api | M1 pricing | Yes | Yes | input hardening needed (C3/C4) |
| `quote-lines` | components/quote | line grid + breakdown | Yes | Yes | reseller col dead (F1); no confirm delete (F5) |
| `rule-editor-dialog` | components/admin | AND/OR rules | Yes | Yes (local) | not persisted (I3) |
| `door-types.ts` | lib | door type catalogue | Yes | partial | hardcoded models/`configuratorFor`/`partIdFor` |
| Settings auth | app/settings | MS sign‑in | placeholder | No | "Coming soon" |

**Categorised (no deletions performed — approval required):**
1. **Safe to remove:** `lib/mock-parts.ts` (orphan, not imported anywhere).
2. **Possibly required later:** `mock-configurators`, `mock-rules`, `mock-data` — currently the offline fallback; keep until API‑always‑on is guaranteed, but consider replacing silent fallback with an explicit "API unavailable" state.
3. **Incomplete & should be connected:** quote **Save**/M1 payload (C1); customer picker → M1 API (C2); curtain/installation configurators (F2); GST/reseller discount (C5/F1); Settings auth.
4. **Duplicate/consolidate:** door model list exists both in `door-types.ts` (hardcoded) and the DB (`CMBDOORMODEL` options) — consolidate to DB.
5. **Requires clarification:** intended GST handling; whether reseller discount is per‑line or per‑quote; where quotes persist (own DB vs M1 vs HubSpot via ECI).

---

## H. Recommended test automation (highest value first)
1. **API unit tests (pytest)** for `m1_pricing`: door price selection, part price, margin math, and **input hardening** (negative/zero/text/huge) — would have caught C3/C4/F4.
2. **Rule‑engine tests**: given values → expected upgrade/discount part IDs (lock the RRD logic).
3. **BFF route tests**: `/api/price`, `/api/m1/parts`, `/api/config` shape + error passthrough.
4. **Frontend component tests (RTL)**: wizard step derivation from sections, defaults‑on‑model‑change, quote‑line pricing after Add.
5. **E2E (Playwright)**: happy path new‑quote → customer → door → price → add → (future) save.

---

## I. Prioritised action plan

**1) Fix before further testing**
- BUG‑C4 (pricing crash on text) · BUG‑C3 (negative dims) — harden pricing input.
- BUG‑C2 (wire customer picker to M1 API) — otherwise no journey can start.

**2) Fix before UAT**
- BUG‑C1 (quote save/draft + retrieve) · BUG‑C5 (GST) · BUG‑F1 (reseller discount) · BUG‑F3 (quote totals) · BUG‑F6 (required enforcement) · BUG‑F5 (confirm delete).

**3) Fix before production**
- BUG‑C1 M1 payload (uQuotes/uQuoteLines) + persistence · BUG‑F2 (curtain/installation) · BUG‑I2 (explicit API‑down state) · margin "cost missing" indicator · add automated tests (H1–H3 minimum).

**4) Future improvement**
- Settings/Entra auth · swing/strip/folding door previews · move rules to DB (I3) · consolidate door‑type data to DB.

**5) Safe cleanup candidates (need your approval)**
- Remove orphan `lib/mock-parts.ts`.
- Replace silent mock fallbacks with explicit error/empty states.

---

### Questions needing your decision
1. Where should a quote **persist** — a new app DB, directly to M1 (uQuotes), or handed to ECI/HubSpot? (Affects C1 design.)
2. GST: standard 10%, or read tax codes from M1 per part? (C5)
3. Reseller discount: per‑line or per‑quote, and does it reduce sell before or after GST? (F1)
4. Curtain/installation: separate configurators chained after the door, or folded into one wizard? (F2)

**No code has been changed.** Tell me which items to implement first and I’ll start with your priority order (my recommendation: C4 → C3 → C2, then C1).
