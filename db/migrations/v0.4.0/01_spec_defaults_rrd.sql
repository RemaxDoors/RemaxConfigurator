-- =============================================================================
-- Specification defaults for RRD-MOVIDOR-TEMPLATE.
--
-- M1's Select Case cmbSpecification pre-fills a whole configuration when a
-- customer specification is chosen. This reproduces that.
--
-- A specification default is an ordinary uCfgDefaults row with DoorModel NULL,
-- gated by a uCfgDefaultConditions row testing CMBSPECIFICATION, at a Priority
-- above the model-scoped defaults. resolve_defaults() already ranks on
-- (Priority, model-specific), so the spec wins and the engine needs no change.
--
-- It does need one schema change, which an earlier version of this script got
-- wrong. UQ_uCfgDefaults is (CfgID, ParentPartID, DoorModel, ControlName), so
-- ten specifications that each set CMBDOORMODEL all collide on
-- (1, NULL, NULL, CMBDOORMODEL). 00_add_default_spec_name.sql adds SpecName and
-- puts it in that key. SpecName is a discriminator so the rows can coexist and
-- so the Defaults tab can say which specification a row belongs to; the
-- CONDITION is still what makes a default apply.
--
-- Priority 50: existing defaults run 0-30.
--
-- WHAT IS NOT HERE
--   * Blank assignments. M1 clears a field by assigning ""; our form only
--     seeds a field that is already empty, so a blank default is a no-op.
--     66 of them were dropped rather than inserted as dead rows.
--   * Controls with no RRD parameter -- door name, side names, wind pot,
--     temperatures, PE levels, emergency counterweight, e-stop, crate,
--     cleanroom seal and the customer notes. They are listed in the script
--     output; add the parameters first if you want them covered.
--   * "Arden Cleanroom - EX35" is an option with no defaults, because M1 only
--     shows "Spec not written yet".
--
-- Re-runnable: the spec defaults are rebuilt from scratch each time.
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

IF COL_LENGTH('dbo.uCfgDefaults', 'SpecName') IS NULL
BEGIN
    RAISERROR('uCfgDefaults.SpecName is missing. Run 00_add_default_spec_name.sql first - without it UQ_uCfgDefaults rejects the second specification that sets any given control.', 16, 1);
    ROLLBACK TRANSACTION;
    RETURN;
END;

-- -- 1. The parameter itself -------------------------------------------------
-- RRD has no CMBSPECIFICATION today, so there is nothing for the conditions
-- below to test until this exists.
IF NOT EXISTS (SELECT 1 FROM dbo.uCfgParameters
               WHERE CfgID = @Cfg AND ControlName = N'CMBSPECIFICATION')
BEGIN
    INSERT INTO dbo.uCfgParameters
        (CfgID, ControlName, Label, Kind, IsRequired, IsVisible, SortOrder)
    VALUES (@Cfg, N'CMBSPECIFICATION', N'Customer Specification', N'dropdown', 0, 1,
            (SELECT ISNULL(MAX(SortOrder), 0) + 1 FROM dbo.uCfgParameters WHERE CfgID = @Cfg));
END;

DECLARE @ParamID INT = (
    SELECT ParamID FROM dbo.uCfgParameters
    WHERE CfgID = @Cfg AND ControlName = N'CMBSPECIFICATION'
);

-- Option list, rebuilt so a re-run cannot leave a retired spec behind.
DELETE FROM dbo.uCfgParameterOptions WHERE ParamID = @ParamID;
INSERT INTO dbo.uCfgParameterOptions (ParamID, OptionValue, OptionLabel, SortOrder, IsActive)
VALUES (@ParamID, N'', N'', 1, 1),
       (@ParamID, N'ALDI Emerg Counterweight - EX35', N'ALDI Emerg Counterweight - EX35', 2, 1),
       (@ParamID, N'ALDI Emerg Zip - EX35', N'ALDI Emerg Zip - EX35', 3, 1),
       (@ParamID, N'Cleanroom - EX35', N'Cleanroom - EX35', 4, 1),
       (@ParamID, N'Coles - EX35', N'Coles - EX35', 5, 1),
       (@ParamID, N'Carwash - ES40', N'Carwash - ES40', 6, 1),
       (@ParamID, N'Woolworths - EX35', N'Woolworths - EX35', 7, 1),
       (@ParamID, N'Woolworths - HS25', N'Woolworths - HS25', 8, 1),
       (@ParamID, N'Dan Murphys - EX35', N'Dan Murphys - EX35', 9, 1),
       (@ParamID, N'Arden Cleanroom - EX35', N'Arden Cleanroom - EX35', 10, 1),
       (@ParamID, N'Como Glass House - HS35', N'Como Glass House - HS35', 11, 1);

-- -- 2. The defaults ---------------------------------------------------------
DECLARE @D TABLE (Spec NVARCHAR(100), ControlName NVARCHAR(50), Val NVARCHAR(255));
INSERT INTO @D (Spec, ControlName, Val) VALUES
    (N'ALDI Emerg Counterweight - EX35', N'CMBDOORMODEL', N'EX35'),
    (N'ALDI Emerg Counterweight - EX35', N'NUMDOORHEIGHT', N'2500'),
    (N'ALDI Emerg Counterweight - EX35', N'NUMDOORWIDTH', N'2200'),
    (N'ALDI Emerg Counterweight - EX35', N'CMBCURTAINCOLOUR', N'Grey 705'),
    (N'ALDI Emerg Counterweight - EX35', N'CMBPOWERSUPPLY', N'1P10A'),
    (N'ALDI Emerg Counterweight - EX35', N'CMBTRACKCONFIG', N'Concealed'),
    (N'ALDI Emerg Counterweight - EX35', N'CMBWINDTRACK', N'No'),
    (N'ALDI Emerg Counterweight - EX35', N'CMBCONTROLLERENCLOSURE', N'Std ABS IP54'),
    (N'ALDI Emerg Counterweight - EX35', N'CMBMOTORSHROUD', N'No'),
    (N'ALDI Emerg Counterweight - EX35', N'CMBBRAKEIPBASIC', N'IP65 Std'),
    (N'ALDI Emerg Counterweight - EX35', N'CMBBRUSHSEAL', N'None (Std)'),
    (N'ALDI Emerg Counterweight - EX35', N'CMBTRAFFICLIGHT', N'No'),
    (N'ALDI Emerg Counterweight - EX35', N'CMBPEBEAMS', N'Light Curtain - 1830mm'),
    (N'ALDI Emerg Counterweight - EX35', N'CHKHYPERLIFT', N'0'),
    (N'ALDI Emerg Counterweight - EX35', N'CHKSTAINLESS', N'0'),
    (N'ALDI Emerg Counterweight - EX35', N'CHKHOLDOPEN', N'0'),
    (N'ALDI Emerg Counterweight - EX35', N'CHKINTERLOCK', N'0'),
    (N'ALDI Emerg Counterweight - EX35', N'CMBUPS', N'2kVA UPS - 10A'),
    (N'ALDI Emerg Counterweight - EX35', N'CMBSPECIALCONDUIT', N'Standard'),
    (N'ALDI Emerg Counterweight - EX35', N'CMBPED1', N'In Jbox - Door Side Left'),
    (N'ALDI Emerg Counterweight - EX35', N'CMBPED2', N'In Jbox - Non Door Side Left'),
    (N'ALDI Emerg Counterweight - EX35', N'CMBRADAR1', N'IXIO Sensor - Short Stalk'),
    (N'ALDI Emerg Counterweight - EX35', N'CMBACT1', N'Magic Switch - IP65 Housing'),
    (N'ALDI Emerg Counterweight - EX35', N'NUMREMOTEQTY1', N'1'),
    (N'ALDI Emerg Zip - EX35', N'CMBDOORMODEL', N'EX35'),
    (N'ALDI Emerg Zip - EX35', N'NUMDOORHEIGHT', N'2500'),
    (N'ALDI Emerg Zip - EX35', N'NUMDOORWIDTH', N'2200'),
    (N'ALDI Emerg Zip - EX35', N'CMBCURTAINCOLOUR', N'Grey 705'),
    (N'ALDI Emerg Zip - EX35', N'CMBPOWERSUPPLY', N'1P10A'),
    (N'ALDI Emerg Zip - EX35', N'CMBTRACKCONFIG', N'Concealed'),
    (N'ALDI Emerg Zip - EX35', N'CMBWINDTRACK', N'No'),
    (N'ALDI Emerg Zip - EX35', N'CMBCONTROLLERENCLOSURE', N'Std ABS IP54'),
    (N'ALDI Emerg Zip - EX35', N'CMBMOTORSHROUD', N'No'),
    (N'ALDI Emerg Zip - EX35', N'CMBBRAKEIPBASIC', N'IP65 Std'),
    (N'ALDI Emerg Zip - EX35', N'CMBBRUSHSEAL', N'None (Std)'),
    (N'ALDI Emerg Zip - EX35', N'CMBTRAFFICLIGHT', N'No'),
    (N'ALDI Emerg Zip - EX35', N'CMBPEBEAMS', N'Light Curtain - 1830mm'),
    (N'ALDI Emerg Zip - EX35', N'CHKHYPERLIFT', N'0'),
    (N'ALDI Emerg Zip - EX35', N'CHKSTAINLESS', N'0'),
    (N'ALDI Emerg Zip - EX35', N'CHKHOLDOPEN', N'0'),
    (N'ALDI Emerg Zip - EX35', N'CHKINTERLOCK', N'0'),
    (N'ALDI Emerg Zip - EX35', N'CMBUPS', N'2kVA UPS - 10A'),
    (N'ALDI Emerg Zip - EX35', N'CMBSPECIALCONDUIT', N'Standard'),
    (N'ALDI Emerg Zip - EX35', N'CMBPED1', N'In Jbox - Door Side Left'),
    (N'ALDI Emerg Zip - EX35', N'CMBPED2', N'In Jbox - Non Door Side Left'),
    (N'ALDI Emerg Zip - EX35', N'CMBRADAR1', N'IXIO Sensor - Short Stalk'),
    (N'ALDI Emerg Zip - EX35', N'CMBACT1', N'Magic Switch - IP65 Housing'),
    (N'ALDI Emerg Zip - EX35', N'NUMREMOTEQTY1', N'1'),
    (N'Cleanroom - EX35', N'CMBDOORMODEL', N'EX35'),
    (N'Cleanroom - EX35', N'CMBPOWERSUPPLY', N'1P10A'),
    (N'Cleanroom - EX35', N'CMBWINDTRACK', N'No'),
    (N'Cleanroom - EX35', N'CMBCONTROLLERENCLOSURE', N'Std ABS IP54'),
    (N'Cleanroom - EX35', N'CMBMOTORSHROUD', N'No'),
    (N'Cleanroom - EX35', N'CMBBRAKEIPBASIC', N'IP65 Std'),
    (N'Cleanroom - EX35', N'CMBTRAFFICLIGHT', N'No'),
    (N'Cleanroom - EX35', N'CMBPEBEAMS', N'Light Curtain - 1830mm'),
    (N'Cleanroom - EX35', N'CHKHYPERLIFT', N'0'),
    (N'Cleanroom - EX35', N'CHKSTAINLESS', N'0'),
    (N'Cleanroom - EX35', N'CHKHOLDOPEN', N'0'),
    (N'Cleanroom - EX35', N'CHKINTERLOCK', N'0'),
    (N'Cleanroom - EX35', N'CMBSPECIALCONDUIT', N'Standard'),
    (N'Cleanroom - EX35', N'CMBPED1', N'In Jbox - Door Side Left'),
    (N'Cleanroom - EX35', N'CMBPED2', N'In Jbox - Non Door Side Left'),
    (N'Coles - EX35', N'CMBDOORMODEL', N'EX35'),
    (N'Coles - EX35', N'CMBCURTAINCOLOUR', N'Grey 705'),
    (N'Coles - EX35', N'CMBPOWERSUPPLY', N'1P10A'),
    (N'Coles - EX35', N'CMBTRACKCONFIG', N'Concealed'),
    (N'Coles - EX35', N'CMBWINDTRACK', N'No'),
    (N'Coles - EX35', N'CMBCONTROLLERENCLOSURE', N'Std ABS IP54'),
    (N'Coles - EX35', N'CMBMOTORSHROUD', N'No'),
    (N'Coles - EX35', N'CMBBRAKEIPBASIC', N'IP65 Std'),
    (N'Coles - EX35', N'CMBBRUSHSEAL', N'Fascia Only'),
    (N'Coles - EX35', N'CMBTRAFFICLIGHT', N'No'),
    (N'Coles - EX35', N'CMBPEBEAMS', N'Light Curtain - 1830mm'),
    (N'Coles - EX35', N'CHKHYPERLIFT', N'0'),
    (N'Coles - EX35', N'CHKSTAINLESS', N'0'),
    (N'Coles - EX35', N'CHKHOLDOPEN', N'0'),
    (N'Coles - EX35', N'CHKINTERLOCK', N'0'),
    (N'Coles - EX35', N'CMBUPS', N'1kVA UPS - 10A'),
    (N'Coles - EX35', N'CMBSPECIALCONDUIT', N'Standard'),
    (N'Coles - EX35', N'CMBPED1', N'In Jbox - Door Side Left'),
    (N'Coles - EX35', N'CMBPED2', N'In Jbox - Non Door Side Left'),
    (N'Carwash - ES40', N'CMBDOORMODEL', N'ES40'),
    (N'Carwash - ES40', N'CMBPOWERSUPPLY', N'1P10A'),
    (N'Carwash - ES40', N'CMBTRACKCONFIG', N'Proud'),
    (N'Carwash - ES40', N'CMBWINDTRACK', N'No'),
    (N'Carwash - ES40', N'CMBCONTROLLERENCLOSURE', N'Remax S/S IP66'),
    (N'Carwash - ES40', N'CMBMOTORSHROUD', N'Yes - Stainless Steel Upgrade'),
    (N'Carwash - ES40', N'CMBBRAKEIPBASIC', N'Aggressive / Corrosive'),
    (N'Carwash - ES40', N'CMBBRUSHSEAL', N'None'),
    (N'Carwash - ES40', N'CMBTRAFFICLIGHT', N'No'),
    (N'Carwash - ES40', N'CMBPEBEAMS', N'1 Level PE'),
    (N'Carwash - ES40', N'CHKHYPERLIFT', N'0'),
    (N'Carwash - ES40', N'CHKSTAINLESS', N'0'),
    (N'Carwash - ES40', N'CHKHOLDOPEN', N'0'),
    (N'Carwash - ES40', N'CHKINTERLOCK', N'0'),
    (N'Carwash - ES40', N'CMBSPECIALCONDUIT', N'Standard'),
    (N'Carwash - ES40', N'CMBES40FASCIA', N'Yes'),
    (N'Carwash - ES40', N'CMBES40VSDMTR', N'No - GFA DOL'),
    (N'Woolworths - EX35', N'CMBDOORMODEL', N'EX35'),
    (N'Woolworths - EX35', N'CMBCURTAINCOLOUR', N'Light Grey 729'),
    (N'Woolworths - EX35', N'CMBPOWERSUPPLY', N'1P10A'),
    (N'Woolworths - EX35', N'CMBTRACKCONFIG', N'Proud'),
    (N'Woolworths - EX35', N'CMBWINDTRACK', N'No'),
    (N'Woolworths - EX35', N'CMBCONTROLLERENCLOSURE', N'Std ABS IP54'),
    (N'Woolworths - EX35', N'CMBMOTORSHROUD', N'No'),
    (N'Woolworths - EX35', N'CMBBRAKEIPBASIC', N'IP65 Std'),
    (N'Woolworths - EX35', N'CMBBRUSHSEAL', N'Fascia Only'),
    (N'Woolworths - EX35', N'CMBTRAFFICLIGHT', N'No'),
    (N'Woolworths - EX35', N'CMBPEBEAMS', N'Light Curtain - 1830mm'),
    (N'Woolworths - EX35', N'CHKHYPERLIFT', N'0'),
    (N'Woolworths - EX35', N'CHKSTAINLESS', N'0'),
    (N'Woolworths - EX35', N'CHKHOLDOPEN', N'0'),
    (N'Woolworths - EX35', N'CHKINTERLOCK', N'0'),
    (N'Woolworths - EX35', N'CMBUPS', N'1kVA UPS - 10A'),
    (N'Woolworths - EX35', N'CMBSPECIALCONDUIT', N'Standard'),
    (N'Woolworths - EX35', N'CMBPED1', N'In Jbox - Door Side Left'),
    (N'Woolworths - EX35', N'CMBPED2', N'In Jbox - Non Door Side Left'),
    (N'Woolworths - HS25', N'CMBDOORMODEL', N'HS25'),
    (N'Woolworths - HS25', N'CMBCURTAINCOLOUR', N'Light Grey 729'),
    (N'Woolworths - HS25', N'CMBPOWERSUPPLY', N'1P10A'),
    (N'Woolworths - HS25', N'CMBTRACKCONFIG', N'Proud'),
    (N'Woolworths - HS25', N'CMBWINDTRACK', N'No'),
    (N'Woolworths - HS25', N'CMBCONTROLLERENCLOSURE', N'Std ABS IP54'),
    (N'Woolworths - HS25', N'CMBMOTORSHROUD', N'No'),
    (N'Woolworths - HS25', N'CMBBRAKEIPBASIC', N'IP65 Std'),
    (N'Woolworths - HS25', N'CMBBRUSHSEAL', N'Full Guides & Fascia/Hood'),
    (N'Woolworths - HS25', N'CMBTRAFFICLIGHT', N'No'),
    (N'Woolworths - HS25', N'CMBPEBEAMS', N'1 Level PE'),
    (N'Woolworths - HS25', N'CHKHYPERLIFT', N'0'),
    (N'Woolworths - HS25', N'CHKSTAINLESS', N'0'),
    (N'Woolworths - HS25', N'CHKHOLDOPEN', N'0'),
    (N'Woolworths - HS25', N'CHKINTERLOCK', N'0'),
    (N'Woolworths - HS25', N'CMBSPECIALCONDUIT', N'Standard'),
    (N'Woolworths - HS25', N'CMBPED1', N'Door Column Left'),
    (N'Woolworths - HS25', N'CMBPED2', N'Side Cover Left'),
    (N'Dan Murphys - EX35', N'CMBDOORMODEL', N'EX35'),
    (N'Dan Murphys - EX35', N'CMBCURTAINCOLOUR', N'Black 905'),
    (N'Dan Murphys - EX35', N'CMBPOWERSUPPLY', N'1P10A'),
    (N'Dan Murphys - EX35', N'CMBTRACKCONFIG', N'Proud'),
    (N'Dan Murphys - EX35', N'CMBWINDTRACK', N'No'),
    (N'Dan Murphys - EX35', N'CMBCONTROLLERENCLOSURE', N'Std ABS IP54'),
    (N'Dan Murphys - EX35', N'CMBMOTORSHROUD', N'No'),
    (N'Dan Murphys - EX35', N'CMBBRAKEIPBASIC', N'IP65 Std'),
    (N'Dan Murphys - EX35', N'CMBBRUSHSEAL', N'Fascia Only'),
    (N'Dan Murphys - EX35', N'CMBTRAFFICLIGHT', N'No'),
    (N'Dan Murphys - EX35', N'CMBPEBEAMS', N'Light Curtain - 1830mm'),
    (N'Dan Murphys - EX35', N'CHKHYPERLIFT', N'0'),
    (N'Dan Murphys - EX35', N'CHKSTAINLESS', N'0'),
    (N'Dan Murphys - EX35', N'CHKHOLDOPEN', N'0'),
    (N'Dan Murphys - EX35', N'CHKINTERLOCK', N'0'),
    (N'Dan Murphys - EX35', N'CMBUPS', N'1kVA UPS - 10A'),
    (N'Dan Murphys - EX35', N'CMBSPECIALCONDUIT', N'Standard'),
    (N'Dan Murphys - EX35', N'CMBPED1', N'In Jbox - Door Side Left'),
    (N'Dan Murphys - EX35', N'CMBPED2', N'In Jbox - Non Door Side Left'),
    (N'Como Glass House - HS35', N'CMBDOORMODEL', N'HS35'),
    (N'Como Glass House - HS35', N'CMBCURTAINCOLOUR', N'Orange 244'),
    (N'Como Glass House - HS35', N'CMBPOWERSUPPLY', N'1P10A'),
    (N'Como Glass House - HS35', N'CMBTRACKCONFIG', N'Proud'),
    (N'Como Glass House - HS35', N'CMBWINDTRACK', N'No'),
    (N'Como Glass House - HS35', N'CMBCONTROLLERENCLOSURE', N'Remax S/S IP66'),
    (N'Como Glass House - HS35', N'CMBMOTORSHROUD', N'No'),
    (N'Como Glass House - HS35', N'CMBBRAKEIPBASIC', N'IP65 Std'),
    (N'Como Glass House - HS35', N'CMBBRUSHSEAL', N'500 top of Guides (Std)'),
    (N'Como Glass House - HS35', N'CMBTRAFFICLIGHT', N'Yes'),
    (N'Como Glass House - HS35', N'CMBPEBEAMS', N'1 Level PE'),
    (N'Como Glass House - HS35', N'CHKHYPERLIFT', N'0'),
    (N'Como Glass House - HS35', N'CHKSTAINLESS', N'0'),
    (N'Como Glass House - HS35', N'CHKHOLDOPEN', N'0'),
    (N'Como Glass House - HS35', N'CHKINTERLOCK', N'1'),
    (N'Como Glass House - HS35', N'CMBSPECIALCONDUIT', N'Standard'),
    (N'Como Glass House - HS35', N'CMBPED1', N'In Jbox - Non Door Side Left'),
    (N'Como Glass House - HS35', N'CMBPED2', N'In Jbox - Door Side Left'),
    (N'Como Glass House - HS35', N'CMBACT1', N'Existing Induction Loop');

-- Clear any previous run. Identified by their CMBSPECIFICATION condition, so
-- nothing else in uCfgDefaults is touched.
DELETE dc FROM dbo.uCfgDefaultConditions dc
JOIN dbo.uCfgDefaults d ON d.DefaultID = dc.DefaultID
WHERE d.CfgID = @Cfg AND d.SpecName IS NOT NULL;

DELETE FROM dbo.uCfgDefaults WHERE CfgID = @Cfg AND SpecName IS NOT NULL;

-- One default per (spec, control). SpecName both tags the row and keeps it
-- distinct under the widened unique constraint.
DECLARE @New TABLE (DefaultID INT, Spec NVARCHAR(100));

MERGE dbo.uCfgDefaults AS tgt
USING @D AS src ON 1 = 0
WHEN NOT MATCHED THEN
    INSERT (CfgID, DoorModel, ControlName, DefaultValue, Priority, SpecName)
    VALUES (@Cfg, NULL, src.ControlName, src.Val, 50, src.Spec)
OUTPUT inserted.DefaultID, src.Spec INTO @New (DefaultID, Spec);

INSERT INTO dbo.uCfgDefaultConditions (DefaultID, GroupNo, ControlName, Operator, CompareValue)
SELECT n.DefaultID, 1, N'CMBSPECIFICATION', N'equals', n.Spec
FROM @New n;

COMMIT TRANSACTION;

SELECT dc.CompareValue AS Specification, COUNT(*) AS DefaultsApplied
FROM dbo.uCfgDefaults d
JOIN dbo.uCfgDefaultConditions dc ON dc.DefaultID = d.DefaultID
WHERE d.CfgID = @Cfg AND dc.ControlName = N'CMBSPECIFICATION'
GROUP BY dc.CompareValue
ORDER BY dc.CompareValue;

PRINT '';
PRINT 'Restart the API afterwards. Choosing a specification then fills the';
PRINT 'configuration; Priority 50 means it beats the door model defaults.';

-- -- Record this migration ------------------------------------------------
-- Runs whether the script was applied by the runner or by hand in SSMS.
-- Skipped silently if 000_migration_log.sql has not been run yet, so an older
-- database is never blocked by the bookkeeping.
IF OBJECT_ID('dbo.uCfgMigrations', 'U') IS NOT NULL
    INSERT INTO dbo.uCfgMigrations (Version, Script, Notes)
    VALUES (N'v0.4.0', N'01_spec_defaults_rrd.sql', N'CMBSPECIFICATION parameter and 174 specification defaults');
GO
