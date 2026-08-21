-- =============================================================================
-- Migration log. Run this FIRST, once per database.
--
-- Every migration ends by recording itself here, so "what has been applied to
-- Azure?" is a query rather than a guess. Without it the only way to tell is to
-- inspect the data and infer, which is how the two databases drifted apart in
-- the first place — both held 62 rules, but not the same 62.
--
-- The migrations themselves are all idempotent, so a second run is harmless.
-- This table is for visibility, not for locking.
--
--   SELECT * FROM dbo.uCfgMigrations ORDER BY AppliedUtc;
-- =============================================================================

SET NOCOUNT ON;

IF OBJECT_ID('dbo.uCfgMigrations', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.uCfgMigrations (
        MigrationID INT IDENTITY(1,1) NOT NULL,
        Version     NVARCHAR(20)  NOT NULL,   -- v0.3.0
        Script      NVARCHAR(200) NOT NULL,   -- 01_add_misc_extra_parameters.sql
        AppliedUtc  DATETIME      NOT NULL CONSTRAINT DF_uCfgMigrations_Applied DEFAULT (GETUTCDATE()),
        AppliedBy   NVARCHAR(128) NOT NULL CONSTRAINT DF_uCfgMigrations_By DEFAULT (SUSER_SNAME()),
        Notes       NVARCHAR(500) NULL,
        CONSTRAINT PK_uCfgMigrations PRIMARY KEY (MigrationID)
    );
    -- Deliberately NOT unique on (Version, Script): re-running a migration is
    -- allowed and each run is worth seeing, because "it was applied twice on
    -- the 14th" is exactly the kind of thing you want in the log.
    CREATE INDEX IX_uCfgMigrations_Version ON dbo.uCfgMigrations (Version, Script);
    PRINT 'Created dbo.uCfgMigrations.';
END
ELSE
    PRINT 'dbo.uCfgMigrations already exists.';
GO

SELECT Version, Script, AppliedUtc, AppliedBy
FROM dbo.uCfgMigrations
ORDER BY AppliedUtc DESC;
