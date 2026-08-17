/* ============================================================================
   Maintainable Configurator — DEFINITION schema (M1 SQL Server / T-SQL)

   These custom tables hold the configurator DEFINITION (metadata):
       what parameters exist, their options, defaults, and validation rules.
   They are SEPARATE from ECI's uConfiguratorValues, which stores the SAVED
   values for a specific quote line.

   Maps to the Python source:
       *_control_names.py     -> uCfgParameters
       *_option_registery.py  -> uCfgParameterOptions
       *_default_defaults.py  -> uCfgDefaults
       *_validation_rules.py  -> uCfgValidationRules (+ uCfgValidationConditions)
       *_upgrade_rules.py      -> uCfgRules (+ uCfgRuleConditions)  [pricing companion, same pattern]

   Safe to re-run on a LOCAL test DB: drops existing uCfg* tables first.
   ============================================================================ */

-- ── Optional clean re-run (reverse dependency order) ──────────────────────────
IF OBJECT_ID('dbo.uCfgRuleConditions', 'U')       IS NOT NULL DROP TABLE dbo.uCfgRuleConditions;
IF OBJECT_ID('dbo.uCfgRules', 'U')                IS NOT NULL DROP TABLE dbo.uCfgRules;
IF OBJECT_ID('dbo.uCfgValidationConditions', 'U') IS NOT NULL DROP TABLE dbo.uCfgValidationConditions;
IF OBJECT_ID('dbo.uCfgValidationRules', 'U')      IS NOT NULL DROP TABLE dbo.uCfgValidationRules;
IF OBJECT_ID('dbo.uCfgDefaults', 'U')             IS NOT NULL DROP TABLE dbo.uCfgDefaults;
IF OBJECT_ID('dbo.uCfgParameterOptions', 'U')     IS NOT NULL DROP TABLE dbo.uCfgParameterOptions;
IF OBJECT_ID('dbo.uCfgParameters', 'U')           IS NOT NULL DROP TABLE dbo.uCfgParameters;
IF OBJECT_ID('dbo.uCfgConfigurators', 'U')        IS NOT NULL DROP TABLE dbo.uCfgConfigurators;
GO

/* 1. Configurators — one row per M1 configurator template part.
      PartID / PartRevision reference M1 Parts (imhPartID / imhPartRevisionID). */
CREATE TABLE dbo.uCfgConfigurators (
    CfgID            INT IDENTITY(1,1) NOT NULL,
    PartID           NVARCHAR(30)  NOT NULL,   -- M1 Parts.imhPartID (the template part)
    PartRevision     NVARCHAR(5)   NULL,       -- M1 Parts.imhPartRevisionID
    PartDescription  NVARCHAR(100) NULL,
    ConfiguratorName NVARCHAR(50)  NOT NULL,   -- friendly, e.g. 'RRD Movidor'
    DoorType         NVARCHAR(10)  NULL,       -- RRD / SWI / ENT / STRIP (NULL for curtain/install)
    IsActive         BIT           NOT NULL CONSTRAINT DF_uCfgConf_Active   DEFAULT (1),
    CreatedDate      DATETIME      NOT NULL CONSTRAINT DF_uCfgConf_Created  DEFAULT (GETDATE()),
    ModifiedDate     DATETIME      NULL,
    ModifiedBy       NVARCHAR(50)  NULL,
    CONSTRAINT PK_uCfgConfigurators PRIMARY KEY (CfgID),
    CONSTRAINT UQ_uCfgConfigurators_Part UNIQUE (PartID, PartRevision)
);
GO

/* 2. Parameters — the inputs/controls for a configurator (from *_control_names). */
CREATE TABLE dbo.uCfgParameters (
    ParamID     INT IDENTITY(1,1) NOT NULL,
    CfgID       INT           NOT NULL,
    ControlName NVARCHAR(35)  NOT NULL,   -- parameter id, e.g. 'CMBUPS'
    Label       NVARCHAR(100) NOT NULL,   -- parameter name (friendly)
    Kind        NVARCHAR(10)  NOT NULL,   -- dropdown / checkbox / number / text
    IsRequired  BIT           NOT NULL CONSTRAINT DF_uCfgParam_Req  DEFAULT (0),
    IsVisible   BIT           NOT NULL CONSTRAINT DF_uCfgParam_Vis  DEFAULT (1),
    SortOrder   INT           NOT NULL CONSTRAINT DF_uCfgParam_Sort DEFAULT (0),
    MinValue    DECIMAL(18,4) NULL,       -- number kind
    MaxValue    DECIMAL(18,4) NULL,       -- number kind
    StepValue   DECIMAL(18,4) NULL,       -- number kind
    HelpText    NVARCHAR(255) NULL,
    CONSTRAINT PK_uCfgParameters PRIMARY KEY (ParamID),
    CONSTRAINT UQ_uCfgParameters UNIQUE (CfgID, ControlName),
    CONSTRAINT FK_uCfgParameters_Cfg FOREIGN KEY (CfgID)
        REFERENCES dbo.uCfgConfigurators (CfgID)
);
CREATE INDEX IX_uCfgParameters_Cfg ON dbo.uCfgParameters (CfgID);
GO

/* 3. Parameter options — dropdown values (from *_option_registery). */
CREATE TABLE dbo.uCfgParameterOptions (
    OptionID    INT IDENTITY(1,1) NOT NULL,
    ParamID     INT           NOT NULL,
    OptionValue NVARCHAR(100) NOT NULL,   -- the M1 value stored
    OptionLabel NVARCHAR(100) NOT NULL,   -- display label
    SortOrder   INT           NOT NULL CONSTRAINT DF_uCfgOpt_Sort   DEFAULT (0),
    IsActive    BIT           NOT NULL CONSTRAINT DF_uCfgOpt_Active DEFAULT (1),
    CONSTRAINT PK_uCfgParameterOptions PRIMARY KEY (OptionID),
    CONSTRAINT UQ_uCfgParameterOptions UNIQUE (ParamID, OptionValue),
    CONSTRAINT FK_uCfgOptions_Param FOREIGN KEY (ParamID)
        REFERENCES dbo.uCfgParameters (ParamID)
);
CREATE INDEX IX_uCfgParameterOptions_Param ON dbo.uCfgParameterOptions (ParamID);
GO

/* 4. Defaults — default value per control, optionally per door model
      (from *_default_defaults; use '*' for "any model"). */
CREATE TABLE dbo.uCfgDefaults (
    DefaultID    INT IDENTITY(1,1) NOT NULL,
    CfgID        INT           NOT NULL,
    DoorModel    NVARCHAR(20)  NOT NULL CONSTRAINT DF_uCfgDef_Model DEFAULT ('*'),
    ControlName  NVARCHAR(35)  NOT NULL,
    DefaultValue NVARCHAR(255) NULL,
    CONSTRAINT PK_uCfgDefaults PRIMARY KEY (DefaultID),
    CONSTRAINT UQ_uCfgDefaults UNIQUE (CfgID, DoorModel, ControlName),
    CONSTRAINT FK_uCfgDefaults_Cfg FOREIGN KEY (CfgID)
        REFERENCES dbo.uCfgConfigurators (CfgID)
);
CREATE INDEX IX_uCfgDefaults_Cfg ON dbo.uCfgDefaults (CfgID, DoorModel);
GO

/* 5. Validation rules — valid-combination checks that raise an error/warning
      shown BEFORE save (from *_validation_rules). Complex/computed checks
      (e.g. area = h*w) point at a named code function via CalculatorRef. */
CREATE TABLE dbo.uCfgValidationRules (
    ValidationID  INT IDENTITY(1,1) NOT NULL,
    CfgID         INT           NOT NULL,
    RuleCode      NVARCHAR(30)  NOT NULL,   -- e.g. 'HYPERLIFT_CARWASH'
    Severity      NVARCHAR(10)  NOT NULL CONSTRAINT DF_uCfgVal_Sev    DEFAULT ('error'), -- error / warning
    TargetField   NVARCHAR(35)  NULL,       -- control the message attaches to
    Message       NVARCHAR(500) NOT NULL,
    CalculatorRef NVARCHAR(50)  NULL,       -- code function for computed/complex rules
    IsActive      BIT           NOT NULL CONSTRAINT DF_uCfgVal_Active DEFAULT (1),
    CONSTRAINT PK_uCfgValidationRules PRIMARY KEY (ValidationID),
    CONSTRAINT UQ_uCfgValidationRules UNIQUE (CfgID, RuleCode),
    CONSTRAINT FK_uCfgVal_Cfg FOREIGN KEY (CfgID)
        REFERENCES dbo.uCfgConfigurators (CfgID)
);
CREATE INDEX IX_uCfgValidationRules_Cfg ON dbo.uCfgValidationRules (CfgID);
GO

/* 6. Validation conditions — the data-expressible conditions of a rule.
      Same GroupNo = AND; different GroupNo = OR. */
CREATE TABLE dbo.uCfgValidationConditions (
    ConditionID  INT IDENTITY(1,1) NOT NULL,
    ValidationID INT           NOT NULL,
    GroupNo      INT           NOT NULL CONSTRAINT DF_uCfgCond_Grp DEFAULT (1),
    ControlName  NVARCHAR(35)  NOT NULL,
    Operator     NVARCHAR(20)  NOT NULL,   -- equals/not_equals/contains/starts_with/greater_than/less_than/is_checked/not_checked/in
    CompareValue NVARCHAR(255) NULL,
    CONSTRAINT PK_uCfgValidationConditions PRIMARY KEY (ConditionID),
    CONSTRAINT FK_uCfgCond_Val FOREIGN KEY (ValidationID)
        REFERENCES dbo.uCfgValidationRules (ValidationID)
);
CREATE INDEX IX_uCfgValidationConditions_Val ON dbo.uCfgValidationConditions (ValidationID);
GO

/* ── Pricing companion (same pattern; add when you migrate *_upgrade_rules) ────
   uCfgRules            : selection -> part (category: BASE/ASSEMBLY_UPGRADE/MATERIAL_UPGRADE/MATERIAL_DISCOUNT/INSTALLATION)
   uCfgRuleConditions   : same condition shape as uCfgValidationConditions
   (Kept out of this script to stay focused on parameters/options/defaults/validation.)
   ──────────────────────────────────────────────────────────────────────────── */

/* ============================================================================
   EXAMPLE SEED — RRD Movidor (a few rows to show the shape)
   ============================================================================ */

INSERT INTO dbo.uCfgConfigurators (PartID, PartRevision, PartDescription, ConfiguratorName, DoorType)
VALUES ('RRD-MOVIDOR-TEMPLATE', 'A', 'RRD Movidor configurator template', 'RRD Movidor', 'RRD');

DECLARE @Cfg INT = SCOPE_IDENTITY();

-- Parameters (a subset)
INSERT INTO dbo.uCfgParameters (CfgID, ControlName, Label, Kind, IsRequired, SortOrder)
VALUES
  (@Cfg, 'CMBDOORMODEL', 'Door model', 'dropdown', 1, 1),
  (@Cfg, 'CMBUPS',       'UPS',        'dropdown', 0, 2),
  (@Cfg, 'CMBELECSPEC',  'Electrical spec', 'dropdown', 0, 3),
  (@Cfg, 'CHKHYPERLIFT', 'Hyperlift',  'checkbox', 0, 4);

INSERT INTO dbo.uCfgParameters (CfgID, ControlName, Label, Kind, IsRequired, SortOrder, MinValue, MaxValue, StepValue)
VALUES
  (@Cfg, 'NUMDOORHEIGHT', 'Door height (mm)', 'number', 1, 5, 1000, 10000, 10),
  (@Cfg, 'NUMDOORWIDTH',  'Door width (mm)',  'number', 1, 6, 1000, 10000, 10);

-- Options for CMBUPS
DECLARE @ParamUps INT = (SELECT ParamID FROM dbo.uCfgParameters WHERE CfgID=@Cfg AND ControlName='CMBUPS');
INSERT INTO dbo.uCfgParameterOptions (ParamID, OptionValue, OptionLabel, SortOrder) VALUES
  (@ParamUps, 'No UPS',          'No UPS',          1),
  (@ParamUps, '1kVA UPS - 10A',  '1kVA UPS - 10A',  2),
  (@ParamUps, '2kVA UPS - 10A',  '2kVA UPS - 10A',  3),
  (@ParamUps, '3kVA UPS - 15A',  '3kVA UPS - 15A',  4);

-- Model-specific default (ES40 defaults electrical spec to Carwash + hyperlift on)
INSERT INTO dbo.uCfgDefaults (CfgID, DoorModel, ControlName, DefaultValue) VALUES
  (@Cfg, 'ES40', 'CMBELECSPEC',  'Carwash'),
  (@Cfg, 'ES40', 'CHKHYPERLIFT', '1');

-- Validation rule #5 (simple, data-expressible): Hyperlift requires Carwash elec spec
INSERT INTO dbo.uCfgValidationRules (CfgID, RuleCode, Severity, TargetField, Message)
VALUES (@Cfg, 'HYPERLIFT_CARWASH', 'error', 'CMBELECSPEC',
        'Hyperlift doors must use ''Carwash'' electrical spec.');
DECLARE @V1 INT = SCOPE_IDENTITY();
INSERT INTO dbo.uCfgValidationConditions (ValidationID, GroupNo, ControlName, Operator, CompareValue) VALUES
  (@V1, 1, 'CHKHYPERLIFT', 'is_checked', NULL),
  (@V1, 1, 'CMBELECSPEC',  'not_equals', 'Carwash');

-- Validation rule #16 (computed): Concertina area > 80 m2 -> warning (needs code calculator)
INSERT INTO dbo.uCfgValidationRules (CfgID, RuleCode, Severity, TargetField, Message, CalculatorRef)
VALUES (@Cfg, 'CONCERTINA_AREA', 'warning', 'NUMDOORHEIGHT',
        'Max size for Concertina is 80m2. Seek technical advice before quoting.',
        'concertina_area_check');
DECLARE @V2 INT = SCOPE_IDENTITY();
-- optional guard condition so the calculator only runs for CONCERTINA
INSERT INTO dbo.uCfgValidationConditions (ValidationID, GroupNo, ControlName, Operator, CompareValue) VALUES
  (@V2, 1, 'CMBDOORMODEL', 'equals', 'CONCERTINA');
GO
