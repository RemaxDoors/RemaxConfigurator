-- =============================================================================
-- Map the new quote-header fields to M1.
--
-- Checked against M1 before writing — every target column exists:
--
--   Lead Source   -> Quotes.uqmpMarketingProgramID   nvarchar(5)   NOT NULL
--   Quoter        -> Quotes.qmpQuoterEmployeeID      nvarchar(10)
--   Quote Date    -> Quotes.qmpQuoteDate             datetime      NULL
--   Due Date      -> Quotes.qmpDueDate               datetime      NULL
--
-- Two of the four were already mapped: qmpQuoteDate as 'quoteDate', and
-- qmpQuoterEmployeeID as 'salesPerson'. This adds the two that were not, and
-- renames nothing — 'salesPerson' stays as it is so existing code keeps working.
--
-- WORTH RAISING WITH MICHAEL: uqmpMarketingProgramID is NOT NULL and only 5
-- characters. So a lead source is mandatory on an M1 quote, and the app has to
-- send one — the values are MarketingPrograms.looMarketingProgramID, e.g.
-- 'TPC', 'ARCH', 'CLSPE', 'DIR', 'GOOGL'. Longest in use today is 5, so the
-- column is exactly full; a new programme code longer than that will not fit.
--
-- Re-runnable.
-- =============================================================================

SET NOCOUNT ON;
SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF OBJECT_ID('dbo.uCfgM1FieldMap', 'U') IS NULL
BEGIN
    RAISERROR('uCfgM1FieldMap is missing. Run db/uCfg_field_map.sql first.', 16, 1);
    ROLLBACK TRANSACTION;
    RETURN;
END;

DECLARE @M TABLE (
    Entity   NVARCHAR(20),
    AppField NVARCHAR(60),
    M1Column NVARCHAR(128),
    Notes    NVARCHAR(200)
);
INSERT INTO @M (Entity, AppField, M1Column, Notes) VALUES
 (N'quote', N'leadSource', N'uqmpMarketingProgramID',
  N'MarketingPrograms.looMarketingProgramID where looInactive = 0. NOT NULL in M1 - a quote must carry one.')
,(N'quote', N'dueDate', N'qmpDueDate',
  N'Quotes.qmpDueDate, datetime, nullable.')
;

-- Insert what is missing; refresh the note on anything already mapped, so a
-- second run cannot create a duplicate AppField.
UPDATE m
SET m.M1Column     = v.M1Column,
    m.Notes        = v.Notes,
    m.ModifiedDate = GETDATE(),
    m.ModifiedBy   = N'quote-header-script'
FROM dbo.uCfgM1FieldMap m
JOIN @M v ON v.Entity = m.Entity AND v.AppField = m.AppField;

INSERT INTO dbo.uCfgM1FieldMap (Entity, AppField, M1Column, Notes, ModifiedDate, ModifiedBy)
SELECT v.Entity, v.AppField, v.M1Column, v.Notes, GETDATE(), N'quote-header-script'
FROM @M v
WHERE NOT EXISTS (
    SELECT 1 FROM dbo.uCfgM1FieldMap m
    WHERE m.Entity = v.Entity AND m.AppField = v.AppField);

COMMIT TRANSACTION;

SELECT MapID, Entity, AppField, M1Column, Notes
FROM dbo.uCfgM1FieldMap
WHERE AppField IN (N'leadSource', N'dueDate', N'quoteDate', N'salesPerson')
ORDER BY AppField;

PRINT '';
PRINT 'Run db/m1_mapping_worksheet.sql afterwards to confirm every mapping';
PRINT 'still resolves to a real M1 column.';

-- -- Record this migration ------------------------------------------------
IF OBJECT_ID('dbo.uCfgMigrations', 'U') IS NOT NULL
    INSERT INTO dbo.uCfgMigrations (Version, Script, Notes)
    VALUES (N'v0.5.0', N'01_quote_header_field_map.sql',
            N'leadSource -> uqmpMarketingProgramID, dueDate -> qmpDueDate');
GO
