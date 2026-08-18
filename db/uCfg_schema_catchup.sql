-- =============================================================================
-- Catch-up migration: objects that only ever existed in the live database.
--
-- Several schema changes were applied by the Python migration scripts
-- (migrate_conditional_defaults.py and friends) rather than by DDL files, so
-- running every db/uCfg_*.sql script against a fresh database produced a schema
-- the application could not use. Found by rebuilding RP_config from scratch and
-- diffing it against the live one.
--
-- This script closes that gap. Run it after the other uCfg_*.sql scripts.
-- Re-runnable, and a no-op on a database that already has these.
-- =============================================================================

-- ── uCfgDefaultConditions ───────────────────────────────────────────────────
-- Conditional defaults: a default row applies only when these conditions pass.
-- Same shape as uCfgRuleConditions — AND within a GroupNo, OR across groups.
IF OBJECT_ID('dbo.uCfgDefaultConditions', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.uCfgDefaultConditions (
        ConditionID  INT IDENTITY(1,1) NOT NULL,
        DefaultID    INT            NOT NULL,
        GroupNo      INT            NOT NULL,
        ControlName  NVARCHAR(35)   NOT NULL,
        Operator     NVARCHAR(20)   NOT NULL,
        CompareValue NVARCHAR(255)  NULL,
        CONSTRAINT PK_uCfgDefaultConditions PRIMARY KEY CLUSTERED (ConditionID),
        CONSTRAINT FK_uCfgDefCond_Default FOREIGN KEY (DefaultID)
            REFERENCES dbo.uCfgDefaults (DefaultID)
    );
    CREATE INDEX IX_uCfgDefaultConditions_Default
        ON dbo.uCfgDefaultConditions (DefaultID);
    PRINT 'created dbo.uCfgDefaultConditions';
END
GO

-- ── uCfgDefaults: conditional / computed / manual support ───────────────────
-- Priority     lower number wins when several rows match the same control.
-- ValueFormula computed default, evaluated by app/formula.py.
-- IsManual     never applied automatically (freight is the example) — the user
--              presses Calculate, so pre-filling it would be wrong.
IF COL_LENGTH('dbo.uCfgDefaults', 'Priority') IS NULL
    ALTER TABLE dbo.uCfgDefaults ADD Priority INT NULL;
GO
IF COL_LENGTH('dbo.uCfgDefaults', 'ValueFormula') IS NULL
    ALTER TABLE dbo.uCfgDefaults ADD ValueFormula NVARCHAR(400) NULL;
GO
IF COL_LENGTH('dbo.uCfgDefaults', 'IsManual') IS NULL
    ALTER TABLE dbo.uCfgDefaults ADD IsManual BIT NULL;
GO

-- DoorModel must be nullable: a conditional or manual default is not tied to
-- one model, and the form skips rows where it is NULL.
IF EXISTS (SELECT 1 FROM sys.columns
           WHERE object_id = OBJECT_ID('dbo.uCfgDefaults')
             AND name = 'DoorModel' AND is_nullable = 0)
    ALTER TABLE dbo.uCfgDefaults ALTER COLUMN DoorModel NVARCHAR(35) NULL;
GO

-- ── uCfgRules: formula-driven quantity and revision ─────────────────────────
IF COL_LENGTH('dbo.uCfgRules', 'QuantityFormula') IS NULL
    ALTER TABLE dbo.uCfgRules ADD QuantityFormula NVARCHAR(400) NULL;
GO
IF COL_LENGTH('dbo.uCfgRules', 'Notes') IS NULL
    ALTER TABLE dbo.uCfgRules ADD Notes NVARCHAR(400) NULL;
GO
-- Wide enough for the longest revision expression; NVARCHAR(5) truncated
-- 'CONCERT/M-FOLD' when this was first added.
IF COL_LENGTH('dbo.uCfgRules', 'ResultRevisionFormula') IS NULL
    ALTER TABLE dbo.uCfgRules ADD ResultRevisionFormula NVARCHAR(600) NULL;
GO

-- ── unique constraints that were widened in the live database ───────────────
-- UQ_uCfgParameterOptions was (ParamID, OptionValue). Two options can share a
-- value and differ only by label — the freight rates for TAS and WA are both
-- 1.9 — so the label belongs in the key.
IF EXISTS (SELECT 1 FROM sys.indexes i
           JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
           WHERE i.name = 'UQ_uCfgParameterOptions'
           GROUP BY i.name HAVING COUNT(*) = 2)
BEGIN
    ALTER TABLE dbo.uCfgParameterOptions DROP CONSTRAINT UQ_uCfgParameterOptions;
    ALTER TABLE dbo.uCfgParameterOptions ADD CONSTRAINT UQ_uCfgParameterOptions
        UNIQUE (ParamID, OptionValue, OptionLabel);
    PRINT 'widened UQ_uCfgParameterOptions to include OptionLabel';
END
GO

-- UQ_uCfgDefaults was (CfgID, DoorModel, ControlName). The same control can
-- have a different default per parent configurator, so ParentPartID is part
-- of the key.
IF EXISTS (SELECT 1 FROM sys.indexes i
           JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
           WHERE i.name = 'UQ_uCfgDefaults'
           GROUP BY i.name HAVING COUNT(*) = 3)
BEGIN
    ALTER TABLE dbo.uCfgDefaults DROP CONSTRAINT UQ_uCfgDefaults;
    ALTER TABLE dbo.uCfgDefaults ADD CONSTRAINT UQ_uCfgDefaults
        UNIQUE (CfgID, ParentPartID, DoorModel, ControlName);
    PRINT 'widened UQ_uCfgDefaults to include ParentPartID';
END
GO

-- ── widths that were increased in the live database ─────────────────────────
-- ResultRevision NVARCHAR(5) truncated 'CONCERT/M-FOLD'. 15 matches M1's
-- imrPartRevisionID.
IF COL_LENGTH('dbo.uCfgRules', 'ResultRevision') < 30
    ALTER TABLE dbo.uCfgRules ALTER COLUMN ResultRevision NVARCHAR(15) NULL;
GO

IF COL_LENGTH('dbo.uCfgDefaults', 'DoorModel') < 70
    ALTER TABLE dbo.uCfgDefaults ALTER COLUMN DoorModel NVARCHAR(35) NULL;
GO

-- ── quantity fields must accept NULL ────────────────────────────────────────
-- These were created NOT NULL with defaults, but a rule that says nothing
-- about after-hours or pairing stores NULL rather than a made-up 1, and the
-- engine distinguishes the two.
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.uCfgRules')
           AND name = 'AHFactor' AND is_nullable = 0)
    ALTER TABLE dbo.uCfgRules ALTER COLUMN AHFactor INT NULL;
GO
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.uCfgRules')
           AND name = 'QuantityUnit' AND is_nullable = 0)
    ALTER TABLE dbo.uCfgRules ALTER COLUMN QuantityUnit NVARCHAR(15) NULL;
GO
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.uCfgRules')
           AND name = 'SwiPairDoubles' AND is_nullable = 0)
    ALTER TABLE dbo.uCfgRules ALTER COLUMN SwiPairDoubles BIT NULL;
GO

PRINT 'uCfg schema catch-up complete.';
GO
