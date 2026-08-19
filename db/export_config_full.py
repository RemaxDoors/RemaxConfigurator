"""Export RP_config as ONE self-contained script: tables, keys, indexes, data.

Why this exists alongside export_config_data.py: the incremental uCfg_*.sql
migration scripts no longer reproduce the live schema. Columns were added over
time by Python migrations rather than DDL, and the drift is uneven — every
table has CreatedBy except uCfgM1FieldMap, for instance. Standing up a new
server from those scripts leaves columns missing, and the data load then fails
partway through with an error naming one column at a time.

This reads the actual schema out of the live database and writes the CREATE
TABLE statements to match, followed by the data. Nothing to drift from: one
file, run once, done.

    python db/export_config_full.py            -> db/RP_config_full.sql
    python db/export_config_full.py --out x.sql

    sqlcmd -S <server> -d RP_config -b -i db/RP_config_full.sql

It DROPs and recreates every uCfg table, so it replaces whatever is there.
"""
from __future__ import annotations

import argparse
import datetime
import os
import sys

from sqlalchemy import text

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))
from app import config_repo, settings  # noqa: E402

# Parents before children, so foreign keys are satisfiable as the data loads.
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
    "uCfgChangeLog",
]

SKIP_TYPES = {"timestamp", "rowversion"}
SIZED = {"nvarchar", "nchar", "varchar", "char", "varbinary", "binary"}
WIDE = {"nvarchar", "nchar"}          # max_length is in bytes for these
PRECISE = {"decimal", "numeric"}
SCALED = {"datetime2", "time", "datetimeoffset"}


def column_type(ty: str, max_len: int, prec: int, scale: int) -> str:
    t = ty.lower()
    if t in SIZED:
        if max_len == -1:
            return f"{ty}(MAX)"
        n = max_len // 2 if t in WIDE else max_len
        return f"{ty}({n})"
    if t in PRECISE:
        return f"{ty}({prec},{scale})"
    if t in SCALED and scale != 7:
        return f"{ty}({scale})"
    return ty


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
        if isinstance(value, (datetime.datetime, datetime.time)):
            return "'" + value.isoformat(timespec="milliseconds") + "'"
        return "'" + value.isoformat() + "'"
    if t == "uniqueidentifier":
        return "'" + str(value) + "'"
    return "N'" + str(value).replace("'", "''") + "'"


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=os.path.join(os.path.dirname(__file__), "RP_config_full.sql"))
    args = ap.parse_args()

    out: list[str] = []
    counts: list[tuple[str, int]] = []

    with config_repo.get_config_engine().connect() as conn:
        version = conn.execute(text("SELECT @@VERSION")).scalar().splitlines()[0].strip()
        present = [t for t in TABLE_ORDER
                   if conn.execute(text("SELECT OBJECT_ID(:t)"), {"t": f"dbo.{t}"}).scalar()]

        # --- read the whole schema up front (one cursor at a time) ----------
        cols, pks, uniques, fks, indexes, defaults = {}, {}, {}, [], {}, {}
        for t in present:
            cols[t] = conn.execute(text(
                "SELECT c.name, TYPE_NAME(c.user_type_id), c.max_length, c.precision, "
                "c.scale, c.is_nullable, c.is_identity, c.is_computed, c.default_object_id "
                "FROM sys.columns c WHERE c.object_id = OBJECT_ID(:t) ORDER BY c.column_id"
            ), {"t": f"dbo.{t}"}).fetchall()
            pks[t] = conn.execute(text(
                "SELECT i.name, STRING_AGG(QUOTENAME(c.name), ', ') WITHIN GROUP (ORDER BY ic.key_ordinal) "
                "FROM sys.indexes i "
                "JOIN sys.index_columns ic ON i.object_id=ic.object_id AND i.index_id=ic.index_id "
                "JOIN sys.columns c ON ic.object_id=c.object_id AND ic.column_id=c.column_id "
                "WHERE i.object_id=OBJECT_ID(:t) AND i.is_primary_key=1 GROUP BY i.name"
            ), {"t": f"dbo.{t}"}).fetchone()
            uniques[t] = conn.execute(text(
                "SELECT i.name, STRING_AGG(QUOTENAME(c.name), ', ') WITHIN GROUP (ORDER BY ic.key_ordinal) "
                "FROM sys.indexes i "
                "JOIN sys.index_columns ic ON i.object_id=ic.object_id AND i.index_id=ic.index_id "
                "JOIN sys.columns c ON ic.object_id=c.object_id AND ic.column_id=c.column_id "
                "WHERE i.object_id=OBJECT_ID(:t) AND i.is_unique=1 AND i.is_primary_key=0 "
                "GROUP BY i.name"
            ), {"t": f"dbo.{t}"}).fetchall()
            indexes[t] = conn.execute(text(
                "SELECT i.name, STRING_AGG(QUOTENAME(c.name), ', ') WITHIN GROUP (ORDER BY ic.key_ordinal) "
                "FROM sys.indexes i "
                "JOIN sys.index_columns ic ON i.object_id=ic.object_id AND i.index_id=ic.index_id "
                "JOIN sys.columns c ON ic.object_id=c.object_id AND ic.column_id=c.column_id "
                "WHERE i.object_id=OBJECT_ID(:t) AND i.is_unique=0 AND i.is_primary_key=0 "
                "AND i.name IS NOT NULL AND i.type_desc <> 'HEAP' GROUP BY i.name"
            ), {"t": f"dbo.{t}"}).fetchall()
            defaults[t] = {r[0]: r[1] for r in conn.execute(text(
                "SELECT c.name, d.definition FROM sys.default_constraints d "
                "JOIN sys.columns c ON d.parent_object_id=c.object_id AND d.parent_column_id=c.column_id "
                "WHERE d.parent_object_id = OBJECT_ID(:t)"
            ), {"t": f"dbo.{t}"}).fetchall()}

        fks = conn.execute(text(
            "SELECT fk.name, OBJECT_NAME(fk.parent_object_id), "
            "       STRING_AGG(QUOTENAME(pc.name), ', ') WITHIN GROUP (ORDER BY fkc.constraint_column_id), "
            "       OBJECT_NAME(fk.referenced_object_id), "
            "       STRING_AGG(QUOTENAME(rc.name), ', ') WITHIN GROUP (ORDER BY fkc.constraint_column_id) "
            "FROM sys.foreign_keys fk "
            "JOIN sys.foreign_key_columns fkc ON fk.object_id = fkc.constraint_object_id "
            "JOIN sys.columns pc ON fkc.parent_object_id=pc.object_id AND fkc.parent_column_id=pc.column_id "
            "JOIN sys.columns rc ON fkc.referenced_object_id=rc.object_id AND fkc.referenced_column_id=rc.column_id "
            "GROUP BY fk.name, fk.parent_object_id, fk.referenced_object_id"
        )).fetchall()

        # --- read the data ---------------------------------------------------
        data = {}
        for t in present:
            usable = [(c[0], c[1]) for c in cols[t]
                      if not c[7] and c[1].lower() not in SKIP_TYPES]
            names = ", ".join(f"[{n}]" for n, _ in usable)
            data[t] = (usable, names,
                       conn.execute(text(f"SELECT {names} FROM dbo.{t}")).fetchall())
            counts.append((t, len(data[t][2])))

    # --- write ---------------------------------------------------------------
    stamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    out += [
        "/* RP_config - complete schema and data, generated from the live database",
        f"   {stamp}   source: {settings.CONFIG_DB_SERVER} / {settings.CONFIG_DB_NAME}",
        f"   {version}",
        "",
        "   Self-contained. Do NOT run the uCfg_*.sql migration scripts with this;",
        "   they build the schema incrementally and no longer match what the",
        "   application expects. This is read straight from a working database,",
        "   so there is nothing to drift.",
        "",
        "   Creates the database if absent, then DROPS and recreates every uCfg",
        "   table. Anything already configured on the target is replaced.",
        "",
        "   Contents:",
    ]
    out += [f"     {t:<28} {n:>5} rows" for t, n in counts]
    out += [f"     {'TOTAL':<28} {sum(n for _, n in counts):>5} rows", "*/",
            "SET NOCOUNT ON;",
            "SET XACT_ABORT ON;",
            "GO", ""]

    # drop FKs then tables, children first
    out.append("-- Drop existing objects, children before parents --------------------")
    for name, parent, _pc, _ref, _rc in fks:
        out.append(f"IF OBJECT_ID('dbo.{name}', 'F') IS NOT NULL ALTER TABLE dbo.[{parent}] DROP CONSTRAINT [{name}];")
    for t in reversed(present):
        out.append(f"IF OBJECT_ID('dbo.{t}', 'U') IS NOT NULL DROP TABLE dbo.[{t}];")
    out += ["GO", ""]

    # create tables
    for t in present:
        out.append(f"-- {t} " + "-" * max(0, 60 - len(t)))
        lines = []
        for (name, ty, max_len, prec, scale, nullable, identity, computed, _d) in cols[t]:
            if computed or ty.lower() in SKIP_TYPES:
                continue
            piece = f"    [{name}] {column_type(ty, max_len, prec, scale)}"
            if identity:
                piece += " IDENTITY(1,1)"
            if name in defaults[t]:
                piece += f" DEFAULT {defaults[t][name]}"
            piece += " NOT NULL" if not nullable else " NULL"
            lines.append(piece)
        if pks[t]:
            lines.append(f"    CONSTRAINT [{pks[t][0]}] PRIMARY KEY CLUSTERED ({pks[t][1]})")
        for uname, ucols in uniques[t]:
            lines.append(f"    CONSTRAINT [{uname}] UNIQUE ({ucols})")
        out.append(f"CREATE TABLE dbo.[{t}] (")
        out.append(",\n".join(lines))
        out.append(");")
        for iname, icols in indexes[t]:
            out.append(f"CREATE INDEX [{iname}] ON dbo.[{t}] ({icols});")
        out += ["GO", ""]

    # foreign keys, once every table exists
    out.append("-- Foreign keys ------------------------------------------------------")
    for name, parent, pcols, ref, rcols in fks:
        out.append(f"ALTER TABLE dbo.[{parent}] ADD CONSTRAINT [{name}] "
                   f"FOREIGN KEY ({pcols}) REFERENCES dbo.[{ref}] ({rcols});")
    out += ["GO", ""]

    # data
    out.append("-- Data --------------------------------------------------------------")
    out.append("BEGIN TRANSACTION;")
    for t in present:
        usable, names, rows = data[t]
        if not rows:
            out.append(f"-- {t}: no rows")
            continue
        has_identity = any(c[6] for c in cols[t])
        out.append("")
        out.append(f"-- {t}: {len(rows)} rows")
        if has_identity:
            out.append(f"SET IDENTITY_INSERT dbo.[{t}] ON;")
        for row in rows:
            values = ", ".join(literal(v, ty) for v, (_n, ty) in zip(row, usable))
            out.append(f"INSERT INTO dbo.[{t}] ({names}) VALUES ({values});")
        if has_identity:
            out.append(f"SET IDENTITY_INSERT dbo.[{t}] OFF;")
            out.append(f"DBCC CHECKIDENT ('dbo.{t}', RESEED);")
    out += ["", "COMMIT TRANSACTION;", "GO", ""]

    for t, _n in counts:
        out.append(f"SELECT '{t}' AS TableName, COUNT(*) AS [Rows] FROM dbo.[{t}];")
    out += ["GO", ""]

    with open(args.out, "w", encoding="utf-8") as fh:
        fh.write("\n".join(out))

    print(f"written: {args.out}")
    print(f"  {len(present)} tables, {sum(n for _, n in counts)} rows, {len(fks)} foreign keys")
    for t, n in counts:
        print(f"    {t:<28} {n:>5}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
