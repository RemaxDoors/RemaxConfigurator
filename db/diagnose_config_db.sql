-- =============================================================================
-- Why is the configurator showing no sections / no rules?
--
-- The API is deliberately tolerant of an un-migrated database: config_repo.py
-- checks for a column and falls back when it is absent, so the app starts,
-- /status reports healthy row counts, and the missing pieces are simply never
-- shown. That tolerance is what makes this hard to spot from the UI.
--
-- Run this against the config database the API points at (CONFIG_DB_NAME).
-- Read-only: it inspects metadata and counts rows, and changes nothing.
-- =============================================================================

SET NOCOUNT ON;
PRINT 'Database: ' + DB_NAME() + '   Server: ' + @@SERVERNAME;
PRINT '';

-- ── 1. Which uCfg tables exist? ──────────────────────────────────────────────
PRINT '--- Tables ---';
SELECT expected.TableName,
       CASE WHEN OBJECT_ID('dbo.' + expected.TableName, 'U') IS NULL
            THEN 'MISSING' ELSE 'present' END AS Status
FROM (VALUES
    ('uCfgConfigurators'), ('uCfgParameters'), ('uCfgParameterOptions'),
    ('uCfgDefaults'), ('uCfgDefaultConditions'), ('uCfgRules'),
    ('uCfgRuleConditions'), ('uCfgValidationRules'), ('uCfgValidationConditions'),
    ('uCfgConfiguratorLinks'), ('uCfgChangeLog')
) AS expected(TableName)
ORDER BY Status, expected.TableName;

-- ── 2. The columns the API silently falls back on ────────────────────────────
-- Each of these, when absent, disables a feature without any error:
--   uCfgParameters.Section        -> form shows one flat list, and saving a
--                                    section on a parameter is discarded
--   uCfgRules.RuleID              -> load_rules() returns [], so NO pricing
--                                    rules fire even though the rows are there
--   uCfgRules.QuantityUnit        -> quantity unit / formula / notes ignored
--   uCfgRules.ResultRevisionFormula -> revision-by-configuration ignored
--   uCfgRules.ConditionFormula    -> slot-counting conditions ignored
PRINT '';
PRINT '--- Columns the API needs (MISSING = feature silently disabled) ---';
SELECT chk.TableName, chk.ColumnName,
       CASE WHEN OBJECT_ID('dbo.' + chk.TableName, 'U') IS NULL THEN 'no such table'
            WHEN COL_LENGTH('dbo.' + chk.TableName, chk.ColumnName) IS NULL THEN 'MISSING'
            ELSE 'present' END AS Status,
       chk.FixScript
FROM (VALUES
    ('uCfgParameters', 'Section',               'db/uCfg_add_section.sql'),
    ('uCfgParameters', 'SortOrder',             'db/uCfg_configurator_schema.sql'),
    ('uCfgRules',      'RuleID',                'db/uCfg_pricing_rules_schema.sql'),
    ('uCfgRules',      'QuantityUnit',          'db/uCfg_rules_add_quantity_fields.sql'),
    ('uCfgRules',      'QuantityFormula',       'db/uCfg_schema_catchup.sql'),
    ('uCfgRules',      'Notes',                 'db/uCfg_schema_catchup.sql'),
    ('uCfgRules',      'ResultRevisionFormula', 'db/uCfg_schema_catchup.sql'),
    ('uCfgRules',      'ConditionFormula',      'db/uCfg_rules_add_condition_formula.sql'),
    ('uCfgDefaults',   'Priority',              'db/uCfg_schema_catchup.sql'),
    ('uCfgDefaults',   'ValueFormula',          'db/uCfg_schema_catchup.sql'),
    ('uCfgDefaults',   'IsManual',              'db/uCfg_schema_catchup.sql'),
    ('uCfgParameters', 'CreatedBy',             'db/uCfg_add_audit_columns.sql')
) AS chk(TableName, ColumnName, FixScript)
ORDER BY CASE WHEN COL_LENGTH('dbo.' + chk.TableName, chk.ColumnName) IS NULL
              THEN 0 ELSE 1 END, chk.TableName, chk.ColumnName;

-- ── 3. How much section data is actually populated? ──────────────────────────
PRINT '';
PRINT '--- Sections per configurator (only runs if the column exists) ---';
IF COL_LENGTH('dbo.uCfgParameters', 'Section') IS NOT NULL
    EXEC sp_executesql N'
        SELECT c.PartID,
               COUNT(*)                                             AS Parameters,
               SUM(CASE WHEN p.Section IS NULL OR LTRIM(RTRIM(p.Section)) = ''''
                        THEN 0 ELSE 1 END)                          AS WithSection,
               COUNT(DISTINCT p.Section)                            AS DistinctSections
        FROM dbo.uCfgParameters p
        JOIN dbo.uCfgConfigurators c ON c.CfgID = p.CfgID
        GROUP BY c.PartID ORDER BY c.PartID;';
ELSE
BEGIN
    -- BEGIN/END matters: without it only the first PRINT is part of the ELSE
    -- and the rest run unconditionally, reporting a missing column on a
    -- database that has one.
    PRINT '  uCfgParameters.Section does not exist - this is the cause of the';
    PRINT '  flat form AND of sections not saving. Run db/uCfg_add_section.sql.';
END

-- ── 4. Are the rules reachable the way the API reads them? ───────────────────
-- /status counts rows straight out of uCfgRules, so it reports a healthy
-- number even when load_rules() can return nothing. This mirrors the API's
-- own JOIN, which is the count that actually matters.
PRINT '';
PRINT '--- Rules as the API loads them (JOIN to uCfgConfigurators) ---';
SELECT c.PartID,
       (SELECT COUNT(*) FROM dbo.uCfgRules x WHERE x.CfgID = c.CfgID) AS RowsInTable,
       (SELECT COUNT(*) FROM dbo.uCfgRules r
          JOIN dbo.uCfgConfigurators c2 ON r.CfgID = c2.CfgID
         WHERE c2.CfgID = c.CfgID)                                    AS LoadableByApi
FROM dbo.uCfgConfigurators c
ORDER BY c.PartID;

PRINT '';
PRINT 'Anything marked MISSING above explains a feature that appears to work';
PRINT 'but silently does nothing. Run the listed script, then RESTART the API.';
