# Remax Configurator

Sales quoting and door configuration for Remax rapid doors. Reads prices from
**M1 (ECI ERP)** and keeps its configurator definition in a database rather than
in Python code, so a rule change is an edit rather than a deployment.

```
┌──────────────┐   HTTPS   ┌──────────────┐   ODBC   ┌────────────────────┐
│  frontend/        │ ────────► │  backend/        │ ───────► │  SQL Server        │
│  Next.js 14  │           │  FastAPI     │          │  • M1_RP  (read)   │
│  App Router  │ ◄──────── │  SQLAlchemy  │ ◄─────── │  • RP_config (cfg) │
└──────────────┘           └──────────────┘          └────────────────────┘
   browser                    all M1 access             uCfg* tables
```

**The web tier never opens a database connection.** Everything under
`frontend/src/app/api/*` is a thin proxy to the Python API, so M1 and Simpro
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

> **The API's settings come from the repo-root `.env`.** `settings.py` calls
> `load_dotenv()` with no path, and python-dotenv walks *up* from the working
> directory and stops at the first `.env` it finds. Since the API starts from
> its own directory, creating an `.env` **there** shadows the root one — the API
> then sees only that file and loses the M1 credentials entirely. Keep API
> settings in the root `.env` unless you move all of them together.

```bash
cp frontend/.env.example frontend/.env
```

Root `.env` (see `backend/.env.example` for the full list):

| Setting | Example | Notes |
|---|---|---|
| `DB_SERVER` | `GIZEME` | M1 SQL Server host |
| `DB_NAME` | `M1_RP` | The M1 database |
| `CONFIG_DB_NAME` | `RP_config` | The app's own config database |
| `DB_USER` / `DB_PASSWORD` | | SQL auth |
| `DB_DRIVER` | `ODBC Driver 17 for SQL Server` | **18** inside the Docker image |
| `ALLOWED_ORIGINS` | `http://localhost:3000` | CORS |

`frontend/.env`:

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

```bash
sqlcmd -S <server> -d RP_config -i db/uCfg_schema_catchup.sql
```

Then load the configurator definitions — parameters, options, defaults, rules,
validations, in foreign-key order:

```bash
sqlcmd -S <server> -d RP_config -i db/RP_config_data.sql
```

All of it is re-runnable. Regenerate that data file from a live database with
`python db/export_config_data.py`, which is also how you copy a known-good
configuration to another server — SQL Server backups only restore forward, so a
database from a newer engine cannot be restored onto an older one.

### 3. Start

On Windows, the `.cmd` scripts start both servers in their own windows:

```bash
.\run-all.cmd
```

`run-api.cmd` and `run-web.cmd` start them individually. They expect a Python
venv at `config\Scripts\python.exe` — edit the script if yours lives elsewhere.

Cross-platform equivalents:

```bash
cd backend && python -m uvicorn app.main:app --reload --port 8000
```

```bash
cd frontend && npm install && npm run dev
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
| `frontend/` | Web App, **Node 20 LTS** | `.github/workflows/azure-web.yml` |
| `backend/` | Web App **for Containers** | `.github/workflows/azure-api.yml` |

The API ships as a **container**, not a code deployment, because `pyodbc` needs the
Microsoft ODBC driver installed at OS level. `backend/Dockerfile` bakes in `msodbcsql18`;
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

The API app needs **VNet integration** so it can reach the M1 SQL Server —
`core-vnet/appservice` in the Estimator-App resource group, the same integration
the original app uses. This is the step that most often blocks a first deploy:
the app starts fine, reports Running, and every query times out. Set the app's
**Health Check** path to `/status` so that failure is visible rather than silent.

### GitHub secrets

| Secret | Used by |
|---|---|
| `AZURE_WEBAPP_PUBLISH_PROFILE` | web |
| `AZURE_CREDENTIALS` | api |

The API workflow authenticates to the container registry with `az acr login`
using that same service principal, so there is no registry username or password
to store — the registry's admin account stays disabled. The service principal
needs **AcrPush** on the registry and **Contributor** on the Web App, and the
Web App's managed identity needs **AcrPull** so it can pull the image it is told
to run.

Neither app needs to be linked in Azure's **Deployment Center**. That wizard
generates its own workflow and commits it to the repository, which would then
compete with these for the same app.

The API workflow polls `/status` after deploying and fails the run if it does not
return 200 within five minutes, so a broken deploy is visible in Actions rather
than discovered by a salesperson.

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
python backend/app/formula.py
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
├── backend/                  FastAPI service — all M1 access
│   ├── app/
│   │   ├── formula.py            safe AST formula engine
│   │   ├── config_repo.py        reads uCfg* tables
│   │   ├── config_write.py       writes uCfg* tables + change log
│   │   ├── validation_engine.py  condition evaluation
│   │   ├── m1_pricing.py         door + part prices from M1
│   │   ├── pricing_rules/        upgrade + installation rules (moved from src/)
│   │   └── routers/
│   └── Dockerfile                includes msodbcsql18
├── frontend/                  Next.js front end
│   └── src/
│       ├── app/api/              BFF proxy routes (no DB access)
│       ├── components/admin/     configurator setup UI
│       └── components/quote/     quoting + configurator wizard
├── db/                   schema, migrations, seeds, backups
└── .github/workflows/    Azure deployments
```

### The pricing rules

`backend/app/pricing_rules/` holds the original hard-coded upgrade and installation
rules, moved here from the Streamlit proof of concept when it was retired.

They are the *old* engine. The replacement is the data-driven rules in
`uCfgRules`, evaluated by `validation_engine.rule_matches()` and
`formula.evaluate()`. Deleting this package is the goal, but it needs the
database rules proven at parity first — a silent difference there is a wrong
quote. `backend/tests/check_pricing_parity.py` is the harness for that: point it at
the DB-driven engine and it names the configurations that disagree.

