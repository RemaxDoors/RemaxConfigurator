/* Pricing / upgrade rules — the companion to the validation rules.
   A rule maps a selection combination to a PART (with a category), which the
   pricing engine turns into a priced line. Same condition pattern + calculator
   escape hatch as validations, plus audit columns.
   Re-runnable on a local test DB. */

IF OBJECT_ID('dbo.uCfgRuleConditions', 'U') IS NOT NULL DROP TABLE dbo.uCfgRuleConditions;
IF OBJECT_ID('dbo.uCfgRules', 'U')          IS NOT NULL DROP TABLE dbo.uCfgRules;
GO

CREATE TABLE dbo.uCfgRules (
    RuleID         INT IDENTITY(1,1) NOT NULL,
    CfgID          INT           NOT NULL,
    RuleCode       NVARCHAR(30)  NOT NULL,
    Name           NVARCHAR(100) NOT NULL,
    Category       NVARCHAR(20)  NOT NULL,   -- BASE / ASSEMBLY_UPGRADE / MATERIAL_UPGRADE / MATERIAL_DISCOUNT / INSTALLATION
    ResultPartID   NVARCHAR(30)  NULL,       -- part added when the rule fires (M1 Parts.imhPartID)
    ResultRevision NVARCHAR(5)   NULL,
    Quantity       NVARCHAR(50)  NOT NULL CONSTRAINT DF_uCfgRules_Qty DEFAULT ('1'), -- fixed number or a formula
    CalculatorRef  NVARCHAR(50)  NULL,       -- code function for computed quantity/conditions
    IsActive       BIT           NOT NULL CONSTRAINT DF_uCfgRules_Active DEFAULT (1),
    CreatedDate    DATETIME      NOT NULL CONSTRAINT DF_uCfgRules_Created DEFAULT (GETDATE()),
    CreatedBy      NVARCHAR(50)  NULL,
    ModifiedDate   DATETIME      NULL,
    ModifiedBy     NVARCHAR(50)  NULL,
    CONSTRAINT PK_uCfgRules PRIMARY KEY (RuleID),
    CONSTRAINT UQ_uCfgRules UNIQUE (CfgID, RuleCode),
    CONSTRAINT FK_uCfgRules_Cfg FOREIGN KEY (CfgID) REFERENCES dbo.uCfgConfigurators (CfgID)
);
CREATE INDEX IX_uCfgRules_Cfg ON dbo.uCfgRules (CfgID);
GO

CREATE TABLE dbo.uCfgRuleConditions (
    ConditionID  INT IDENTITY(1,1) NOT NULL,
    RuleID       INT           NOT NULL,
    GroupNo      INT           NOT NULL CONSTRAINT DF_uCfgRuleCond_Grp DEFAULT (1), -- same group = AND, different = OR
    ControlName  NVARCHAR(35)  NOT NULL,
    Operator     NVARCHAR(20)  NOT NULL,   -- equals/not_equals/contains/not_contains/starts_with/greater_than/less_than/is_checked/not_checked/in/not_in
    CompareValue NVARCHAR(255) NULL,
    CONSTRAINT PK_uCfgRuleConditions PRIMARY KEY (ConditionID),
    CONSTRAINT FK_uCfgRuleCond_Rule FOREIGN KEY (RuleID) REFERENCES dbo.uCfgRules (RuleID)
);
CREATE INDEX IX_uCfgRuleConditions_Rule ON dbo.uCfgRuleConditions (RuleID);
GO

PRINT 'Pricing rule tables created.';
