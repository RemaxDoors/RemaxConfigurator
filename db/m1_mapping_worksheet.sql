-- =============================================================================
-- M1 field mapping worksheet — for the session with Michael (ECI).
--
-- Part 1 is the question to bring: which app field maps to which M1 column.
-- It lists what the app currently sends, what uCfgM1FieldMap says it maps to,
-- and — this is the part the dropdown could not show you — whether that M1
-- column ACTUALLY EXISTS, with its real type and length.
--
-- A mapping that names a column M1 does not have looks perfectly fine in the
-- admin screen and fails at import time. This tells you before the meeting.
--
-- Part 2 lists candidate M1 columns to map TO, so you can pick from real names
-- rather than guess.
--
-- READ-ONLY. Part 3 holds the UPDATE/INSERT statements, commented out — edit
-- and uncomment the ones you want after agreeing them with Michael.
--
-- Run against the CONFIG database (RP_config). Part 1 reaches into M1 by
-- three-part name, so change M1_RP below if your M1 database is named
-- differently on this server (M1_T3 on the Azure-facing one).
-- =============================================================================

SET NOCOUNT ON;

-- Change this if M1 is not called M1_RP on the server you are running against.
DECLARE @M1 SYSNAME = N'M1_RP';

PRINT '=== PART 1: the current mapping, checked against M1 ===';

DECLARE @sql NVARCHAR(MAX) = N'
SELECT  m.MapID,
        m.Entity                                   AS AppEntity,
        m.AppField                                 AS AppFieldName,
        m.M1Column                                 AS MappedToM1Column,
        m.Constant,
        CASE WHEN m.M1Column IS NULL OR m.M1Column = ''''
             THEN ''NOT MAPPED''
             WHEN c.COLUMN_NAME IS NULL
             THEN ''MISSING IN M1''
             ELSE ''ok'' END                       AS Status,
        c.TABLE_NAME                               AS M1Table,
        c.DATA_TYPE                                AS M1Type,
        c.CHARACTER_MAXIMUM_LENGTH                 AS M1Length,
        c.IS_NULLABLE                              AS M1Nullable,
        m.Notes
FROM dbo.uCfgM1FieldMap m
OUTER APPLY (
    SELECT TOP 1 TABLE_NAME, COLUMN_NAME, DATA_TYPE,
           CHARACTER_MAXIMUM_LENGTH, IS_NULLABLE
    FROM ' + QUOTENAME(@M1) + N'.INFORMATION_SCHEMA.COLUMNS
    WHERE COLUMN_NAME = m.M1Column
    ORDER BY TABLE_NAME
) c
ORDER BY CASE WHEN c.COLUMN_NAME IS NULL THEN 0 ELSE 1 END, m.Entity, m.AppField;';

EXEC sp_executesql @sql;

PRINT '';
PRINT '=== PART 2: M1 columns available on the quote tables ===';
PRINT 'Candidates to map TO. Bring this list to the meeting rather than';
PRINT 'guessing at names.';

SET @sql = N'
SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE,
       CHARACTER_MAXIMUM_LENGTH AS Len, IS_NULLABLE AS Nullable
FROM ' + QUOTENAME(@M1) + N'.INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME IN (
        ''uQuotes'', ''uQuoteLines'', ''uQuoteMatrix'',
        ''Quotes'', ''QuoteLines'', ''QuoteDetails''
      )
ORDER BY TABLE_NAME, ORDINAL_POSITION;';

EXEC sp_executesql @sql;

PRINT '';
PRINT '=== PART 3: edit the mapping (all commented out) ===';
GO

/* ---------------------------------------------------------------------------
   Point an app field at a different M1 column.
   MapID comes from Part 1.

UPDATE dbo.uCfgM1FieldMap
SET    M1Column     = N'<the M1 column Michael confirms>',
       Notes        = N'confirmed with Michael <date>',
       ModifiedDate = GETDATE(),
       ModifiedBy   = N'gizem'
WHERE  MapID = <MapID from Part 1>;

   ---------------------------------------------------------------------------
   Add a mapping that does not exist yet. Entity groups them: 'quote',
   'quoteLine', 'formInput'.

INSERT INTO dbo.uCfgM1FieldMap (Entity, AppField, M1Column, Notes, ModifiedDate, ModifiedBy)
VALUES (N'quote', N'leadSource',        N'<M1 column>', N'MarketingPrograms.looMarketingProgramID', GETDATE(), N'gizem'),
       (N'quote', N'quoterEmployeeId',  N'<M1 column>', N'Employees.lmeEmployeeID',                 GETDATE(), N'gizem'),
       (N'quote', N'quoteDate',         N'<M1 column>', NULL,                                       GETDATE(), N'gizem'),
       (N'quote', N'dueDate',           N'<M1 column>', NULL,                                       GETDATE(), N'gizem');

   ---------------------------------------------------------------------------
   Remove a mapping that is wrong. Prefer clearing M1Column over deleting the
   row: the row records that the app HAS this field and it is not yet mapped,
   which is exactly what Part 1's "NOT MAPPED" is telling you.

UPDATE dbo.uCfgM1FieldMap
SET    M1Column = NULL, Notes = N'unmapped pending Michael', ModifiedDate = GETDATE()
WHERE  MapID = <MapID>;
--------------------------------------------------------------------------- */
