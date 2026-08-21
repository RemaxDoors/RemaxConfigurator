-- =============================================================================
-- Brush seal: restore M1's per-door-model option list as validation rules.
--
-- M1's PopulateBrushSeal(cDoorModel, cValue) rebuilds CmbBrushSeal every time
-- the door model changes -- five different lists. Our dropdown holds the
-- flattened union of all five, so a salesperson picking an ES40 is offered
-- "Legs" and "Fascia Only", which that door has never taken.
--
-- These five rules re-impose the per-model list. They flag a wrong choice
-- rather than removing it from the dropdown: the app has no mechanism for an
-- option that appears only under a condition, and adding one is a schema
-- change. Say the word if you want the dropdown itself filtered.
--
-- M1's list, mapped onto the values we actually store:
--   ES40                              None | Full Guides (Std) | Full Guides & Fascia/Hood
--   EX35, EX45                        None | Fascia Only | Leg seal for Pressure Room Only
--   *THERMIC, MOVICHILL, -XL          Full Guides & Fascia/Hood  (the only choice)
--   MOVIFOLD, CONCERTINA              None | Legs
--   HS35, HS50, HS65                  None | 500 top of Guides (Std) | Guides Only | Full Guides & Fascia/Hood
--
-- Two branches of the VBScript suffix their default with "(Std)" -- "None
-- (Std)" and "Full Guides & Fascia/Hood (Std)". Our option list normalised
-- those to the unsuffixed value and the PRICING rules depend on it: RRD-20..24
-- test CMBBRUSHSEAL not_contains "Std", so re-adding the suffix would change
-- what the brush seal upgrade charges. The values below are deliberately ours.
--
-- HS25 appears in the VBScript but is not in CMBDOORMODEL's option list, so it
-- is not covered here. Add it to BSEAL-ES40's model list if it comes back.
--
-- Checked before writing: all 12 door models x 8 values = 96 combinations,
-- against a direct port of PopulateBrushSeal. Zero disagreements, and neither a
-- blank door model nor a blank brush seal fires anything.
--
-- Re-runnable: each rule is rebuilt from scratch.
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

DECLARE @V TABLE (
    RuleCode NVARCHAR(30) PRIMARY KEY,
    Models   NVARCHAR(255),
    Allowed  NVARCHAR(255),
    Msg      NVARCHAR(500)
);

INSERT INTO @V (RuleCode, Models, Allowed, Msg) VALUES
 (N'BSEAL-ES40', N'ES40',
  N'None, Full Guides (Std), Full Guides & Fascia/Hood',
  N'ES40 takes None, Full Guides (Std) or Full Guides & Fascia/Hood.')
,(N'BSEAL-EX', N'EX35, EX45',
  N'None, Fascia Only, Leg seal for Pressure Room Only',
  N'EX35 and EX45 take None, Fascia Only or Leg seal for Pressure Room Only.')
,(N'BSEAL-THERMIC', N'HS35-THERMIC, HS50-THERMIC, MOVICHILL, MOVICHILL-XL',
  N'Full Guides & Fascia/Hood',
  N'Thermic and Movichill doors are always Full Guides & Fascia/Hood.')
,(N'BSEAL-FOLD', N'MOVIFOLD, CONCERTINA',
  N'None, Legs',
  N'Movifold and Concertina take None or Legs.')
,(N'BSEAL-STD', N'HS35, HS50, HS65',
  N'None, 500 top of Guides (Std), Guides Only, Full Guides & Fascia/Hood',
  N'This model takes None, 500 top of Guides (Std), Guides Only or Full Guides & Fascia/Hood.')
;

-- Rebuild from scratch so a re-run cannot leave a stale condition behind.
DELETE vc
FROM dbo.uCfgValidationConditions vc
JOIN dbo.uCfgValidationRules r ON r.ValidationID = vc.ValidationID
JOIN @V v ON v.RuleCode = r.RuleCode
WHERE r.CfgID = @Cfg;

DELETE r
FROM dbo.uCfgValidationRules r
JOIN @V v ON v.RuleCode = r.RuleCode
WHERE r.CfgID = @Cfg;

INSERT INTO dbo.uCfgValidationRules
    (CfgID, RuleCode, Severity, TargetField, Message, IsActive, CreatedBy)
SELECT @Cfg, v.RuleCode, N'error', N'CMBBRUSHSEAL', v.Msg, 1, N'brush-seal-script'
FROM @V v;

INSERT INTO dbo.uCfgValidationConditions
    (ValidationID, GroupNo, ControlName, Operator, CompareValue)
SELECT r.ValidationID, 1, N'CMBDOORMODEL', N'in', v.Models
FROM dbo.uCfgValidationRules r JOIN @V v ON v.RuleCode = r.RuleCode
WHERE r.CfgID = @Cfg
UNION ALL
SELECT r.ValidationID, 1, N'CMBBRUSHSEAL', N'not_in', v.Allowed
FROM dbo.uCfgValidationRules r JOIN @V v ON v.RuleCode = r.RuleCode
WHERE r.CfgID = @Cfg
UNION ALL
-- Nothing chosen yet is not a wrong choice. Without this the rule fires the
-- moment a door model is picked, before the brush seal has been touched.
SELECT r.ValidationID, 1, N'CMBBRUSHSEAL', N'not_equals', N''
FROM dbo.uCfgValidationRules r JOIN @V v ON v.RuleCode = r.RuleCode
WHERE r.CfgID = @Cfg;

COMMIT TRANSACTION;

SELECT r.RuleCode, r.Severity, r.TargetField,
       (SELECT COUNT(*) FROM dbo.uCfgValidationConditions c
         WHERE c.ValidationID = r.ValidationID) AS Conditions,
       r.Message
FROM dbo.uCfgValidationRules r
JOIN @V v ON v.RuleCode = r.RuleCode
WHERE r.CfgID = @Cfg
ORDER BY r.RuleCode;

PRINT '';
PRINT 'Each rule should show 3 conditions: the door models it covers, the';
PRINT 'brush seal values it forbids, and the not-yet-chosen guard.';

-- -- Record this migration ------------------------------------------------
-- Runs whether the script was applied by the runner or by hand in SSMS.
-- Skipped silently if 000_migration_log.sql has not been run yet, so an older
-- database is never blocked by the bookkeeping.
IF OBJECT_ID('dbo.uCfgMigrations', 'U') IS NOT NULL
    INSERT INTO dbo.uCfgMigrations (Version, Script, Notes)
    VALUES (N'v0.3.0', N'02_brush_seal_validations.sql', N'Per-door-model brush seal lists as validation rules');
GO
