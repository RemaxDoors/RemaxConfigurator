"""Export RP_config's data as a plain INSERT script.

Why this rather than a backup: SQL Server backups only restore forward. A
database on SQL 2022 cannot be restored onto an older instance, so moving
RP_config to a server on an earlier version needs the data recreated rather
than copied. The data is small (~1,500 rows), so a script is the simplest
version-independent way to do it — and unlike the Import/Export wizard it is
repeatable, reviewable, and can live in git.

    python db/export_config_data.py                 -> db/RP_config_data.sql
    python db/export_config_data.py --out other.sql

To rebuild on the target server:

    1. CREATE DATABASE RP_config
    2. run the db/uCfg_*.sql schema scripts (plain DDL, any version)
    3. run the file this produces

Identity values are preserved with IDENTITY_INSERT, because the foreign keys
reference them — uCfgParameterOptions.ParamID and uCfgRuleConditions.RuleID
would point at the wrong parents if the target reassigned them. Each table's
identity is reseeded afterwards so later inserts don't collide.
"""
from __future__ import annotations

import argparse
import datetime
import os
import sys

from sqlalchemy import text

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "api"))
from app import config_repo, settings  # noqa: E402

# Parents before children, so the foreign keys are satisfiable as it runs.
TABLE_ORDER = [
    "uCfgConfigurators",
    "uCfgParameters",
    "uCfgParameterOptions",
    "uCfgDefaults",
    "uCfgDefaultConditions",
    "uCfgRules",
    "uCfgRuleConditions",
    "uCfgValidationRules",
    "uCfgValidationConditions",
    "uCfgConfiguratorLinks",
    "uCfgM1FieldMap",
]

# Written by the server, never inserted.
SKIP_TYPES = {"timestamp", "rowversion"}


def literal(value, sql_type: str) -> str:
    if value is None:
        return "NULL"
    t = sql_type.lower()
    if t == "bit":
        return "1" if value else "0"
    if t in ("int", "bigint", "smallint", "tinyint", "decimal", "numeric",
             "float", "real", "money", "smallmoney"):
        return str(value)
    if t in ("datetime", "datetime2", "smalldatetime", "date", "time",
             "datetimeoffset"):
        # ISO 8601 with a T separator, so the literal is unambiguous whatever
        # the target server's language/dateformat is. Milliseconds, not
        # microseconds: `datetime` only holds three decimal places and rejects
        # Python's default six.
        if isinstance(value, (datetime.datetime, datetime.time)):
            return "'" + value.isoformat(timespec="milliseconds") + "'"
        return "'" + value.isoformat() + "'"
    if t == "uniqueidentifier":
        return "'" + str(value) + "'"
    return "N'" + str(value).replace("'", "''") + "'"


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=os.path.join(os.path.dirname(__file__), "RP_config_data.sql"))
    args = ap.parse_args()

    stamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    out: list[str] = []
    counts: list[tuple[str, int]] = []

    with config_repo.get_config_engine().connect() as conn:
        version = conn.execute(text("SELECT @@VERSION")).scalar().splitlines()[0].strip()

        for table in TABLE_ORDER:
            if not conn.execute(text("SELECT OBJECT_ID(:t)"), {"t": f"dbo.{table}"}).scalar():
                out.append(f"-- {table}: not present in the source, skipped")
                continue

            cols = conn.execute(text(
                "SELECT c.name, TYPE_NAME(c.user_type_id), c.is_identity, c.is_computed "
                "FROM sys.columns c WHERE c.object_id = OBJECT_ID(:t) ORDER BY c.column_id"
            ), {"t": f"dbo.{table}"}).fetchall()
            usable = [(n, ty) for n, ty, _ident, computed in cols
                      if not computed and ty.lower() not in SKIP_TYPES]
            has_identity = any(ident for _n, _ty, ident, _c in cols)
            names = ", ".join(n for n, _ in usable)

            rows = conn.execute(text(
                f"SELECT {names} FROM dbo.{table}"
            )).fetchall()
            counts.append((table, len(rows)))

            out.append("")
            out.append(f"-- {table}: {len(rows)} rows " + "-" * max(0, 52 - len(table)))
            if not rows:
                continue
            if has_identity:
                out.append(f"SET IDENTITY_INSERT dbo.{table} ON;")
            for row in rows:
                values = ", ".join(literal(v, ty) for v, (_n, ty) in zip(row, usable))
                out.append(f"INSERT INTO dbo.{table} ({names}) VALUES ({values});")
            if has_identity:
                out.append(f"SET IDENTITY_INSERT dbo.{table} OFF;")
                # Reseed so the next natural insert doesn't collide.
                out.append(f"DBCC CHECKIDENT ('dbo.{table}', RESEED);")

    header = [
        f"/* RP_config data, exported {stamp}",
        f"   Source: {settings.DB_SERVER} / {settings.CONFIG_DB_NAME}",
        f"   {version}",
        "",
        "   Run AFTER the schema scripts (db/uCfg_*.sql) on the target server.",
        "   Deletes and reloads every uCfg table, so it is re-runnable, but it",
        "   will discard anything already configured on the target.",
        "",
        "   Tables, in foreign-key order:",
    ]
    header += [f"     {t:<28} {n:>5} rows" for t, n in counts]
    header += [f"     {'TOTAL':<28} {sum(n for _, n in counts):>5} rows", "*/",
               "SET NOCOUNT ON;",
               "SET XACT_ABORT ON;   -- roll the whole load back if any row fails",
               "BEGIN TRANSACTION;",
               "",
               "-- Clear everything first, children before parents. Deleting a table",
               "-- immediately before loading it would fail: its rows are still",
               "-- referenced by child tables that have not been cleared yet.",
               ]
    header += [f"DELETE FROM dbo.{t};" for t, _n in reversed(counts)]

    footer = ["", "COMMIT TRANSACTION;", "PRINT 'RP_config data loaded.';", ""]
    for table, _n in counts:
        footer.insert(-2, f"SELECT '{table}' AS TableName, COUNT(*) AS Rows FROM dbo.{table};")

    with open(args.out, "w", encoding="utf-8") as fh:
        fh.write("\n".join(header + out + footer))

    print(f"written: {args.out}")
    for t, n in counts:
        print(f"  {t:<28} {n:>5} rows")
    print(f"  {'TOTAL':<28} {sum(n for _, n in counts):>5} rows")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
