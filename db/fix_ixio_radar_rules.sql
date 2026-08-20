-- =============================================================================
-- IXIO radar rules: give them their conditions and counted quantity.
--
-- RRD-27, RRD-28 and RRD-29 were created with no conditions and a fixed
-- quantity of 1. Their intent was recorded only as prose in Notes:
--     "Qty = count of CMBRADAR1/2 = 'IXIO Sensor - Long Stalk'"
--
-- rule_matches() treats an empty condition list as satisfied, so all three
-- assemblies are currently added to EVERY quote at quantity 1 no matter what
-- the radars are set to. That is both a missing charge (two IXIO sensors bill
-- as one) and a wrong one (an IXIO part on a quote with no IXIO sensor).
--
-- The M1 method for RRD-IXIO-LONGASS reads:
--     If ( Trim(Parameters("CmbRadar1").Value) = "IXIO Sensor - Long Stalk"
--       OR Trim(Parameters("CmbRadar2").Value) = "IXIO Sensor - Long Stalk" )
--     ...
--     cCount = 0
--     If Parameters("CmbRadar1").Value = "IXIO Sensor - Long Stalk" then cCount = 1
--     If Parameters("CmbRadar2").Value = "IXIO Sensor - Long Stalk" then cCount = cCount + 1
--     formula = cCount
--
-- Both halves are the same count, so one expression serves both: the rule
-- fires when the count is above zero, and the count is the quantity. Written
-- with group() it does not need editing if a CMBRADAR3 is ever added --
-- group("CMBRADAR") picks up every numbered slot that exists.
--
-- Verified against the VBScript's cases before writing:
--     neither -> 0 (does not fire)   radar1 only -> 1   radar2 only -> 1
--     both    -> 2                   short stalk -> 0 (does not fire)
--
-- Re-runnable. Run against the config database (RP_config).
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

-- ── RRD-27: IXIO Sensor, long stalk (RRD-IXIO-LONGASS) ───────────────────────
UPDATE dbo.uCfgRules
SET ConditionFormula = N'countEquals(group("CMBRADAR"), "IXIO Sensor - Long Stalk") > 0',
    QuantityFormula  = N'countEquals(group("CMBRADAR"), "IXIO Sensor - Long Stalk")',
    QuantityUnit     = N'Per Door',
    Notes            = N'Fires and counts across CMBRADAR1/2. Mirrors the M1 method for RRD-IXIO-LONGASS: one assembly per radar set to IXIO Sensor - Long Stalk.'
WHERE CfgID = @Cfg AND RuleCode = N'RRD-27';

-- ── RRD-28: IXIO Sensor, short stalk (RRD-IXIO-SHASS) ────────────────────────
UPDATE dbo.uCfgRules
SET ConditionFormula = N'countEquals(group("CMBRADAR"), "IXIO Sensor - Short Stalk") > 0',
    QuantityFormula  = N'countEquals(group("CMBRADAR"), "IXIO Sensor - Short Stalk")',
    QuantityUnit     = N'Per Door',
    Notes            = N'Fires and counts across CMBRADAR1/2. Mirrors the M1 method for RRD-IXIO-SHASS: one assembly per radar set to IXIO Sensor - Short Stalk.'
WHERE CfgID = @Cfg AND RuleCode = N'RRD-28';

-- ── RRD-29: IXIO Sensor, no stalk (SENS-IXIODT1) ─────────────────────────────
-- NOT from a method script you supplied -- you sent the long and short stalk
-- methods only. It is included because it has the identical defect and its own
-- Notes state the identical intent ("Qty = count of CMBRADAR1/2 = 'IXIO Sensor
-- - No Stalk'"), and leaving it as-is means it keeps firing on every quote.
-- If the M1 method for SENS-IXIODT1 differs, delete this one statement.
UPDATE dbo.uCfgRules
SET ConditionFormula = N'countEquals(group("CMBRADAR"), "IXIO Sensor - No Stalk") > 0',
    QuantityFormula  = N'countEquals(group("CMBRADAR"), "IXIO Sensor - No Stalk")',
    QuantityUnit     = N'Per Door',
    Notes            = N'Fires and counts across CMBRADAR1/2. Same shape as RRD-27/28; confirm against the M1 method for SENS-IXIODT1.'
WHERE CfgID = @Cfg AND RuleCode = N'RRD-29';

COMMIT TRANSACTION;

SELECT RuleCode, Name, ResultPartID, Quantity, QuantityFormula, ConditionFormula,
       (SELECT COUNT(*) FROM dbo.uCfgRuleConditions c WHERE c.RuleID = r.RuleID) AS ConditionRows
FROM dbo.uCfgRules r
WHERE CfgID = @Cfg AND RuleCode IN (N'RRD-27', N'RRD-28', N'RRD-29')
ORDER BY RuleCode;

PRINT '';
PRINT 'ConditionRows stays 0 on purpose: the whole test lives in';
PRINT 'ConditionFormula, which is ANDed on top of the (empty) condition groups.';
PRINT 'Quantity still reads 1 - QuantityFormula overrides it when set.';
