-- =============================================================================
-- uCfgConfiguratorLinks — which sub-configurators run for a given door.
--
-- Mirrors the Streamlit layout (ui/configurator_section.py):
--   door configurator  -> curtain        (rapid doors only)
--   door configurator  -> installation   (every door type)
--
-- The installation configurator adapts to its parent via CMBCONFIGID, so the
-- parent's PartID is passed down as the child's config id.
-- Run on the CONFIG database (the "new" DB). Re-runnable.
-- =============================================================================
IF OBJECT_ID('dbo.uCfgConfiguratorLinks', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.uCfgConfiguratorLinks (
        LinkID        INT IDENTITY(1,1) NOT NULL
            CONSTRAINT PK_uCfgConfiguratorLinks PRIMARY KEY,
        ParentPartID  NVARCHAR(30) NOT NULL,   -- e.g. RRD-MOVIDOR-TEMPLATE
        ChildPartID   NVARCHAR(30) NOT NULL,   -- e.g. CURTAIN-TEMPLATE
        LinkType      NVARCHAR(20) NOT NULL,   -- 'curtain' | 'installation'
        IsAutomatic   BIT          NOT NULL    -- 1 = always runs, 0 = user opts in
            CONSTRAINT DF_uCfgLinks_Auto DEFAULT (1),
        SortOrder     INT          NOT NULL
            CONSTRAINT DF_uCfgLinks_Sort DEFAULT (1),
        Notes         NVARCHAR(200) NULL,
        CONSTRAINT UQ_uCfgConfiguratorLinks UNIQUE (ParentPartID, ChildPartID)
    );
    PRINT 'Created dbo.uCfgConfiguratorLinks.';
END
ELSE
    PRINT 'dbo.uCfgConfiguratorLinks already exists.';
GO

-- Add the parent key to defaults: the installation configurator's defaults
-- depend on which door configurator it is running under.
IF COL_LENGTH('dbo.uCfgDefaults', 'ParentPartID') IS NULL
BEGIN
    ALTER TABLE dbo.uCfgDefaults ADD ParentPartID NVARCHAR(30) NULL;
    PRINT 'Added uCfgDefaults.ParentPartID.';
END
GO
