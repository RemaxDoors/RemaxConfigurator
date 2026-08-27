-- =============================================================================
-- Revisions: the configurator's, and the result part's on every rule.
--
-- WHAT THIS IS FOR
--
-- M1 builds a configurator's form id as PART-{PartID}-REV-{PartRevision}, so a
-- wrong or empty revision produces a form id that matches nothing already in
-- FormInputValues. The Movidor sample shows the real one:
--
--   PART-RRD-MOVIDOR-TEMPLATE-REV-BOM
--
-- and curtain and installation both carry an empty revision, so their ids end
-- in "REV-".
--
-- WHAT IT ADDS
--
-- Probably nothing. Both columns are in the original schema:
--
--   uCfgConfigurators.PartRevision   NVARCHAR(5)  NULL   -- the CONFIGURATOR's
--   uCfgRules.ResultRevision                      NULL   -- the result PART's
--
-- The ALTERs below are guarded and will be skipped on a database that already
-- has them. They are here because this script has to be safe to run against
-- production without anyone first checking which columns exist -- that guessing
-- is what let the two databases drift apart before.
--
-- Section 3 is the part you actually edit. It is commented out on purpose: run
-- sections 1 and 2, read the report, then uncomment and set the values.
--
-- Nothing here deletes or overwrites data on its own.
-- =============================================================================

SET NOCOUNT ON;
SET XACT_ABORT ON;

-- --- 1. Add the columns only if they are genuinely missing -------------------

IF COL_LENGTH('dbo.uCfgConfigurators', 'PartRevision') IS NULL
BEGIN
    ALTER TABLE dbo.uCfgConfigurators ADD PartRevision NVARCHAR(5) NULL;
    PRINT 'Added uCfgConfigurators.PartRevision';
END
ELSE
    PRINT 'uCfgConfigurators.PartRevision already exists - nothing to do';

IF COL_LENGTH('dbo.uCfgRules', 'ResultRevision') IS NULL
BEGIN
    ALTER TABLE dbo.uCfgRules ADD ResultRevision NVARCHAR(5) NULL;
    PRINT 'Added uCfgRules.ResultRevision';
END
ELSE
    PRINT 'uCfgRules.ResultRevision already exists - nothing to do';
GO

-- --- 2. Report: what the revisions are now, and what M1 will be sent ---------
--
-- PartRevision is NVARCHAR(5). A longer value cannot be stored, which is why
-- the app refuses it in the editor rather than letting SQL Server truncate it.

SELECT
    c.CfgID,
    c.PartID,
    c.ConfiguratorName,
    c.DoorType,
    c.PartRevision                                   AS CurrentRevision,
    'PART-' + c.PartID + '-REV-'
        + ISNULL(c.PartRevision, '')                 AS FormIdSentToM1,
    CASE
        WHEN c.PartRevision IS NULL THEN 'NULL - form id will end in REV-'
        WHEN LEN(c.PartRevision) > 5 THEN 'TOO LONG for NVARCHAR(5)'
        ELSE 'set'
    END                                              AS Status
FROM dbo.uCfgConfigurators c
WHERE c.IsActive = 1
ORDER BY c.ConfiguratorName;

-- Result-part revisions on the rules, grouped so a whole configurator's rules
-- can be seen at once rather than one row at a time.
SELECT
    c.PartID                AS Configurator,
    r.ResultPartID,
    r.ResultRevision,
    COUNT(*)                AS RuleCount
FROM dbo.uCfgRules r
JOIN dbo.uCfgConfigurators c ON c.CfgID = r.CfgID
WHERE r.IsActive = 1
  AND r.ResultPartID IS NOT NULL
GROUP BY c.PartID, r.ResultPartID, r.ResultRevision
ORDER BY c.PartID, r.ResultPartID;
GO

-- --- 3. Set them. Uncomment and edit. ---------------------------------------
--
-- The configurator revision. Movidor is BOM; curtain and installation are
-- blank in M1, and '' is deliberate there rather than NULL, so that the
-- intent is recorded rather than looking like a row nobody got to.

/*
BEGIN TRAN;

UPDATE dbo.uCfgConfigurators SET PartRevision = 'BOM'
WHERE  PartID = 'RRD-MOVIDOR-TEMPLATE';

UPDATE dbo.uCfgConfigurators SET PartRevision = ''
WHERE  PartID IN ('CURTAIN-TEMPLATE', 'INSTALLATION-TEMPLATE');

-- Check before committing: every active configurator, and the id M1 gets.
SELECT PartID, ConfiguratorName, PartRevision,
       'PART-' + PartID + '-REV-' + ISNULL(PartRevision, '') AS FormId
FROM   dbo.uCfgConfigurators WHERE IsActive = 1 ORDER BY PartID;

-- COMMIT;      -- run this once the rows above look right
-- ROLLBACK;    -- or this if they do not
*/

-- The result-part revision on a rule. Blank and NULL are NOT the same to M1's
-- part lookup, so set this only where you know the part genuinely has a
-- revision -- leaving it NULL is the safer default.

/*
BEGIN TRAN;

UPDATE r
SET    r.ResultRevision = 'A'
FROM   dbo.uCfgRules r
JOIN   dbo.uCfgConfigurators c ON c.CfgID = r.CfgID
WHERE  c.PartID = 'RRD-MOVIDOR-TEMPLATE'
  AND  r.ResultPartID = 'PUT-THE-PART-ID-HERE';

SELECT c.PartID, r.RuleCode, r.ResultPartID, r.ResultRevision
FROM   dbo.uCfgRules r
JOIN   dbo.uCfgConfigurators c ON c.CfgID = r.CfgID
WHERE  c.PartID = 'RRD-MOVIDOR-TEMPLATE' AND r.IsActive = 1
ORDER  BY r.RuleCode;

-- COMMIT;
-- ROLLBACK;
*/

-- --- 4. Record the run ------------------------------------------------------

IF OBJECT_ID('dbo.uCfgMigrations', 'U') IS NOT NULL
    INSERT INTO dbo.uCfgMigrations (Version, Script, Notes)
    VALUES ('v0.6.0', '01_revisions.sql',
            'Guarded PartRevision / ResultRevision, plus the report used to set them.');
GO
