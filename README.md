# Remax Configurator

Sales quoting and door configuration for Remax rapid doors. Replaces the Streamlit
proof of concept with a three-tier app that reads prices from **M1 (ECI ERP)** and
keeps its configurator definition in a database rather than in Python code.

```
┌──────────────┐   HTTPS   ┌──────────────┐   ODBC   ┌────────────────────┐
│  web/        │ ────────► │  api/        │ ───────► │  SQL Server        │
│  Next.js 14  │           │  FastAPI     │          │  • M1_RP  (read)   │
│  App Router  │ ◄──────── │  SQLAlchemy  │ ◄─────── │  • RP_config (cfg) │
└──────────────┘           └──────────────┘          └────────────────────┘
   browser                    all M1 access             uCfg* tables
```

**The web tier never opens a database connection.** Everything under
`web/src/app/api/*` is a thin proxy to the Python API, so M1 and Simpro
credentials stay server-side and never reach the browser.

| Database | Owner | Purpose |
|---|---|---|
| `M1_RP` | ECI M1 | Read-only source of truth: part prices, door price matrices, customers |
| `RP_config` | this app | `uCfg*` tables — parameters, options, defaults, rules, validations |

---

## Running locally

### Prerequisites

- **Node.js 20+** and npm
- **Python 3.12+**
- **ODBC Driver 17 for SQL Server** ([download](https://learn.microsoft.com/sql/connect/odbc/download-odbc-driver-for-sql-server))
- Network access to the M1 SQL Server

### 1. Configure

Both tiers read from gitignored `.env` files.

> **The API's settings come from the repo-root `.env`**, which it shares with the
> Streamlit app. `settings.py` calls `load_dotenv()` with no path, and
> python-dotenv walks *up* from the working directory and stops at the first
> `.env` it finds. Since `run-api.cmd` starts uvicorn from `api/`, creating an
> `api/.env` **shadows the root one** — the API then sees only what that file
> contains and loses the M1 credentials entirely. Put API settings in the root
> `.env` unless you intend to move all of them there.

```bash
cp web/.env.example web/.env
```

Root `.env` (see `api/.env.example` for the full list):

| Setting | Example | Notes |
|---|---|---|
| `DB_SERVER` | `GIZEME` | M1 SQL Server host |
| `DB_NAME` | `M1_RP` | The M1 database |
| `CONFIG_DB_NAME` | `RP_config` | The app's own config database |
| `DB_USER` / `DB_PASSWORD` | | SQL auth |
| `DB_DRIVER` | `ODBC Driver 17 for SQL Server` | **18** inside the Docker image |
| `ALLOWED_ORIGINS` | `http://localhost:3000` | CORS |

`web/.env`:

| Setting | Example | Notes |
|---|---|---|
| `API_URL` | `http://localhost:8000` | Where the BFF routes forward to |
| `SIMPRO_BASE_URL` | `https://<company>.simprosuite.com/api/v1.0` | |
| `SIMPRO_API_TOKEN` | | Server-side only. Never commit it. |

### 2. Create the config database

Run once against the `RP_config` database, in this order:

```bash
sqlcmd -S <server> -d RP_config -i db/uCfg_configurator_schema.sql
sqlcmd -S <server> -d RP_config -i db/uCfg_pricing_rules_schema.sql
sqlcmd -S <server> -d RP_config -i db/uCfg_add_section.sql
sqlcmd -S <server> -d RP_config -i db/uCfg_add_audit_columns.sql
sqlcmd -S <server> -d RP_config -i db/uCfg_change_log.sql
sqlcmd -S <server> -d RP_config -i db/uCfg_configurator_links.sql
sqlcmd -S <server> -d RP_config -i db/uCfg_field_map.sql
sqlcmd -S <server> -d RP_config -i db/uCfg_rules_add_quantity_fields.sql
sqlcmd -S <server> -d RP_config -i db/uCfg_rules_add_condition_formula.sql
```

Then seed the configurator definitions:

```bash
python db/migrate_all.py
sqlcmd -S <server> -d RP_config -i db/seed_movidor_generated.sql
```

All migrations are re-runnable.

### 3. Start

On Windows, the `.cmd` scripts start both servers in their own windows:

```bash
.\run-all.cmd
```

`run-api.cmd` and `run-web.cmd` start them individually. They expect a Python
venv at `config\Scripts\python.exe` — edit the script if yours lives elsewhere.

Cross-platform equivalents:

```bash
cd api && python -m uvicorn app.main:app --reload --port 8000
```

```bash
cd web && npm install && npm run dev
```

| | URL |
|---|---|
| Web | <http://localhost:3000> |
| API | <http://localhost:8000> |
| API docs (Swagger) | <http://localhost:8000/docs> |
| Health + config warnings | <http://localhost:3000/status> |

If something looks wrong, **`/status` is the first place to look** — it reports
whether each database is reachable, counts per configurator, and warns about
empty dropdowns or configurators with no rules.

---

## Deploying to Azure

Two Azure Web Apps, deployed by two GitHub Actions workflows on push to `main`.

| Component | Azure resource | Workflow |
|---|---|---|
| `web/` | Web App, **Node 20 LTS** | `.github/workflows/azure-web.yml` |
| `api/` | Web App **for Containers** | `.github/workflows/azure-api.yml` |

The API ships as a **container**, not a code deployment, because `pyodbc` needs the
Microsoft ODBC driver installed at OS level. `api/Dockerfile` bakes in `msodbcsql18`;
a plain Python App Service has no reliable way to install it.

### Web App: startup command and settings

Next.js is built with `output: "standalone"`, which emits a `server.js`.

**Configuration → General settings → Startup Command:**

```bash
node server.js
```

**Configuration → Application settings:**

| Setting | Value |
|---|---|
| `API_URL` | `https://<your-api-app>.azurewebsites.net` |
| `HOSTNAME` | `0.0.0.0` |
| `SIMPRO_BASE_URL` | your Simpro API base |
| `SIMPRO_API_TOKEN` | Key Vault reference |

`HOSTNAME` is not optional. The standalone server binds to `$HOSTNAME`, and App
Service sets that to the machine name — the app starts, listens on nothing
reachable, and every request times out.

### API app: settings

No startup command needed — the Dockerfile's `CMD` already binds `$PORT`.

| Setting | Value |
|---|---|
| `DB_SERVER`, `DB_NAME`, `DB_USER` | M1 connection |
| `DB_PASSWORD` | **Key Vault reference**, not a literal |
| `CONFIG_DB_NAME` | `RP_config` |
| `DB_DRIVER` | `ODBC Driver 18 for SQL Server` — the version in the image |
| `ALLOWED_ORIGINS` | `https://<your-web-app>.azurewebsites.net` |
| `WEBSITES_PORT` | `8000` |

The M1 server must accept connections from the Web App's outbound IPs, or be
reached over VNet integration / a private endpoint. This is the step that most
often blocks a first deploy — the app starts fine and every query then fails.

### GitHub secrets

| Secret | Used by |
|---|---|
| `AZURE_WEBAPP_PUBLISH_PROFILE` | web |
| `AZURE_CREDENTIALS` | api |
| `ACR_LOGIN_SERVER`, `ACR_USERNAME`, `ACR_PASSWORD` | api |

The API workflow polls `/status` after deploying and fails the run if it does not
return 200 within five minutes, so a broken deploy is visible in Actions rather
than discovered by a salesperson.

> `.github/workflows/main_rapid-door-estimator.yml` still deploys the **legacy
> Streamlit app** from the repo root. It is untouched and will keep running on
> pushes to `main`. Delete it once the Streamlit app is retired.

---

## How the configurator works

A configurator is a set of **parameters** (the form fields) and **rules** (what
each selection adds to the quote). Both live in the database and are edited from
`/configurator-setup` — no code change to add a rule.

### Sections

A parameter's `Section` drives the form layout. `"Step > Group"` puts a heading
inside a wizard step:

```
Overview > Controller     ->  step "Overview", group "Controller"
Activations               ->  step "Activations", no group
```

Drag fields between sections on the **Form sections** board; it writes `Section`
and `SortOrder` only.

### Rules

A rule fires when its **condition groups** pass (AND within a group, OR across
groups) **and** its optional `ConditionFormula` evaluates non-zero.

The formula engine parses to an AST and evaluates only whitelisted nodes — it is
not `eval()`, so a configurator formula cannot run arbitrary code.

M1's configurator repeats one shape across dozens of rules: walk a numbered set
of controls, count what matches, act on the count. That is expressed with
`group()`:

```
countStartsWith(group("CMBACT"), "Induction Loop - ") > 0
countContains(group("CMBACT"), "Loop", "Existing") = 0
countEquals(group("CMBRADAR"), "IXIO Sensor - Long Stalk")
sumWhere(group("CMBACT"), "Elsema Remote - 2", group("NUMREMOTEQTY"))
```

`sumWhere` pairs two numbered groups by slot number — "add up the quantity beside
each matching activation".

Run the engine's own checks with:

```bash
python api/app/formula.py
```

### ⚠️ CSV imports replace the whole set

Importing parameters, rules or defaults **deletes anything the file omits**. A
short "patch" file will wipe everything else. The UI now lists exactly what will
be deleted and makes you type the count when it is 10 or more — but to change a
few rows, write SQL `UPDATE`s instead.

`db/backups/` holds point-in-time snapshots. Take one before bulk edits:
each file restores parameters, options, rules and conditions exactly.

---

## Repository layout

```
├── api/                  FastAPI service — all M1 access
│   ├── app/
│   │   ├── formula.py            safe AST formula engine
│   │   ├── config_repo.py        reads uCfg* tables
│   │   ├── config_write.py       writes uCfg* tables + change log
│   │   ├── validation_engine.py  condition evaluation
│   │   ├── m1_pricing.py         door + part prices from M1
│   │   ├── pricing_rules/        upgrade + installation rules (moved from src/)
│   │   └── routers/
│   └── Dockerfile                includes msodbcsql18
├── web/                  Next.js front end
│   └── src/
│       ├── app/api/              BFF proxy routes (no DB access)
│       ├── components/admin/     configurator setup UI
│       └── components/quote/     quoting + configurator wizard
├── db/                   schema, migrations, seeds, backups
├── src/                  legacy Streamlit app (still in production)
└── .github/workflows/    Azure deployments
```

### Retiring Streamlit

The dependency between the two apps now runs the *other* way. `api/` is
self-contained; the pricing rules live in `api/app/pricing_rules/`, and the
three modules left behind in `src/services/` are thin shims that load them
through `src/services/_pricing_bridge.py`.

That bridge exists because both packages would otherwise be called `app` —
Streamlit's entry point is `src/app.py`, so whichever lands on `sys.path` first
wins. The bridge loads the package straight off disk under its own name instead.

To retire Streamlit: delete `src/`, the three shims go with it, and nothing in
`api/` changes. Deleting `api/app/pricing_rules/` is a separate, later job — it
needs the DB rules in `uCfgRules` to be proven at parity first, since a silent
difference there is a wrong quote.
