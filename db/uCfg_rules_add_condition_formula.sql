-- =============================================================================
-- Add ConditionFormula to uCfgRules.
--
-- The condition GROUPS (uCfgRuleConditions) cover "this control equals that
-- value" — AND inside a group, OR across groups. They cannot express a test
-- that spans a numbered set of controls, which is what the M1 configurator does
-- over and over with cmbAct1..cmbAct4:
--
--     '@@@@ if floor loops selected, keep. cmbAct1234.
--     For i = 1 to 4
--         If Left(Parameters("cmbAct" & i).Value, 17) = "Induction Loop - " Then
--             nLoopCount = nLoopCount + 1
--     Next
--     If nLoopCount = 0 Then formula = ""
--
-- becomes one line:
--
--     countStartsWith(group("CMBACT"), "Induction Loop - ") > 0
--
-- ConditionFormula is AND-ed with the condition groups: both must pass for the
-- rule to fire. NULL means "no extra test", so every existing rule is unchanged.
--
-- Run uCfg_pricing_rules_schema.sql first if uCfgRules doesn't exist yet.
-- Re-runnable.
-- =============================================================================

IF COL_LENGTH('dbo.uCfgRules', 'ConditionFormula') IS NULL
    ALTER TABLE dbo.uCfgRules ADD ConditionFormula NVARCHAR(500) NULL;
GO

PRINT 'uCfgRules.ConditionFormula ready.';
GO
