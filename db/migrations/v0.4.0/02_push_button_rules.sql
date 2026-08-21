-- =============================================================================
-- Push button rules, and the CMBPED1 / CMBPED2 options they depend on.
--
-- M1's method for the push button assembly:
--
--   imaPartID
--     If InStr(Parameters("CmbPed1").Value,"Jbox")>0
--        AND Parameters("cmbSpecification").Value = "Woolworths - EX35" then
--         formula = "EL-PBUTT-SWASS-GRP-MUSH"
--     elseif InStr(Parameters("CmbPed1").Value,"Jbox")>0 then
--         formula = "EL-PBUTT-SWASS-GRP"
--
--   imaUpgrade
--     If InStr(Parameters("CmbPed1").Value,"Jbox")>0 then TRUE else FALSE
--
-- PART 1 IS THE POINT. CMBPED1 currently offers only:
--     Not Required | Door Column Left | Door Column Right
--     Side Cover Left | Side Cover Right
-- Not one of those contains "Jbox", so the rule below can never fire until the
-- In Jbox options exist. The specification defaults have the same problem --
-- eight of them set CMBPED1/CMBPED2 to an "In Jbox - ..." value that the
-- dropdown cannot show.
--
-- Only the two In Jbox values the specifications actually use are added. M1
-- very likely has Right-hand variants too; this script does not invent them.
-- Check PopulateJBox (or whatever builds CmbPed1) and add any that are missing.
--
-- The elseif matters: our rules all evaluate independently, so the general rule
-- carries an explicit "specification is not Woolworths - EX35" condition.
-- Without it a Woolworths door would get both push button assemblies.
--
-- Both parts confirmed present in M1.
--
-- Re-runnable.
-- =============================================================================

SET NOCOUNT ON;
SET XACT_ABORT ON;
BEGIN TRANSACTION;

DECLARE @Cfg INT = (
    SELECT TOP 1 CfgID FROM dbo.uCfgConfigurators
    WHERE PartID = N'RRD-MOVIDOR-TEMPLATE'
);
IF @Cfg IS NULL
BEGIN
    RAISERROR('RRD-MOVIDOR-TEMPLATE not found - wrong database?', 16, 1);
    ROLLBACK TRANSACTION;
    RETURN;
END;

-- -- Part 1: the In Jbox options -------------------------------------------
DECLARE @Ped TABLE (ControlName NVARCHAR(50));
INSERT INTO @Ped VALUES (N'CMBPED1'), (N'CMBPED2');

INSERT INTO dbo.uCfgParameterOptions (ParamID, OptionValue, OptionLabel, SortOrder, IsActive)
SELECT p.ParamID, v.OptionValue, v.OptionValue,
       (SELECT ISNULL(MAX(SortOrder), 0) FROM dbo.uCfgParameterOptions x WHERE x.ParamID = p.ParamID)
         + ROW_NUMBER() OVER (PARTITION BY p.ParamID ORDER BY v.OptionValue),
       1
FROM dbo.uCfgParameters p
JOIN @Ped t ON t.ControlName = p.ControlName
CROSS JOIN (VALUES
    (N'In Jbox - Door Side Left'),
    (N'In Jbox - Non Door Side Left')
) AS v(OptionValue)
WHERE p.CfgID = @Cfg
  AND NOT EXISTS (
      SELECT 1 FROM dbo.uCfgParameterOptions e
      WHERE e.ParamID = p.ParamID AND e.OptionValue = v.OptionValue);

-- -- Part 2: the rules -------------------------------------------------------
DECLARE @R TABLE (
    RuleCode NVARCHAR(30) PRIMARY KEY,
    Name     NVARCHAR(100),
    PartID   NVARCHAR(30),
    Notes    NVARCHAR(400)
);
INSERT INTO @R (RuleCode, Name, PartID, Notes) VALUES
 (N'RRD-65', N'Push Button, J-Box, Woolworths', N'EL-PBUTT-SWASS-GRP-MUSH',
  N'Mushroom head for Woolworths - EX35. Fires only when CMBPED1 is an In Jbox option.')
,(N'RRD-66', N'Push Button, J-Box', N'EL-PBUTT-SWASS-GRP',
  N'The elseif branch: any other specification. Carries an explicit not-Woolworths condition so both rules cannot fire at once.')
;

DELETE rc FROM dbo.uCfgRuleConditions rc
JOIN dbo.uCfgRules r ON r.RuleID = rc.RuleID
JOIN @R v ON v.RuleCode = r.RuleCode
WHERE r.CfgID = @Cfg;

DELETE r FROM dbo.uCfgRules r
JOIN @R v ON v.RuleCode = r.RuleCode
WHERE r.CfgID = @Cfg;

INSERT INTO dbo.uCfgRules
    (CfgID, RuleCode, Name, Category, ResultPartID, Quantity, QuantityUnit, Notes, IsActive)
SELECT @Cfg, v.RuleCode, v.Name, N'ASSEMBLY_UPGRADE', v.PartID, N'1', N'Per Door', v.Notes, 1
FROM @R v;

DECLARE @R65 INT = (SELECT RuleID FROM dbo.uCfgRules WHERE CfgID = @Cfg AND RuleCode = N'RRD-65');
DECLARE @R66 INT = (SELECT RuleID FROM dbo.uCfgRules WHERE CfgID = @Cfg AND RuleCode = N'RRD-66');

INSERT INTO dbo.uCfgRuleConditions (RuleID, GroupNo, ControlName, Operator, CompareValue)
VALUES
    -- Woolworths branch
    (@R65, 1, N'CMBPED1',          N'contains',   N'Jbox'),
    (@R65, 1, N'CMBSPECIFICATION', N'equals',     N'Woolworths - EX35'),
    -- everything else
    (@R66, 1, N'CMBPED1',          N'contains',   N'Jbox'),
    (@R66, 1, N'CMBSPECIFICATION', N'not_equals', N'Woolworths - EX35');

COMMIT TRANSACTION;

SELECT p.ControlName, o.OptionValue
FROM dbo.uCfgParameterOptions o
JOIN dbo.uCfgParameters p ON p.ParamID = o.ParamID
WHERE p.CfgID = @Cfg AND p.ControlName IN (N'CMBPED1', N'CMBPED2')
ORDER BY p.ControlName, o.SortOrder;

SELECT r.RuleCode, r.Name, r.ResultPartID, r.Category, r.Quantity,
       (SELECT COUNT(*) FROM dbo.uCfgRuleConditions c WHERE c.RuleID = r.RuleID) AS Conditions
FROM dbo.uCfgRules r
WHERE r.CfgID = @Cfg AND r.RuleCode IN (N'RRD-65', N'RRD-66')
ORDER BY r.RuleCode;

PRINT '';
PRINT 'CMBSPECIFICATION must exist for these conditions to mean anything -';
PRINT 'run db/spec_defaults_rrd.sql first, which creates it.';
PRINT '';
PRINT 'Not covered, because the M1 method does not mention it: CMBPED2 being';
PRINT 'an In Jbox option on its own, and whether two J-box buttons should bill';
PRINT 'a quantity of 2. Both rules are quantity 1 off CMBPED1 alone.';

-- -- Record this migration ------------------------------------------------
-- Runs whether the script was applied by the runner or by hand in SSMS.
-- Skipped silently if 000_migration_log.sql has not been run yet, so an older
-- database is never blocked by the bookkeeping.
IF OBJECT_ID('dbo.uCfgMigrations', 'U') IS NOT NULL
    INSERT INTO dbo.uCfgMigrations (Version, Script, Notes)
    VALUES (N'v0.4.0', N'02_push_button_rules.sql', N'In Jbox options on CMBPED1/2, plus RRD-65 and RRD-66');
GO
