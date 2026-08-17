/* Movidor validation rules, translated from movidor_validation_rules.py.
   Data-expressible rules use uCfgValidationConditions (same GroupNo = AND,
   different GroupNo = OR). Computed rules (area, not-starts-with, multi-field
   scans) are flagged with CalculatorRef for the Python engine to handle.
   Re-runnable: clears this configurator's validations first. */
SET NOCOUNT ON;
DECLARE @Cfg INT = (SELECT TOP 1 CfgID FROM dbo.uCfgConfigurators WHERE PartID = N'RRD-MOVIDOR-TEMPLATE');
IF @Cfg IS NULL BEGIN RAISERROR('RRD-MOVIDOR-TEMPLATE not found. Run seed_movidor_generated.sql first.',16,1); RETURN; END;
DECLARE @V INT;

DELETE c FROM dbo.uCfgValidationConditions c
    JOIN dbo.uCfgValidationRules r ON c.ValidationID = r.ValidationID
    WHERE r.CfgID = @Cfg;
DELETE FROM dbo.uCfgValidationRules WHERE CfgID = @Cfg;

-- 1. HS35-Thermic max build height 4000mm
INSERT INTO dbo.uCfgValidationRules (CfgID, RuleCode, Severity, TargetField, Message) VALUES
 (@Cfg,'HS35T_MAXHEIGHT','error','NUMDOORHEIGHT','4000mm Build Height Max for HS35-Thermic. Delaminating / Scrubbing issue identified beyond this.');
SET @V = SCOPE_IDENTITY();
INSERT INTO dbo.uCfgValidationConditions (ValidationID,GroupNo,ControlName,Operator,CompareValue) VALUES
 (@V,1,'CMBDOORMODEL','equals','HS35-THERMIC'),
 (@V,1,'NUMDOORHEIGHT','greater_than','4000');

-- 2. Moisture requires weatherproof enclosure
INSERT INTO dbo.uCfgValidationRules (CfgID, RuleCode, Severity, TargetField, Message) VALUES
 (@Cfg,'MOISTURE_ENCLOSURE','error','CMBCONTROLLERENCLOSURE','Controller is exposed to moisture. Enclosure upgrade to weatherproof box is required.');
SET @V = SCOPE_IDENTITY();
INSERT INTO dbo.uCfgValidationConditions (ValidationID,GroupNo,ControlName,Operator,CompareValue) VALUES
 (@V,1,'CMBCONTROLMOIST','contains','Yes'),
 (@V,1,'CMBCONTROLLERENCLOSURE','contains','IP54');

-- 3. Traffic light + interlock needs weatherproof enclosure (unless Carona)
INSERT INTO dbo.uCfgValidationRules (CfgID, RuleCode, Severity, TargetField, Message) VALUES
 (@Cfg,'TRAFFIC_INTERLOCK_ENCLOSURE','error','CMBCONTROLLERENCLOSURE','Traffic lights and interlock are selected. Enclosure upgrade to weatherproof box is required.');
SET @V = SCOPE_IDENTITY();
INSERT INTO dbo.uCfgValidationConditions (ValidationID,GroupNo,ControlName,Operator,CompareValue) VALUES
 (@V,1,'CMBTRAFFICLIGHT','contains','Yes'),
 (@V,1,'CHKINTERLOCK','is_checked',NULL),
 (@V,1,'CMBCONTROLLERENCLOSURE','contains','IP54'),
 (@V,1,'CMBCARONAOPTION','not_equals','SEW Motor - Carona Supply');

-- 4. Heat trace (hood OR leg) needs weatherproof enclosure  (OR = two groups)
INSERT INTO dbo.uCfgValidationRules (CfgID, RuleCode, Severity, TargetField, Message) VALUES
 (@Cfg,'HEATTRACE_ENCLOSURE','error','CMBCONTROLLERENCLOSURE','Door model has heat trace selected. Enclosure upgrade to weatherproof box is required.');
SET @V = SCOPE_IDENTITY();
INSERT INTO dbo.uCfgValidationConditions (ValidationID,GroupNo,ControlName,Operator,CompareValue) VALUES
 (@V,1,'CMBHEATTRACEHOOD','equals','Yes'),
 (@V,1,'CMBCONTROLLERENCLOSURE','contains','IP54'),
 (@V,2,'CMBHEATTRACELEG','equals','Yes'),
 (@V,2,'CMBCONTROLLERENCLOSURE','contains','IP54');

-- 5. Hyperlift requires Carwash electrical spec
INSERT INTO dbo.uCfgValidationRules (CfgID, RuleCode, Severity, TargetField, Message) VALUES
 (@Cfg,'HYPERLIFT_CARWASH','error','CMBELECSPEC','Hyperlift doors must use ''Carwash'' electrical spec.');
SET @V = SCOPE_IDENTITY();
INSERT INTO dbo.uCfgValidationConditions (ValidationID,GroupNo,ControlName,Operator,CompareValue) VALUES
 (@V,1,'CHKHYPERLIFT','is_checked',NULL),
 (@V,1,'CMBELECSPEC','not_equals','Carwash');

-- 6. EX35 too short for light curtains
INSERT INTO dbo.uCfgValidationRules (CfgID, RuleCode, Severity, TargetField, Message) VALUES
 (@Cfg,'EX35_SHORT_CURTAIN','error','CMBPEBEAMS','Door is too short to have light curtains. Please select PE Slimline Beams.');
SET @V = SCOPE_IDENTITY();
INSERT INTO dbo.uCfgValidationConditions (ValidationID,GroupNo,ControlName,Operator,CompareValue) VALUES
 (@V,1,'NUMDOORHEIGHT','less_than','2000'),
 (@V,1,'CMBPEBEAMS','contains','Curtain'),
 (@V,1,'CMBDOORMODEL','equals','EX35');

-- 7. Hyperlift cannot use gearbox heater
INSERT INTO dbo.uCfgValidationRules (CfgID, RuleCode, Severity, TargetField, Message) VALUES
 (@Cfg,'HYPERLIFT_GEARBOXHEATER','error','CMBGEARBOXHEATER','Unable to put gearbox heater on Hyperlift. GFA motor required.');
SET @V = SCOPE_IDENTITY();
INSERT INTO dbo.uCfgValidationConditions (ValidationID,GroupNo,ControlName,Operator,CompareValue) VALUES
 (@V,1,'CHKHYPERLIFT','is_checked',NULL),
 (@V,1,'CMBGEARBOXHEATER','equals','Yes');

-- 8. Hyperlift cannot use motor clear coat
INSERT INTO dbo.uCfgValidationRules (CfgID, RuleCode, Severity, TargetField, Message) VALUES
 (@Cfg,'HYPERLIFT_CLEARCOAT','error','CHKMOTORCLEARCOAT','Unable to put Clear Coat upgrade on Hyperlift. GFA motor required.');
SET @V = SCOPE_IDENTITY();
INSERT INTO dbo.uCfgValidationConditions (ValidationID,GroupNo,ControlName,Operator,CompareValue) VALUES
 (@V,1,'CHKHYPERLIFT','is_checked',NULL),
 (@V,1,'CHKMOTORCLEARCOAT','is_checked',NULL);

-- 9. Push button in column not allowed for EX / Movifold / Concertina
INSERT INTO dbo.uCfgValidationRules (CfgID, RuleCode, Severity, TargetField, Message) VALUES
 (@Cfg,'PED_COLUMN','error','CMBPED1','Unable to put Push Button in Door Column. Change to J-Box.');
SET @V = SCOPE_IDENTITY();
INSERT INTO dbo.uCfgValidationConditions (ValidationID,GroupNo,ControlName,Operator,CompareValue) VALUES
 (@V,1,'CMBDOORMODEL','in','EX35,EX45,MOVIFOLD,CONCERTINA'),
 (@V,1,'CMBPED1','contains','Column');

-- 10. Floor slope amount needs a direction  (COMPUTED)
INSERT INTO dbo.uCfgValidationRules (CfgID, RuleCode, Severity, TargetField, Message, CalculatorRef) VALUES
 (@Cfg,'FLOOR_SLOPE','error','CMBFLOORSLOPE','Slope detail missing. Choose slope direction or set slope to 0mm.','floor_slope_check');

-- 11. EX35/EX45 on insulated panel needs Ramset fixing  (COMPUTED)
INSERT INTO dbo.uCfgValidationRules (CfgID, RuleCode, Severity, TargetField, Message, CalculatorRef) VALUES
 (@Cfg,'EX_RAMSET','error','CMBLEGFIXING','EX35 mounted to ICP Panel needs Ramset in leg fixings. Please change leg to wall fixings.','ex_ramset_fixing_check');

-- 12. UPS requires single-phase power  (COMPUTED: not-starts-with)
INSERT INTO dbo.uCfgValidationRules (CfgID, RuleCode, Severity, TargetField, Message, CalculatorRef) VALUES
 (@Cfg,'UPS_SINGLE_PHASE','error','CMBPOWERSUPPLY','UPS is selected. Power Supply must be Single Phase.','ups_single_phase_check');

-- 13. 1kVA UPS only for EX35/EX45/ES40
INSERT INTO dbo.uCfgValidationRules (CfgID, RuleCode, Severity, TargetField, Message) VALUES
 (@Cfg,'UPS_1KVA_MODEL','error','CMBUPS','1kVA UPS can only be used on ES40/EX35/EX45. Upgrade to larger UPS.');
SET @V = SCOPE_IDENTITY();
INSERT INTO dbo.uCfgValidationConditions (ValidationID,GroupNo,ControlName,Operator,CompareValue) VALUES
 (@V,1,'CMBUPS','equals','1kVA UPS - 10A'),
 (@V,1,'CMBDOORMODEL','not_in','EX35,EX45,ES40');

-- 14. 1kVA UPS does not suit 5.250 motor
INSERT INTO dbo.uCfgValidationRules (CfgID, RuleCode, Severity, TargetField, Message) VALUES
 (@Cfg,'UPS_1KVA_MOTOR','error','CMBUPS','UPS does not suit. 1kVA is for 3.350 only. Change to 2kVA.');
SET @V = SCOPE_IDENTITY();
INSERT INTO dbo.uCfgValidationConditions (ValidationID,GroupNo,ControlName,Operator,CompareValue) VALUES
 (@V,1,'CMBDOORMODEL','in','EX35,EX45,ES40'),
 (@V,1,'CMBUPS','equals','1kVA UPS - 10A'),
 (@V,1,'CMBMOTORFILTER','equals','5.250');

-- 15. Induction loop enclosure warning  (COMPUTED: scans CMBACT1..4)
INSERT INTO dbo.uCfgValidationRules (CfgID, RuleCode, Severity, TargetField, Message, CalculatorRef) VALUES
 (@Cfg,'INDUCTION_LOOP','warning','CMBCONTROLLERENCLOSURE','Floor Loop has been selected. Enclosure upgrade to ABS Hi-Box or Stainless Steel is recommended.','induction_loop_check');

-- 16. Concertina area > 80 m2  (COMPUTED: area = h*w)
INSERT INTO dbo.uCfgValidationRules (CfgID, RuleCode, Severity, TargetField, Message, CalculatorRef) VALUES
 (@Cfg,'CONCERTINA_AREA80','warning','NUMDOORHEIGHT','Max size for Concertina is 80m2. Seek technical advice before quoting.','concertina_area80_check');

-- 16b. Concertina area > 60 m2  (COMPUTED)
INSERT INTO dbo.uCfgValidationRules (CfgID, RuleCode, Severity, TargetField, Message, CalculatorRef) VALUES
 (@Cfg,'CONCERTINA_AREA60','warning','NUMDOORHEIGHT','Concertina speeds and wind loads are restricted for sizes over 60m2.','concertina_area60_check');

-- 17. Hyperlift must be single phase
INSERT INTO dbo.uCfgValidationRules (CfgID, RuleCode, Severity, TargetField, Message) VALUES
 (@Cfg,'HYPERLIFT_3PHASE','error','CMBPOWERSUPPLY','Hyperlift must be single phase supply.');
SET @V = SCOPE_IDENTITY();
INSERT INTO dbo.uCfgValidationConditions (ValidationID,GroupNo,ControlName,Operator,CompareValue) VALUES
 (@V,1,'CHKHYPERLIFT','is_checked',NULL),
 (@V,1,'CMBPOWERSUPPLY','contains','3P');

-- 18. Thermic curtain cannot be used in freezer  (OR on two temp sides)
INSERT INTO dbo.uCfgValidationRules (CfgID, RuleCode, Severity, TargetField, Message) VALUES
 (@Cfg,'THERMIC_FREEZER','error','CMBDOORMODEL','THERMIC Curtains should not be installed on freezers. Fabric goes brittle.');
SET @V = SCOPE_IDENTITY();
INSERT INTO dbo.uCfgValidationConditions (ValidationID,GroupNo,ControlName,Operator,CompareValue) VALUES
 (@V,1,'CMBDOORMODEL','contains','THERMIC'),
 (@V,1,'CMBTEMPDSIDE','contains','Freezer'),
 (@V,2,'CMBDOORMODEL','contains','THERMIC'),
 (@V,2,'CMBTEMPNONDSIDE','contains','Freezer');

PRINT 'Movidor validations complete.';
