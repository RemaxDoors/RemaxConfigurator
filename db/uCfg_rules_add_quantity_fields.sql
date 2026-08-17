-- =============================================================================
-- Add quantity-behaviour fields to uCfgRules.
--
-- These mirror the old Streamlit engine's per-part tuple:
--     _PART_QTY_RULES["LAB-TRVL-2P"] = ("Per Hour", 1, True)
--                                        cUnit      AH   swiPairDoubles
--
-- The base number stays in the existing `Quantity` column (nQtyPerAss = 1);
-- these columns say HOW that base scales. The maths is generic and lives in the
-- engine (calc_qty_per_assembly) — the rule just picks a unit + flags.
--
-- Run uCfg_pricing_rules_schema.sql first if uCfgRules doesn't exist yet.
-- Re-runnable.
-- =============================================================================

IF COL_LENGTH('dbo.uCfgRules', 'QuantityUnit') IS NULL
    ALTER TABLE dbo.uCfgRules ADD QuantityUnit NVARCHAR(15) NOT NULL
        CONSTRAINT DF_uCfgRules_Unit DEFAULT ('Per Door');   -- Per Door | Per Project | Per Leaf | Per Hour | Per Night
GO

IF COL_LENGTH('dbo.uCfgRules', 'AHFactor') IS NULL
    ALTER TABLE dbo.uCfgRules ADD AHFactor INT NOT NULL
        CONSTRAINT DF_uCfgRules_AH DEFAULT (1);              -- multiplier applied when CHKINSAH is checked

GO

IF COL_LENGTH('dbo.uCfgRules', 'SwiPairDoubles') IS NULL
    ALTER TABLE dbo.uCfgRules ADD SwiPairDoubles BIT NOT NULL
        CONSTRAINT DF_uCfgRules_SwiPair DEFAULT (0);         -- SWI- pair doubles the quantity

GO

IF COL_LENGTH('dbo.uCfgRules', 'Operation') IS NULL
    ALTER TABLE dbo.uCfgRules ADD Operation NVARCHAR(10) NULL;  -- e.g. 'INSTA' (NULL = none)
GO

PRINT 'uCfgRules quantity fields ready (QuantityUnit, AHFactor, SwiPairDoubles, Operation).';
GO

-- Cost is deliberately NOT stored here: it is PartRevisions.imrStandardMaterialCost
-- in M1, resolved by the pricing engine at quote time. Keep M1 as the buy-price source.
