-- =============================================================================
-- uCfgDefaults.SpecName, and a unique constraint that allows for it.
--
-- WHY THIS EXISTS
--
-- UQ_uCfgDefaults is (CfgID, ParentPartID, DoorModel, ControlName). A
-- specification default has no DoorModel -- it is gated by a condition on
-- CMBSPECIFICATION instead -- so every spec that sets CMBDOORMODEL produces the
-- same key, (1, NULL, NULL, CMBDOORMODEL), and the second one fails:
--
--   Msg 2627 ... Violation of UNIQUE KEY constraint 'UQ_uCfgDefaults'.
--
-- The conditional-defaults mechanism therefore allows exactly ONE conditional
-- default per control per configurator. That is fine for "freight depends on
-- the state" and useless for ten customer specifications that each set thirty
-- controls.
--
-- So the specification has to be part of the key. SpecName is a discriminator,
-- not the gate: uCfgDefaultConditions still decides when a default applies, and
-- resolve_defaults() is unchanged. SpecName exists so the rows can coexist, and
-- so the Defaults tab can say which specification a row belongs to instead of
-- showing 174 rows with no door model and no explanation.
--
-- NULL for every existing row, so nothing already in the table changes meaning:
-- SQL Server treats NULLs as equal in a unique constraint, which keeps the old
-- guarantee exactly as it was for non-spec defaults.
--
-- Run this BEFORE 01_spec_defaults_rrd.sql.
-- =============================================================================

SET NOCOUNT ON;
SET XACT_ABORT ON;

-- -- 1. The column ------------------------------------------------------------
IF COL_LENGTH('dbo.uCfgDefaults', 'SpecName') IS NULL
BEGIN
    ALTER TABLE dbo.uCfgDefaults ADD SpecName NVARCHAR(100) NULL;
    PRINT 'Added uCfgDefaults.SpecName.';
END
ELSE
    PRINT 'uCfgDefaults.SpecName already exists.';
GO

-- -- 2. Widen the unique constraint --------------------------------------------
-- Dropped and recreated rather than altered; SQL Server has no ALTER for the
-- key columns of a constraint. Handles it being either a table constraint or a
-- plain unique index, because both forms exist across these databases.
IF EXISTS (SELECT 1 FROM sys.key_constraints
           WHERE name = 'UQ_uCfgDefaults'
             AND parent_object_id = OBJECT_ID('dbo.uCfgDefaults'))
BEGIN
    ALTER TABLE dbo.uCfgDefaults DROP CONSTRAINT UQ_uCfgDefaults;
    PRINT 'Dropped UQ_uCfgDefaults (constraint).';
END
ELSE IF EXISTS (SELECT 1 FROM sys.indexes
                WHERE name = 'UQ_uCfgDefaults'
                  AND object_id = OBJECT_ID('dbo.uCfgDefaults'))
BEGIN
    DROP INDEX UQ_uCfgDefaults ON dbo.uCfgDefaults;
    PRINT 'Dropped UQ_uCfgDefaults (index).';
END
ELSE
    PRINT 'UQ_uCfgDefaults not present.';
GO

-- Refuse to recreate it over data that would violate it. Better to stop here
-- with the constraint absent and an explanation than to fail with a duplicate
-- key and leave the table unprotected without saying so.
IF EXISTS (
    SELECT 1 FROM dbo.uCfgDefaults
    GROUP BY CfgID, ParentPartID, DoorModel, ControlName, SpecName
    HAVING COUNT(*) > 1
)
BEGIN
    RAISERROR('uCfgDefaults already holds duplicates on (CfgID, ParentPartID, DoorModel, ControlName, SpecName). The constraint has NOT been recreated - resolve the duplicates, then re-run this script.', 16, 1);
    RETURN;
END;

IF NOT EXISTS (SELECT 1 FROM sys.indexes
               WHERE name = 'UQ_uCfgDefaults'
                 AND object_id = OBJECT_ID('dbo.uCfgDefaults'))
BEGIN
    ALTER TABLE dbo.uCfgDefaults
        ADD CONSTRAINT UQ_uCfgDefaults
        UNIQUE (CfgID, ParentPartID, DoorModel, ControlName, SpecName);
    PRINT 'Recreated UQ_uCfgDefaults including SpecName.';
END;
GO

SELECT i.name AS ConstraintName,
       STUFF((SELECT ', ' + c.name
              FROM sys.index_columns ic
              JOIN sys.columns c ON c.object_id = ic.object_id AND c.column_id = ic.column_id
              WHERE ic.object_id = i.object_id AND ic.index_id = i.index_id
              ORDER BY ic.key_ordinal FOR XML PATH('')), 1, 2, '') AS KeyColumns
FROM sys.indexes i
WHERE i.object_id = OBJECT_ID('dbo.uCfgDefaults') AND i.is_unique = 1;

PRINT '';
PRINT 'SpecName is a discriminator only. What makes a default apply is still';
PRINT 'its row in uCfgDefaultConditions - resolve_defaults() is unchanged.';

-- -- Record this migration ------------------------------------------------
IF OBJECT_ID('dbo.uCfgMigrations', 'U') IS NOT NULL
    INSERT INTO dbo.uCfgMigrations (Version, Script, Notes)
    VALUES (N'v0.4.0', N'00_add_default_spec_name.sql',
            N'uCfgDefaults.SpecName + UQ widened to include it');
GO
