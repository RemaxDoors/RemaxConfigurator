-- =============================================================================
-- "Misc Extra (p/door)" -- the free-form one-off on M1's quote matrix.
--
-- M1 carries an amount and a description for something that is not a catalogue
-- part (a duct lifter, say). The app had no equivalent, so those charges had
-- nowhere to go.
--
-- Three parameters rather than one, because a sell price with no cost books the
-- extra at 100% margin and quietly flatters the line:
--
--   NUMMISCEXTRA        what the customer is charged, per door
--   NUMMISCEXTRACOST    what it costs us, per door
--   TXTMISCEXTRADESC    what it is -- appears on the summary row
--
-- price_configuration() adds these to unitSell / unitCost, so they are
-- multiplied by QTY along with everything else, and emits a MISC_EXTRA line so
-- the summary can show where the money went. Leaving them blank adds nothing
-- at all -- no existing quote changes.
--
-- Applied to every configurator that prices a door. Re-runnable: each is
-- inserted only if the control name is absent.
-- =============================================================================

SET NOCOUNT ON;
SET XACT_ABORT ON;
BEGIN TRANSACTION;

DECLARE @Targets TABLE (CfgID INT PRIMARY KEY, PartID NVARCHAR(30));
INSERT INTO @Targets (CfgID, PartID)
SELECT CfgID, PartID FROM dbo.uCfgConfigurators
WHERE PartID IN (N'RRD-MOVIDOR-TEMPLATE', N'SWI-PVC-TEMPLATE', N'CURTAIN-TEMPLATE');

IF NOT EXISTS (SELECT 1 FROM @Targets)
BEGIN
    RAISERROR('None of the expected configurators are here - wrong database?', 16, 1);
    ROLLBACK TRANSACTION;
    RETURN;
END;

DECLARE @P TABLE (
    ControlName NVARCHAR(50) PRIMARY KEY,
    Label       NVARCHAR(100),
    Kind        NVARCHAR(20),
    Section     NVARCHAR(50)
);
INSERT INTO @P (ControlName, Label, Kind, Section) VALUES
 (N'NUMMISCEXTRA',     N'Misc Extra (per door)',      N'number', N'Misc Extra')
,(N'NUMMISCEXTRACOST', N'Misc Extra Cost (per door)', N'number', N'Misc Extra')
,(N'TXTMISCEXTRADESC', N'Misc Extra Description',     N'text',   N'Misc Extra')
;

DECLARE @HasSection BIT =
    CASE WHEN COL_LENGTH('dbo.uCfgParameters', 'Section') IS NULL THEN 0 ELSE 1 END;

IF @HasSection = 1
    INSERT INTO dbo.uCfgParameters
        (CfgID, ControlName, Label, Kind, IsRequired, IsVisible, SortOrder, Section)
    SELECT t.CfgID, p.ControlName, p.Label, p.Kind, 0, 1,
           (SELECT ISNULL(MAX(SortOrder), 0) FROM dbo.uCfgParameters x WHERE x.CfgID = t.CfgID)
             + ROW_NUMBER() OVER (PARTITION BY t.CfgID ORDER BY p.ControlName),
           p.Section
    FROM @Targets t CROSS JOIN @P p
    WHERE NOT EXISTS (
        SELECT 1 FROM dbo.uCfgParameters e
        WHERE e.CfgID = t.CfgID AND UPPER(e.ControlName) = UPPER(p.ControlName));
ELSE
    INSERT INTO dbo.uCfgParameters
        (CfgID, ControlName, Label, Kind, IsRequired, IsVisible, SortOrder)
    SELECT t.CfgID, p.ControlName, p.Label, p.Kind, 0, 1,
           (SELECT ISNULL(MAX(SortOrder), 0) FROM dbo.uCfgParameters x WHERE x.CfgID = t.CfgID)
             + ROW_NUMBER() OVER (PARTITION BY t.CfgID ORDER BY p.ControlName)
    FROM @Targets t CROSS JOIN @P p
    WHERE NOT EXISTS (
        SELECT 1 FROM dbo.uCfgParameters e
        WHERE e.CfgID = t.CfgID AND UPPER(e.ControlName) = UPPER(p.ControlName));

COMMIT TRANSACTION;

SELECT c.PartID, p.ControlName, p.Label, p.Kind
FROM dbo.uCfgParameters p
JOIN dbo.uCfgConfigurators c ON c.CfgID = p.CfgID
WHERE p.ControlName IN (N'NUMMISCEXTRA', N'NUMMISCEXTRACOST', N'TXTMISCEXTRADESC')
ORDER BY c.PartID, p.ControlName;

PRINT '';
PRINT 'Restart the API afterwards if it was running, then the three fields';
PRINT 'appear under "Misc Extra" in the configurator and on the summary.';

-- -- Record this migration ------------------------------------------------
-- Runs whether the script was applied by the runner or by hand in SSMS.
-- Skipped silently if 000_migration_log.sql has not been run yet, so an older
-- database is never blocked by the bookkeeping.
IF OBJECT_ID('dbo.uCfgMigrations', 'U') IS NOT NULL
    INSERT INTO dbo.uCfgMigrations (Version, Script, Notes)
    VALUES (N'v0.3.0', N'01_add_misc_extra_parameters.sql', N'NUMMISCEXTRA / NUMMISCEXTRACOST / TXTMISCEXTRADESC');
GO
