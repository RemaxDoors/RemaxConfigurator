-- =============================================================================
-- Condition and quantity formulas for every activation-driven rule.
--
-- Twenty-one of the twenty-six activation rules had no conditions, no condition
-- formula and no quantity formula -- a fixed quantity of 1 and nothing to say
-- when they applied. Their intent survived only as prose in Notes, e.g.
--     "Qty from NUMREMOTEQTY, activation starts 'Pentacode - 4'"
--
-- This writes that intent as formulas the engine can evaluate.
--
-- NOTE ON SCOPE: uCfgRules does not price quotes yet. Quoting still runs
-- through app/pricing_rules/movidor_upgrade_rules.py, which already implements
-- all of this correctly. Nothing here changes a live price. It makes the
-- database definition match the code, which is the precondition for retiring
-- that package -- see the parity harness in backend/tests.
--
-- Every formula below was checked against that package's own helper functions
-- over 400 randomised configurations (and 500 for the two compound conditions),
-- with zero mismatches, before this file was written.
--
-- THREE SHAPES ARE USED
--
--   1. Count matching slots, one part per slot
--        countEquals(group("CMBRADAR"), "IXIO Sensor - Long Stalk")
--      Two radars set to the same sensor bill as two.
--
--   2. Count matching slots, ignoring quantity boxes
--        countStartsWith(group("CMBACT"), "Pull Cord")
--      Pull cords have no NUMREMOTEQTY; the slot itself is the unit.
--
--   3. Sum the quantity box beside each matching slot  <- the remote count
--        sumWhere(group("CMBACT"), "Elsema Remote - 2", group("NUMREMOTEQTY"))
--      Pairs CMBACT1..4 with NUMREMOTEQTY1..4 by slot number, so "Elsema
--      Remote - 2 Button" in slot 1 with qty 3 and in slot 3 with qty 2 gives 5.
--      The fourth argument is the match mode and defaults to "starts";
--      "equals" is used where M1 tests the whole string.
--
-- group("CMBACT") picks up every numbered slot that exists, so adding a
-- CMBACT6 needs no edit here -- unlike the VBScript, which loops 1 to 4.
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

-- One row per rule: the test, and the quantity when it is not a flat 1.
DECLARE @F TABLE (
    RuleCode    NVARCHAR(30) PRIMARY KEY,
    CondFormula NVARCHAR(500),
    QtyFormula  NVARCHAR(500) NULL,
    QtyUnit     NVARCHAR(30),
    Note        NVARCHAR(400)
);

INSERT INTO @F (RuleCode, CondFormula, QtyFormula, QtyUnit, Note) VALUES
-- ── Radars: one assembly per radar set to that sensor ────────────────────────
 (N'RRD-27', N'countEquals(group("CMBRADAR"), "IXIO Sensor - Long Stalk") > 0',    N'countEquals(group("CMBRADAR"), "IXIO Sensor - Long Stalk")',    N'Per Radar', N'One per radar set to IXIO Sensor - Long Stalk.')
,(N'RRD-28', N'countEquals(group("CMBRADAR"), "IXIO Sensor - Short Stalk") > 0',   N'countEquals(group("CMBRADAR"), "IXIO Sensor - Short Stalk")',   N'Per Radar', N'One per radar set to IXIO Sensor - Short Stalk.')
,(N'RRD-29', N'countEquals(group("CMBRADAR"), "IXIO Sensor - No Stalk") > 0',      N'countEquals(group("CMBRADAR"), "IXIO Sensor - No Stalk")',      N'Per Radar', N'One per radar set to IXIO Sensor - No Stalk.')
,(N'RRD-30', N'countEquals(group("CMBRADAR"), "Condor Radar - Long Stalk") > 0',   N'countEquals(group("CMBRADAR"), "Condor Radar - Long Stalk")',   N'Per Radar', N'One per radar set to Condor Radar - Long Stalk.')
,(N'RRD-31', N'countEquals(group("CMBRADAR"), "Condor Radar - Short Stalk") > 0',  N'countEquals(group("CMBRADAR"), "Condor Radar - Short Stalk")',  N'Per Radar', N'One per radar set to Condor Radar - Short Stalk.')
,(N'RRD-32', N'countEquals(group("CMBRADAR"), "Condor Radar - No Stalk") > 0',     N'countEquals(group("CMBRADAR"), "Condor Radar - No Stalk")',     N'Per Radar', N'One per radar set to Condor Radar - No Stalk.')
,(N'RRD-33', N'countEquals(group("CMBRADAR"), "Falcon Radar - Long Stalk") > 0',   N'countEquals(group("CMBRADAR"), "Falcon Radar - Long Stalk")',   N'Per Radar', N'One per radar set to Falcon Radar - Long Stalk.')
,(N'RRD-34', N'countEquals(group("CMBRADAR"), "Falcon Radar - Short Stalk") > 0',  N'countEquals(group("CMBRADAR"), "Falcon Radar - Short Stalk")',  N'Per Radar', N'One per radar set to Falcon Radar - Short Stalk.')
,(N'RRD-35', N'countEquals(group("CMBRADAR"), "Falcon Radar - No Stalk") > 0',     N'countEquals(group("CMBRADAR"), "Falcon Radar - No Stalk")',     N'Per Radar', N'One per radar set to Falcon Radar - No Stalk.')

-- ── Activation slots counted directly (no quantity box) ──────────────────────
,(N'RRD-37', N'countStartsWith(group("CMBACT"), "Pull Cord") > 0',                 N'countStartsWith(group("CMBACT"), "Pull Cord")',                 N'Per Slot',  N'One switch per activation slot starting "Pull Cord". Pull cords have no NUMREMOTEQTY.')

-- ── Activation slots x their quantity box (the remote count) ─────────────────
,(N'RRD-38', N'sumWhere(group("CMBACT"), "Magic Switch - In Wall", group("NUMREMOTEQTY"), "equals") > 0',      N'sumWhere(group("CMBACT"), "Magic Switch - In Wall", group("NUMREMOTEQTY"), "equals")',      N'Per Remote', N'Sums NUMREMOTEQTY beside each slot exactly equal to "Magic Switch - In Wall".')
,(N'RRD-40', N'sumWhere(group("CMBACT"), "Magic Switch - IP65 Housing", group("NUMREMOTEQTY"), "equals") > 0', N'sumWhere(group("CMBACT"), "Magic Switch - IP65 Housing", group("NUMREMOTEQTY"), "equals")', N'Per Remote', N'Sums NUMREMOTEQTY beside each slot exactly equal to "Magic Switch - IP65 Housing".')
,(N'RRD-43', N'sumWhere(group("CMBACT"), "Pentacode - 2", group("NUMREMOTEQTY")) > 0',      N'sumWhere(group("CMBACT"), "Pentacode - 2", group("NUMREMOTEQTY"))',      N'Per Remote', N'Sums NUMREMOTEQTY across slots starting "Pentacode - 2".')
,(N'RRD-44', N'sumWhere(group("CMBACT"), "Pentacode - 4", group("NUMREMOTEQTY")) > 0',      N'sumWhere(group("CMBACT"), "Pentacode - 4", group("NUMREMOTEQTY"))',      N'Per Remote', N'Sums NUMREMOTEQTY across slots starting "Pentacode - 4". NOTE: part is RRD-ELREM1C-PC but the driver is the 4-button count - copied from the live engine, worth confirming against M1.')
,(N'RRD-45', N'sumWhere(group("CMBACT"), "Elsema Remote - 1", group("NUMREMOTEQTY")) > 0',  N'sumWhere(group("CMBACT"), "Elsema Remote - 1", group("NUMREMOTEQTY"))',  N'Per Remote', N'Sums NUMREMOTEQTY across slots starting "Elsema Remote - 1".')
,(N'RRD-46', N'sumWhere(group("CMBACT"), "Elsema Remote - 2", group("NUMREMOTEQTY")) > 0',  N'sumWhere(group("CMBACT"), "Elsema Remote - 2", group("NUMREMOTEQTY"))',  N'Per Remote', N'Sums NUMREMOTEQTY across slots starting "Elsema Remote - 2".')
,(N'RRD-47', N'sumWhere(group("CMBACT"), "Elsema Remote - 4", group("NUMREMOTEQTY")) > 0',  N'sumWhere(group("CMBACT"), "Elsema Remote - 4", group("NUMREMOTEQTY"))',  N'Per Remote', N'Sums NUMREMOTEQTY across slots starting "Elsema Remote - 4".')
,(N'RRD-48', N'sumWhere(group("CMBACT"), "Elsema Remote - 8", group("NUMREMOTEQTY")) > 0',  N'sumWhere(group("CMBACT"), "Elsema Remote - 8", group("NUMREMOTEQTY"))',  N'Per Remote', N'Sums NUMREMOTEQTY across slots starting "Elsema Remote - 8".')

-- ── Fires once regardless of how many slots match ────────────────────────────
,(N'RRD-39', N'sumWhere(group("CMBACT"), "Magic Switch - In Wall", group("NUMREMOTEQTY"), "equals") > 0', NULL, N'Per Door', N'One cable whenever RRD-38 applies, regardless of quantity.')
,(N'RRD-41', N'countStartsWith(group("CMBACT"), "Elsema Remote") > 0 or countStartsWith(group("CMBACT"), "Elsema Receiver") > 0', NULL, N'Per Door', N'One receiver if any slot starts "Elsema Remote" or "Elsema Receiver".')
,(N'RRD-42', N'countStartsWith(group("CMBACT"), "Pentacode - 2") > 0 or countStartsWith(group("CMBACT"), "Pentacode - 4") > 0', NULL, N'Per Door', N'One receiver if any slot starts "Pentacode - 2" or "Pentacode - 4".')
;

UPDATE r
SET r.ConditionFormula = f.CondFormula,
    r.QuantityFormula  = f.QtyFormula,
    r.QuantityUnit     = f.QtyUnit,
    r.Notes            = f.Note
FROM dbo.uCfgRules r
JOIN @F f ON f.RuleCode = r.RuleCode
WHERE r.CfgID = @Cfg;

-- Refuse to half-apply: every rule code above must exist in this database.
DECLARE @Missing NVARCHAR(1000) = (
    SELECT STRING_AGG(f.RuleCode, ', ')
    FROM @F f
    WHERE NOT EXISTS (SELECT 1 FROM dbo.uCfgRules r
                      WHERE r.CfgID = @Cfg AND r.RuleCode = f.RuleCode)
);
IF @Missing IS NOT NULL
BEGIN
    RAISERROR('These rule codes are not in this database: %s. Rolling back - the two databases have diverged, reconcile them first.', 16, 1, @Missing);
    ROLLBACK TRANSACTION;
    RETURN;
END;

COMMIT TRANSACTION;

SELECT r.RuleCode, r.ResultPartID, r.QuantityUnit,
       r.ConditionFormula, r.QuantityFormula
FROM dbo.uCfgRules r
JOIN @F f ON f.RuleCode = r.RuleCode
WHERE r.CfgID = @Cfg
ORDER BY r.RuleCode;

PRINT '';
PRINT 'Left untouched: RRD-06, RRD-13, RRD-16, RRD-61, RRD-62 already carry a';
PRINT 'condition formula and are a flat quantity of 1 in the live engine.';
PRINT '';
PRINT 'Quantity still reads 1 on these rows - QuantityFormula overrides it.';
