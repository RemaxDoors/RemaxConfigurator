# Migrations

Configuration changes to `RP_config`, grouped by the release that introduced
them. Run in folder order, then filename order inside each folder.

Every script is **idempotent** — safe to run twice — and records itself in
`dbo.uCfgMigrations`, so what has been applied to a database is a query rather
than a guess:

```sql
SELECT Version, Script, AppliedUtc, AppliedBy FROM dbo.uCfgMigrations ORDER BY AppliedUtc;
```

That table exists because the local and Azure databases drifted apart without
anyone noticing: both held exactly 62 rules, but not the same 62.

## Do I need to run these?

| Change | SQL needed? |
|---|---|
| **Misc Extra on the summary** (description, price, cost) | **No.** The pricing engine reads them from the posted values, so the summary fields work as soon as the app deploys. |
| Misc Extra as fields *in the configurator wizard* | Yes — `v0.3.0/01` |
| Brush seal limited per door model | Yes — `v0.3.0/02` |
| Sections, activation rule formulas, RRD-63/64 | Yes — `v0.2.0` |
| Specification defaults, `CMBSPECIFICATION` | Yes — `v0.4.0/01` |
| Push button rules and the In Jbox options | Yes — `v0.4.0/02` |
| Swing door parameters | No SQL — import `db/import_samples/swi_pvc_parameters.csv` from the Parameters tab |
| Editable quote lines, part cost, upgrade detail, delete protection, rename | No — code only |

## Running them

Back up first. These change pricing configuration.

```bash
pwsh db/migrations/run_migrations.ps1 -Server GIZEME -Database RP_config -WhatIf
```

Drop `-WhatIf` to apply. For Azure SQL:

```bash
pwsh db/migrations/run_migrations.ps1 -Server myserver.database.windows.net -Database RP_config -User cfgadmin
```

It prompts for the password rather than taking it on the command line, stops at
the first failure, and prints the applied log at the end. `-OnlyVersion v0.4.0`
runs a single folder.

By hand instead, in this order — the footer records each one either way:

```bash
sqlcmd -S <server> -d RP_config -U <user> -P <password> -C -b -i db/migrations/000_migration_log.sql
```

**Restart the API afterwards.** `column_exists` caches a positive result for the
life of the process.

## Order matters

`run_migrations.ps1` stops at the first failure on purpose. A half-applied set
is worse than none:

- `v0.2.0/02` (activation formulas) refuses unless every rule code exists
- `v0.4.0/02` (push button rules) tests `CMBSPECIFICATION`, which `v0.4.0/01` creates
- `v0.2.0/01` needs `uCfgParameters.Section`, added by `db/uCfg_add_section.sql`

## What is not here

Schema and seed scripts stay in `db/` — they build a database rather than change
one. See the main README for the first-time order.

Two scripts in `db/` are **superseded** and should not be run:

- `fix_ixio_radar_rules.sql` — covered by `v0.2.0/02`
- `add_missing_rrd_rules.sql` — covered by `v0.2.0/01`

`db/diagnose_config_db.sql` is read-only and safe at any time. It reports which
columns a database is missing and names the script that adds each.

## Adding a migration

1. New folder `vX.Y.Z/` matching the release in `backend/app/version.py`.
2. Number the script by the order it must run: `01_`, `02_`.
3. Make it idempotent — `IF NOT EXISTS`, or rebuild-from-scratch.
4. Wrap it in a transaction and roll back rather than half-applying.
5. Copy the recording footer from an existing script.
