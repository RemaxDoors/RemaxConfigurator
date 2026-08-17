-- =============================================================================
-- Add a Section field to parameters. This groups parameters into the steps /
-- sections the configurator form renders (Size, Overview, Upgrades, Activation…).
-- Each configurator controls its own layout via this column.
--
-- Part 1 adds the column (safe/re-runnable).
-- Part 2 seeds sensible sections for the RRD Movidor template from the old
-- Streamlit door_section.py grouping. Re-running just re-applies the mapping.
-- =============================================================================

-- ── Part 1: column ───────────────────────────────────────────────────────────
IF COL_LENGTH('dbo.uCfgParameters', 'Section') IS NULL
BEGIN
    ALTER TABLE dbo.uCfgParameters ADD Section NVARCHAR(50) NULL;
    PRINT 'Added uCfgParameters.Section.';
END
ELSE
    PRINT 'uCfgParameters.Section already exists.';
GO

-- ── Part 2: seed RRD sections ────────────────────────────────────────────────
DECLARE @Cfg INT = (SELECT TOP 1 CfgID FROM dbo.uCfgConfigurators WHERE PartID = N'RRD-MOVIDOR-TEMPLATE');
IF @Cfg IS NULL BEGIN RAISERROR('RRD-MOVIDOR-TEMPLATE not found.', 16, 1); RETURN; END;

UPDATE p SET Section = v.Section
FROM dbo.uCfgParameters p
JOIN (VALUES
    ('CMBDOORMODEL','Size'), ('NUMDOORHEIGHT','Size'), ('NUMDOORWIDTH','Size'), ('QTY','Size'),

    ('CMBGPOISO','Overview'), ('CMBMOTORORIDE','Overview'), ('CMBTRACKCONFIG','Overview'),
    ('CMBWINDTRACK','Overview'), ('CMBELECSPEC','Overview'), ('CMBPOWERSUPPLY','Overview'),

    ('CMBCONTROLLERENCLOSURE','Upgrades'), ('CMBMOTORSHROUD','Upgrades'), ('CMBMOTORSPEC','Upgrades'),
    ('CMBBRUSHSEAL','Upgrades'), ('CMBTRAFFICLIGHT','Upgrades'), ('CMBPEBEAMS','Upgrades'),
    ('CHKHYPERLIFT','Upgrades'), ('CHKHOLDOPEN','Upgrades'), ('CHKINTERLOCK','Upgrades'),
    ('CHKSTAINLESS','Upgrades'), ('CHKEX35FELT','Upgrades'), ('CHKMOTORCLEARCOAT','Upgrades'),

    ('CMBUPS','Extras & Finish'), ('CMBCUSTSTEEL','Extras & Finish'), ('CMBREARHOODBRUSHSEAL','Extras & Finish'),
    ('CMBSPECIALCONDUIT','Extras & Finish'), ('CMBCOLOURFINISHTYPE','Extras & Finish'),

    ('CMBES40FASCIA','ES40 Options'), ('CMBES40VSDMTR','ES40 Options'),

    ('CMBHEATTRACELEG','Thermic / Movichill'), ('CMBGEARBOXHEATER','Thermic / Movichill'),
    ('CMBHEATTRACEHOOD','Thermic / Movichill'), ('CMBFELTSEAL','Thermic / Movichill'),

    ('CMBPED1','Activation'), ('CMBPED2','Activation'), ('CMBRADAR1','Activation'), ('CMBRADAR2','Activation'),
    ('CMBACT1','Activation'), ('CMBACT2','Activation'), ('CMBACT3','Activation'), ('CMBACT4','Activation'),
    ('NUMREMOTEQTY1','Activation'), ('NUMREMOTEQTY2','Activation'), ('NUMREMOTEQTY3','Activation'),
    ('NUMREMOTEQTY4','Activation'), ('CMBFLOORLOOPINSTALL','Activation')
) AS v(ControlName, Section) ON v.ControlName = p.ControlName
WHERE p.CfgID = @Cfg;

PRINT 'RRD sections seeded.';
GO
