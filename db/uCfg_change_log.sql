-- =============================================================================
-- uCfgChangeLog — audit trail for configurator DEFINITION changes.
--
-- Every time a parameter (or, later, a rule) is created / updated / deleted
-- through the app, a row is written here so engineering can see who changed
-- what and when. The app writes to this table best-effort: if the table does
-- not exist yet, saves still succeed (they just aren't logged).
--
-- Run this once against the CONFIG database (the "new" DB on the M1 server).
-- =============================================================================

IF OBJECT_ID('dbo.uCfgChangeLog', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.uCfgChangeLog (
        ChangeID      INT IDENTITY(1,1) NOT NULL
            CONSTRAINT PK_uCfgChangeLog PRIMARY KEY,

        -- Which table the change happened in, e.g. 'uCfgParameters'.
        PrimaryTable  NVARCHAR(128)  NOT NULL,

        -- Which record changed, e.g. 'RRD-MOVIDOR-TEMPLATE/CMBDOORMODEL'.
        -- (Extra column beyond your list so a change is easy to trace.)
        RecordKey     NVARCHAR(256)  NULL,

        -- INSERT | UPDATE | DELETE. (Extra column so you can filter quickly.)
        Action        NVARCHAR(16)   NOT NULL,

        -- JSON snapshot of the row before / after the change.
        OldValue      NVARCHAR(MAX)  NULL,
        NewValue      NVARCHAR(MAX)  NULL,

        -- Date and time of the change, split as requested.
        ChangeDate    DATE           NOT NULL
            CONSTRAINT DF_uCfgChangeLog_Date DEFAULT (CAST(GETDATE() AS DATE)),
        ChangeTime    TIME(0)        NOT NULL
            CONSTRAINT DF_uCfgChangeLog_Time DEFAULT (CAST(GETDATE() AS TIME)),

        -- Who made the change. Defaults to the SQL login until app sign-in
        -- (Microsoft Entra) is wired up and can pass the real user.
        ChangedBy     NVARCHAR(128)  NOT NULL
            CONSTRAINT DF_uCfgChangeLog_By DEFAULT (SUSER_SNAME())
    );

    CREATE INDEX IX_uCfgChangeLog_Table
        ON dbo.uCfgChangeLog (PrimaryTable, ChangeDate);

    PRINT 'Created dbo.uCfgChangeLog.';
END
ELSE
    PRINT 'dbo.uCfgChangeLog already exists — no change.';
GO

-- Handy view of recent changes (optional):
-- SELECT TOP 100 ChangeID, PrimaryTable, RecordKey, Action, ChangeDate, ChangeTime, ChangedBy
-- FROM dbo.uCfgChangeLog ORDER BY ChangeID DESC;
