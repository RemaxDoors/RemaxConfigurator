-- =============================================================================
-- Pre-flight for writing quote header fields back to M1.
--
-- READ-ONLY. It writes nothing. Run it before the meeting, and again before
-- any UPDATE, so you know the target columns exist and will hold what the app
-- sends.
--
-- TWO THINGS TO SAY OUT LOUD FIRST
--
--   1. There is no uQuotes table. The table is dbo.Quotes. The "uqmp" prefix
--      is on M1's user-defined COLUMNS (uqmpProjectName, uqmpRevision), which
--      is a different thing. A script aimed at uQuotes fails on object name.
--
--   2. M1 ships API_Quote, API_QuoteLine, API_QuoteQuantity and
--      API_QuoteSalesPerson views. Those look like ECI's intended integration
--      surface, and API_Quote does NOT expose any of the uqmp* custom columns.
--      Worth asking Michael whether writes should go through the views, and if
--      so how the custom fields are meant to be set.
--
-- Run against M1 (M1_RP here; M1_T3 on the Azure-facing server).
-- =============================================================================

SET NOCOUNT ON;

-- What the app has for a quote header, and where each field is mapped.
-- Kept inline rather than joined from RP_config so this runs standalone
-- against M1 with nothing else in scope.
DECLARE @AppFields TABLE (
    AppField   NVARCHAR(60),
    M1Column   NVARCHAR(128),
    SampleUse  NVARCHAR(100)
);
INSERT INTO @AppFields (AppField, M1Column, SampleUse) VALUES
 (N'quoteId',          N'qmpQuoteID',               N'the quote being updated')
,(N'customerId',       N'qmpCustomerOrganizationID', N'from the customer picker')
,(N'shipToOrgId',      N'qmpShipOrganizationID',    N'from the customer picker')
,(N'shipToLocationId', N'qmpShipLocationID',        N'from the location picker')
,(N'projectName',      N'uqmpProjectName',          N'free text typed by the salesperson')
,(N'salesPerson',      N'qmpQuoterEmployeeID',      N'Employees.lmeEmployeeID')
,(N'revision',         N'uqmpRevision',             N'app starts at "A"')
,(N'quoteType',        N'uqmpQuoteType',            N'set by the app')
,(N'marginPercent',    N'uqmpMargin',               N'computed, a fraction')
,(N'createdBy',        N'qmpCreatedBy',             N'the signed-in user')
,(N'quoteDate',        N'qmpQuoteDate',             N'header date field')
,(N'dueDate',          N'qmpDueDate',               N'header date field')
,(N'leadSource',       N'uqmpMarketingProgramID',   N'MarketingPrograms.looMarketingProgramID')
;

PRINT '=== 1. Does every mapped column exist on dbo.Quotes, and will it fit? ===';

SELECT  a.AppField,
        a.M1Column,
        CASE WHEN c.COLUMN_NAME IS NULL THEN 'MISSING ON Quotes' ELSE 'ok' END AS Exists_,
        c.DATA_TYPE                                        AS M1Type,
        c.CHARACTER_MAXIMUM_LENGTH                         AS MaxLen,
        c.IS_NULLABLE                                      AS Nullable,
        CASE
            WHEN c.COLUMN_NAME IS NULL THEN 'cannot write - column not found'
            WHEN c.IS_NULLABLE = 'NO' AND c.COLUMN_DEFAULT IS NULL
                THEN 'NOT NULL and no default - the app must always send a value'
            WHEN c.CHARACTER_MAXIMUM_LENGTH BETWEEN 1 AND 5
                THEN 'very short - check the app cannot exceed '
                     + CAST(c.CHARACTER_MAXIMUM_LENGTH AS VARCHAR) + ' chars'
            ELSE ''
        END                                                AS Watch,
        a.SampleUse
FROM @AppFields a
LEFT JOIN INFORMATION_SCHEMA.COLUMNS c
       ON c.TABLE_NAME = 'Quotes' AND c.COLUMN_NAME = a.M1Column
ORDER BY CASE WHEN c.COLUMN_NAME IS NULL THEN 0
              WHEN c.CHARACTER_MAXIMUM_LENGTH BETWEEN 1 AND 5 THEN 1
              ELSE 2 END,
         a.AppField;

PRINT '';
PRINT '=== 2. Values already in these columns (is the app consistent with M1?) ===';

SELECT TOP 20
       qmpQuoteID, uqmpRevision, uqmpQuoteType,
       uqmpMarketingProgramID, qmpQuoterEmployeeID,
       qmpQuoteDate, qmpDueDate, LEN(uqmpProjectName) AS ProjectNameLen
FROM dbo.Quotes
ORDER BY qmpQuoteDate DESC;

PRINT '';
PRINT '=== 3. How long do real values get? (sizes the risk) ===';

SELECT 'uqmpProjectName' AS Col, MAX(LEN(uqmpProjectName)) AS LongestInUse,
       (SELECT CHARACTER_MAXIMUM_LENGTH FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_NAME='Quotes' AND COLUMN_NAME='uqmpProjectName') AS ColumnAllows
FROM dbo.Quotes
UNION ALL
SELECT 'uqmpRevision', MAX(LEN(uqmpRevision)),
       (SELECT CHARACTER_MAXIMUM_LENGTH FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_NAME='Quotes' AND COLUMN_NAME='uqmpRevision') FROM dbo.Quotes
UNION ALL
SELECT 'uqmpQuoteType', MAX(LEN(uqmpQuoteType)),
       (SELECT CHARACTER_MAXIMUM_LENGTH FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_NAME='Quotes' AND COLUMN_NAME='uqmpQuoteType') FROM dbo.Quotes
UNION ALL
SELECT 'uqmpMarketingProgramID', MAX(LEN(uqmpMarketingProgramID)),
       (SELECT CHARACTER_MAXIMUM_LENGTH FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_NAME='Quotes' AND COLUMN_NAME='uqmpMarketingProgramID') FROM dbo.Quotes;

PRINT '';
PRINT '=== 4. Which lead source codes are valid? ===';

SELECT looMarketingProgramID, looShortDescription
FROM dbo.MarketingPrograms
WHERE looInactive = 0
ORDER BY looShortDescription;

PRINT '';
PRINT '=== 5. Which quoters are valid? (excluding the terminated ones) ===';

SELECT lmeEmployeeID, lmeEmployeeName
FROM dbo.Employees
WHERE lmeQuoterEmployee = 1
  AND lmeContactTitleID = 'SALE'
  AND lmeTerminationDate IS NULL       -- two SALE quoters left in Dec 2024 and
ORDER BY lmeEmployeeName;              -- still carry "- INACTIVE" in the name
GO


/* =============================================================================
   THE UPDATE — read the checks above first, then edit and run this yourself.

   Deliberately left commented out, and deliberately NOT run by me: this writes
   to M1, which the app only ever reads.

   Guard rails worth keeping:
     * Always filter on qmpQuoteID. Without a WHERE clause this updates every
       quote in the system.
     * Run the SELECT first and confirm it returns exactly the row you mean.
     * Wrap in a transaction and eyeball @@ROWCOUNT before COMMIT.

-- a. See exactly what you are about to change.
SELECT qmpQuoteID, uqmpProjectName, uqmpRevision, qmpQuoterEmployeeID,
       uqmpMarketingProgramID, qmpQuoteDate, qmpDueDate
FROM dbo.Quotes
WHERE qmpQuoteID = N'<quote id>';

-- b. Change it, with a way back out.
BEGIN TRANSACTION;

UPDATE dbo.Quotes
SET    uqmpProjectName        = N'<project name>',
       qmpQuoterEmployeeID    = N'<lmeEmployeeID>',
       uqmpMarketingProgramID = N'<looMarketingProgramID>',
       qmpQuoteDate           = '<yyyy-mm-dd>',
       qmpDueDate             = '<yyyy-mm-dd>'
WHERE  qmpQuoteID = N'<quote id>';

-- Expect 1. Anything else, ROLLBACK.
SELECT @@ROWCOUNT AS RowsAffected;

-- ROLLBACK TRANSACTION;
-- COMMIT TRANSACTION;
============================================================================= */
