-- =============================================================================
-- uCfgM1FieldMap — user-editable mapping of app fields → M1 columns.
-- Drives the "Create Quote in M1" write (Quotes / QuoteLines) and the
-- configurator value write-back (FormInputValues). Managed from the Settings page.
-- Run on the CONFIG database (the "new" DB).
-- =============================================================================
IF OBJECT_ID('dbo.uCfgM1FieldMap', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.uCfgM1FieldMap (
        MapID        INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_uCfgM1FieldMap PRIMARY KEY,
        Entity       NVARCHAR(20)  NOT NULL,   -- 'quote' | 'quoteLine' | 'formInput'
        AppField     NVARCHAR(60)  NOT NULL,   -- app-side field key
        M1Column     NVARCHAR(128) NULL,       -- target M1 column (NULL = not mapped / skip)
        Constant     NVARCHAR(200) NULL,       -- optional fixed value (used when no app source)
        Notes        NVARCHAR(200) NULL,
        ModifiedDate DATETIME      NOT NULL CONSTRAINT DF_uCfgM1FieldMap_Mod DEFAULT (GETDATE()),
        ModifiedBy   NVARCHAR(50)  NULL,
        CONSTRAINT UQ_uCfgM1FieldMap UNIQUE (Entity, AppField)
    );
    PRINT 'Created dbo.uCfgM1FieldMap.';
END
ELSE
    PRINT 'dbo.uCfgM1FieldMap already exists.';
GO
