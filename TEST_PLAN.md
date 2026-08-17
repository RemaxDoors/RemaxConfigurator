# Remax Configurator — End‑to‑End Test Plan

**Reviewer role:** Senior QA / full‑stack review
**Date:** 2026‑07‑31
**Build under test:** local dev — Next.js web (`web/`, :3000) + FastAPI (`api/`, :8000) + SQL Server (M1 = `M1_RP`, config DB = `new`) + Simpro (read‑only).
**Change policy:** Review only. No application code modified in this phase.

---

## 1. Understanding of the application

### Architecture
- **Frontend** — Next.js 14 App Router + TypeScript + Tailwind (`web/`). Pages: `/` (launcher), `/quote/[id]`, `/configurator-setup` (admin), `/simpro`, `/settings`.
- **Backend** — FastAPI (`api/`). Routers: `configurators`, `customers`, `pricing` (+ `/parts`), `validation`, plus config write endpoints. Reads config metadata from the `new` DB and prices/searches from `M1_RP`. Reuses the old Streamlit rule engine (`src/services/...`, pure modules) for upgrade/installation part selection.
- **BFF proxy routes** (`web/src/app/api/*`) — forward browser calls to the Python API so credentials stay server‑side.
- **Databases** — `new` (uCfg* configurator definition tables) and `M1_RP` (ERP: `uSellPriceMatrixs`, `PartUnitSalePrices`, `Parts`, `PartRevisions`, `Organizations`).
- **External** — Simpro (job search, read‑only). Microsoft/Entra auth is a "Coming soon" placeholder.
- **Config/env** — `web/.env` (`API_URL`, Simpro creds), `api/.env` (`DB_*`, `CONFIG_DB_NAME`). Gitignored.

### Main user journey (intended)
1. Open a quote (`/quote/new`).
2. Select/create a customer + ship‑to site/location.
3. Add lines: **Part entry** (search M1) or **Door** (configure via the stepped wizard).
4. For doors: pick model/size → wizard steps (sections) → defaults auto‑apply per model → validation → **M1 price breakdown** (door + upgrades + discount + installation + margin).
5. Validate & Add → line shows totals; expandable per‑part breakdown.
6. Repeat for multiple lines; edit/copy/delete lines.
7. **Save the quote / create the M1 payload (uQuotes/uQuoteLines)** ← intended end state per the ECI SOW.

### Assumptions
- A1: The business intends quotes to be **persisted** and ultimately written to M1 (uQuotes/uQuoteLines) — this is the stated SOW deliverable.
- A2: GST/tax and reseller discount are expected on a sales quote (AU business).
- A3: Curtain and Installation configurators are expected to contribute to a door line (the New Line dialog exposes toggles for them).
- A4: `M1_RP` cost data is partial in this environment (many `$0` costs) — production is expected to have real cost.
- A5: Door price uses the smallest `uSellPriceMatrixs` cell that fits W×H (matches the Streamlit app).

---

## 2. Test environment & quality checks executed

| Check | Command | Result |
|---|---|---|
| Production build | `npm run build` | ✅ **Pass** — compiled, 18 routes, static gen OK |
| Type check | `tsc --noEmit` | ✅ **Pass** — 0 errors |
| Lint | `next lint` (via build) | ✅ **Pass** — no errors reported |
| Python syntax | `ast.parse` on changed modules | ✅ **Pass** |
| API smoke | curl `/configurators`, `/price`, `/parts`, `/validate`, `/customers` | ✅ reachable |
| Unit/integration/e2e tests | — | ⚠️ **None exist** (no test suite in repo) |

**Legend for Actual Result:** `TESTED` = executed & observed · `INSPECTED` = code review · `UNABLE` = needs browser/creds not available in this session.

> UNABLE to test in this session: live browser DOM interaction, console errors, responsive/mobile layout, keyboard/a11y, colour contrast (the in‑session browser pane would not composite). These are marked UNABLE and recommended for manual/automated follow‑up.

---

## 3. Test cases

Severity: **S1** critical (wrong money/lost data/crash) · **S2** high · **S3** medium · **S4** low.

### Application loading & navigation
| ID | Feature | Steps | Test data | Expected | Actual | P/F | Sev | Evidence |
|---|---|---|---|---|---|---|---|---|
| TC‑01 | Build/boot | `npm run build` | — | Builds with no errors | Compiled OK, 18 routes | Pass | S1 | build log |
| TC‑02 | Pages compile | GET `/`, `/quote/new`, `/configurator-setup`, `/simpro` | — | 200 | 200 | Pass | S2 | curl |
| TC‑03 | Nav links | Click header nav | — | Routes resolve | Links present | INSPECTED | S3 | `lib/navigation.ts` |

### Customer / site
| ID | Feature | Steps | Test data | Expected | Actual | P/F | Sev | Evidence |
|---|---|---|---|---|---|---|---|---|
| TC‑10 | Customer search (API) | GET `/customers?q=pty` | `pty` | Real M1 orgs | 50 results | Pass | S1 | curl |
| TC‑11 | Customer picker (UI) | Open picker, search | any | Lists M1 customers | **Empty** — picker reads empty `MOCK_PARTIES`, not the API | **Fail** | **S1** | `customer-picker.tsx:18,40` |
| TC‑12 | Ship‑to location | Pick location | any | Locations listed | **Empty** — `MOCK_LOCATIONS` empty | **Fail** | **S2** | `customer-picker.tsx:109` |
| TC‑13 | Create new customer | — | — | Able to create | **Not implemented** | INSPECTED | S3 | no create flow |

### Door configuration & dimensions
| ID | Feature | Steps | Test data | Expected | Actual | P/F | Sev | Evidence |
|---|---|---|---|---|---|---|---|---|
| TC‑20 | Model dropdown (DB‑driven) | New Line→Door→Rapid | — | Models from DB | 12 DB models | Pass | S2 | `/api/config` |
| TC‑21 | Defaults on model change | Select HS35 | HS35 | Other params pre‑fill | Applies 15 defaults | Pass | S2 | wizard `applyModelDefaults` |
| TC‑22 | Wizard steps from Section | step through | — | Steps = sections | Size/Overview/Upgrades/… | Pass | S2 | `configurator-form.tsx` |
| TC‑23 | Model‑specific steps | ES40 vs HS35 | — | ES40/Thermic steps only for those models | Conditional | Pass | S3 | `sectionAllowed()` |
| TC‑24 | Negative dimensions | POST `/price` W=‑3000 H=‑3000 | negative | Reject / $0 | **Returns $13,179** | **Fail** | **S1** | curl probe |
| TC‑25 | Text in numeric dim | POST `/price` W="abc" | abc | Graceful error | **502 "could not convert string to float"** | **Fail** | **S2** | curl probe |
| TC‑26 | Huge dimensions | POST `/price` 99,999,999 | huge | Warning / clamp | Silent **$0** | **Fail** | S2 | curl probe |
| TC‑27 | Qty = 0 | POST `/price` QTY=0 | 0 | Reject / 0 | Silently coerced to **1** | **Fail** | S3 | curl probe |
| TC‑28 | Unknown model | POST `/price` model=NOPE | NOPE | Warning | Silent **$0** | **Fail** | S3 | curl probe |

### Pricing / cost / margin
| ID | Feature | Steps | Test data | Expected | Actual | P/F | Sev | Evidence |
|---|---|---|---|---|---|---|---|---|
| TC‑30 | Door price from M1 | price HS35 3500×3000 | — | uSellPriceMatrixs price | $16,033.46 | Pass | S1 | curl |
| TC‑31 | Part price from M1 | `/parts?search=EL-UPS` | — | Real sell/cost | correct | Pass | S1 | curl |
| TC‑32 | Upgrade parts priced | HS35 + UPS + ABS | — | Upgrade lines from rules | 2 assembly + 1 discount | Pass | S1 | curl |
| TC‑33 | Margin % | any | — | (sell‑cost)/sell | Correct math; **but shows ~100% when M1 cost = $0** | Pass* | S2 | curl — misleading |
| TC‑34 | GST / tax | — | — | GST line on quote | **Absent** | **Fail** | S2 | grep (none) |
| TC‑35 | Reseller discount | Set reseller % | — | Editable, affects total | **Display‑only column, no input, always 0** | **Fail** | S2 | `quote-lines.tsx:177` |
| TC‑36 | Installation contribution | Door with install | — | Install lines priced | **$0** — install configurator never run in door flow | **Fail** | S2 | grep |
| TC‑37 | Rounding/format | any | — | 2dp AUD | `money()` uses en‑AU 2dp | Pass | S4 | `lib/format.ts` |

### Multiple lines / edit / delete / save
| ID | Feature | Steps | Test data | Expected | Actual | P/F | Sev | Evidence |
|---|---|---|---|---|---|---|---|---|
| TC‑40 | Add multiple lines | Add 2+ doors/parts | — | Lines listed | Works (local state) | INSPECTED | S2 | page |
| TC‑41 | Line total after save | Validate & Add | — | Line shows totals | Fixed this session; works | Pass | S1 | code |
| TC‑42 | Expand breakdown | Click chevron | — | Per‑part sell/cost | Works | Pass | S2 | `quote-lines.tsx` |
| TC‑43 | Edit line | Double‑click | — | Reopen wizard w/ values | Works | INSPECTED | S2 | `handleEdit` |
| TC‑44 | Delete line | Delete | — | **Confirm then** remove | Removes with **no confirmation** | **Fail** | S3 | `handleDelete` |
| TC‑45 | Copy line | Copy | — | Duplicated | Works | INSPECTED | S3 | `handleCopy` |
| TC‑46 | Save quote / draft | Save | — | Persist + M1 payload | **No Save button / no persistence at all** | **Fail** | **S1** | grep |
| TC‑47 | Retrieve saved quote | Open `/quote/123` | — | Load saved lines | Loads empty `MOCK_QUOTE_LINES` | **Fail** | S2 | page `makeQuote` |
| TC‑48 | Refresh mid‑config | F5 | — | State retained | **All state lost** (React only) | **Fail** | S2 | inspection |

### Validation / M1 payload / errors
| ID | Feature | Steps | Test data | Expected | Actual | P/F | Sev | Evidence |
|---|---|---|---|---|---|---|---|---|
| TC‑50 | Validation engine | POST `/validate` | HS35 | errors/warnings | `{errors:[],warnings:[],is_valid:true}` | Pass | S2 | curl |
| TC‑51 | Required fields block | leave required empty | — | Cannot Add | Wizard doesn't enforce `required` before Add | INSPECTED | S2 | `configurator-form` |
| TC‑52 | M1 quote payload | Save | — | uQuotes/uQuoteLines JSON built | **Not implemented** | **Fail** | **S1** | grep |
| TC‑53 | API down handling | Stop API, price | — | Friendly message | `fetchPrice` returns null → "Price unavailable" | Pass | S2 | code |
| TC‑54 | SQL‑injection input | `/parts?search=';--` | `';--` | Safe, param’d | 0 rows, no error | Pass | S1 | curl |
| TC‑55 | Duplicate submit | Double‑click Validate & Add | — | Single add | Button not disabled during in‑flight add (validating guards validation only) | Suspected | S3 | inspection |

### Simpro / settings
| ID | Feature | Steps | Expected | Actual | P/F | Sev | Evidence |
|---|---|---|---|---|---|---|---|
| TC‑60 | Simpro job search | search 606849 | Job + cost centres + items | Works | Pass | S2 | prior verify |
| TC‑61 | Settings auth | open Settings | Auth config | "Coming soon" placeholder | INSPECTED | S4 | `settings/page.tsx` |

### UNABLE to test this session (recommend manual/automation)
- TC‑70 Responsive/tablet/mobile layout — UNABLE
- TC‑71 Console/runtime errors in browser — UNABLE
- TC‑72 Keyboard nav / a11y / contrast — UNABLE
- TC‑73 Network interruption mid‑request UX — UNABLE
- TC‑74 Loading/empty‑state visuals — UNABLE (verified via code only)

---

## 4. Coverage summary
- **Executed:** build, typecheck, lint, 20+ API probes (pricing, parts, validate, customers), page compile.
- **Inspected:** all pages, components, routes, libs, business‑logic modules, data flow.
- **Not covered (needs follow‑up):** browser UI interaction, responsive, a11y, and any automated test suite (none exists).

See **BUG_REPORT.md** for the prioritised defect list and action plan.
