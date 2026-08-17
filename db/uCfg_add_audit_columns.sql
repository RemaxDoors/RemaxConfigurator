/* Add audit columns (CreatedDate/By, ModifiedDate/By) to the configurator
   definition tables, so every rule/parameter change records who + when.
   Re-runnable: each block is guarded so it only adds columns once. */

-- uCfgParameters
IF COL_LENGTH('dbo.uCfgParameters', 'ModifiedDate') IS NULL
    ALTER TABLE dbo.uCfgParameters ADD
        CreatedDate  DATETIME     NOT NULL CONSTRAINT DF_uCfgParam_Created DEFAULT (GETDATE()),
        CreatedBy    NVARCHAR(50) NULL,
        ModifiedDate DATETIME     NULL,
        ModifiedBy   NVARCHAR(50) NULL;
GO

-- uCfgParameterOptions
IF COL_LENGTH('dbo.uCfgParameterOptions', 'ModifiedDate') IS NULL
    ALTER TABLE dbo.uCfgParameterOptions ADD
        CreatedDate  DATETIME     NOT NULL CONSTRAINT DF_uCfgOpt_Created DEFAULT (GETDATE()),
        CreatedBy    NVARCHAR(50) NULL,
        ModifiedDate DATETIME     NULL,
        ModifiedBy   NVARCHAR(50) NULL;
GO

-- uCfgDefaults
IF COL_LENGTH('dbo.uCfgDefaults', 'ModifiedDate') IS NULL
    ALTER TABLE dbo.uCfgDefaults ADD
        CreatedDate  DATETIME     NOT NULL CONSTRAINT DF_uCfgDef_Created DEFAULT (GETDATE()),
        CreatedBy    NVARCHAR(50) NULL,
        ModifiedDate DATETIME     NULL,
        ModifiedBy   NVARCHAR(50) NULL;
GO

-- uCfgValidationRules
IF COL_LENGTH('dbo.uCfgValidationRules', 'ModifiedDate') IS NULL
    ALTER TABLE dbo.uCfgValidationRules ADD
        CreatedDate  DATETIME     NOT NULL CONSTRAINT DF_uCfgVal_Created DEFAULT (GETDATE()),
        CreatedBy    NVARCHAR(50) NULL,
        ModifiedDate DATETIME     NULL,
        ModifiedBy   NVARCHAR(50) NULL;
GO

-- uCfgConfigurators already has CreatedDate/ModifiedDate/ModifiedBy; add CreatedBy
IF COL_LENGTH('dbo.uCfgConfigurators', 'CreatedBy') IS NULL
    ALTER TABLE dbo.uCfgConfigurators ADD CreatedBy NVARCHAR(50) NULL;
GO

PRINT 'Audit columns added.';
