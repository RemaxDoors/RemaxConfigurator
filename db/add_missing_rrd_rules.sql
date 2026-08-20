-- =============================================================================
-- Two rules from the M1 method workbooks that have no equivalent in uCfgRules.
--
-- Found by comparing every Part ID in
--   Method Assemblies.xlsx  (20 assemblies)
--   Method Materials.xlsx   (12 materials)
-- against the 62 rules loaded for RRD-MOVIDOR-TEMPLATE. Thirty of the thirty-two
-- matched. The two below are each the missing half of a pair whose other half
-- is already configured, which is why the gap is easy to miss: the narrow-door
-- fascia and the left-hand motor cover simply never get added to a quote.
--
-- Both parts exist in M1, so they price correctly once the rule fires.
--
-- Re-runnable: each rule is inserted only if its RuleCode is absent, and the
-- conditions are rebuilt from scratch so a partial earlier run self-corrects.
-- Run against the config database (RP_config). Take a backup first.
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

-- ── RRD-63: ES40 fascia, narrow ──────────────────────────────────────────────
-- Workbook (RRD-FASASS-ES40-3, imaPartID):
--   cmbDoorModel = "ES40" AND NumDoorWidth <= 3000 AND cmbES40Fascia = "Yes"
--
-- The width test goes in ConditionFormula rather than a condition row: the
-- operator list has greater_than and less_than but no "<=", and writing
-- less_than 3001 would quietly disagree with the workbook for a door measured
-- in fractions of a millimetre. The formula engine supports <= directly.
--
-- Its pair, RRD-12, already covers NumDoorWidth > 3000.
IF NOT EXISTS (SELECT 1 FROM dbo.uCfgRules WHERE CfgID = @Cfg AND RuleCode = N'RRD-63')
    INSERT INTO dbo.uCfgRules
        (CfgID, RuleCode, Name, Category, ResultPartID, Quantity, QuantityUnit,
         ConditionFormula, Notes, IsActive)
    VALUES
        (@Cfg, N'RRD-63', N'ES40 Narrow Fascia', N'ASSEMBLY_UPGRADE',
         N'RRD-FASASS-ES40-3', N'1', N'Per Door',
         N'NUMDOORWIDTH <= 3000',
         N'Pairs with RRD-12 (> 3000). Width test is in the formula because the operator list has no <=.',
         1);

-- ── RRD-64: Concertina/Movifold motor cover, left hand ───────────────────────
-- Workbook (RRD-MOTCOV-CONC-LH, immPartID):
--   (cmbDoorModel = "MOVIFOLD" OR "CONCERTINA")
--   AND (CmbMotorHand = "Left" OR CmbMotorHand = "")
--   AND CmbMotorShroud = "Yes - Stainless Steel Upgrade"
--
-- Note the blank: an unset motor hand counts as LEFT, so the left cover is the
-- default and the right one is the deliberate choice. CMBMOTORHAND offers only
-- '', 'Left' and 'Right', which makes "Left or blank" exactly "not Right" —
-- one condition row instead of two OR-ed groups, and it stays correct if a
-- quote is saved before the hand is chosen.
--
-- Its pair, RRD-25, already covers the right hand.
IF NOT EXISTS (SELECT 1 FROM dbo.uCfgRules WHERE CfgID = @Cfg AND RuleCode = N'RRD-64')
    INSERT INTO dbo.uCfgRules
        (CfgID, RuleCode, Name, Category, ResultPartID, ResultRevision,
         Quantity, QuantityUnit, Notes, IsActive)
    VALUES
        (@Cfg, N'RRD-64', N'Left-Hand Stainless-Steel Motor Cover',
         N'ASSEMBLY_UPGRADE', N'RRD-MOTCOV-CONC-LH', N'E', N'1', N'Per Door',
         N'Pairs with RRD-25 (right hand). A blank motor hand counts as Left, so this is the default cover.',
         0);   -- inserted INACTIVE on purpose; see the note at the end

-- ── Conditions ───────────────────────────────────────────────────────────────
DECLARE @R63 INT = (SELECT RuleID FROM dbo.uCfgRules WHERE CfgID = @Cfg AND RuleCode = N'RRD-63');
DECLARE @R64 INT = (SELECT RuleID FROM dbo.uCfgRules WHERE CfgID = @Cfg AND RuleCode = N'RRD-64');

DELETE FROM dbo.uCfgRuleConditions WHERE RuleID IN (@R63, @R64);

INSERT INTO dbo.uCfgRuleConditions (RuleID, GroupNo, ControlName, Operator, CompareValue)
VALUES
    -- RRD-63: width handled by ConditionFormula above
    (@R63, 1, N'CMBDOORMODEL',   N'equals', N'ES40'),
    (@R63, 1, N'CMBES40FASCIA',  N'equals', N'Yes'),
    -- RRD-64
    (@R64, 1, N'CMBDOORMODEL',   N'in',         N'MOVIFOLD, CONCERTINA'),
    (@R64, 1, N'CMBMOTORHAND',   N'not_equals', N'Right'),
    (@R64, 1, N'CMBMOTORSHROUD', N'equals',     N'Yes - Stainless Steel Upgrade');

COMMIT TRANSACTION;

SELECT r.RuleCode, r.Name, r.ResultPartID, r.ResultRevision, r.IsActive,
       r.ConditionFormula,
       (SELECT COUNT(*) FROM dbo.uCfgRuleConditions c WHERE c.RuleID = r.RuleID) AS Conditions
FROM dbo.uCfgRules r
WHERE r.CfgID = @Cfg AND r.RuleCode IN (N'RRD-63', N'RRD-64');

PRINT '';
PRINT 'RRD-63 is active. RRD-64 is inserted INACTIVE deliberately: it fires';
PRINT 'whenever the motor hand is blank, so switching it on will start adding a';
PRINT 'left-hand cover to Concertina/Movifold quotes that specify the stainless';
PRINT 'shroud but no hand. That matches M1, but it changes existing prices -';
PRINT 'check one such quote, then:';
PRINT '  UPDATE dbo.uCfgRules SET IsActive = 1 WHERE RuleCode = ''RRD-64'';';
