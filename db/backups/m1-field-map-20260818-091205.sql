/* uCfgM1FieldMap contents, saved 20260818-091205 before clearing it.

   The M1 write-back mapping Gizem built from the Settings screen:
   which app field goes into which M1 column, across Quotes, QuoteLines,
   QuoteQuantities and FormInputValues. Cleared because write-back is not
   being built yet; run this file to put it back.
   39 rows. */
SET NOCOUNT ON;
DELETE FROM dbo.uCfgM1FieldMap;

INSERT INTO dbo.uCfgM1FieldMap (Entity, AppField, M1Column, Constant, Notes) VALUES (N'formInput', N'controlName', N'xaiControlName', NULL, NULL);
INSERT INTO dbo.uCfgM1FieldMap (Entity, AppField, M1Column, Constant, Notes) VALUES (N'formInput', N'formId', N'xaiFormID', NULL, NULL);
INSERT INTO dbo.uCfgM1FieldMap (Entity, AppField, M1Column, Constant, Notes) VALUES (N'formInput', N'parentFormId', N'xaiParentFormID', NULL, NULL);
INSERT INTO dbo.uCfgM1FieldMap (Entity, AppField, M1Column, Constant, Notes) VALUES (N'formInput', N'sourceTable', N'xaiSourceTable', NULL, NULL);
INSERT INTO dbo.uCfgM1FieldMap (Entity, AppField, M1Column, Constant, Notes) VALUES (N'formInput', N'sourceUniqueId', N'xaiSourceUniqueID', NULL, NULL);
INSERT INTO dbo.uCfgM1FieldMap (Entity, AppField, M1Column, Constant, Notes) VALUES (N'formInput', N'topLevelFormId', N'xaiTopLevelFormID', NULL, NULL);
INSERT INTO dbo.uCfgM1FieldMap (Entity, AppField, M1Column, Constant, Notes) VALUES (N'formInput', N'value', N'xaiValue', NULL, NULL);
INSERT INTO dbo.uCfgM1FieldMap (Entity, AppField, M1Column, Constant, Notes) VALUES (N'quote', N'createdBy', N'qmpCreatedBy', NULL, NULL);
INSERT INTO dbo.uCfgM1FieldMap (Entity, AppField, M1Column, Constant, Notes) VALUES (N'quote', N'customerId', N'qmpCustomerOrganizationID', NULL, NULL);
INSERT INTO dbo.uCfgM1FieldMap (Entity, AppField, M1Column, Constant, Notes) VALUES (N'quote', N'marginPercent', N'uqmpMargin', NULL, NULL);
INSERT INTO dbo.uCfgM1FieldMap (Entity, AppField, M1Column, Constant, Notes) VALUES (N'quote', N'projectName', N'uqmpProjectName', NULL, NULL);
INSERT INTO dbo.uCfgM1FieldMap (Entity, AppField, M1Column, Constant, Notes) VALUES (N'quote', N'quoteDate', N'qmpQuoteDate', NULL, NULL);
INSERT INTO dbo.uCfgM1FieldMap (Entity, AppField, M1Column, Constant, Notes) VALUES (N'quote', N'quoteId', N'qmpQuoteID', NULL, NULL);
INSERT INTO dbo.uCfgM1FieldMap (Entity, AppField, M1Column, Constant, Notes) VALUES (N'quote', N'quoteType', N'uqmpQuoteType', NULL, NULL);
INSERT INTO dbo.uCfgM1FieldMap (Entity, AppField, M1Column, Constant, Notes) VALUES (N'quote', N'revision', N'uqmpRevision', NULL, NULL);
INSERT INTO dbo.uCfgM1FieldMap (Entity, AppField, M1Column, Constant, Notes) VALUES (N'quote', N'salesPerson', N'qmpQuoterEmployeeID', NULL, NULL);
INSERT INTO dbo.uCfgM1FieldMap (Entity, AppField, M1Column, Constant, Notes) VALUES (N'quote', N'shipToLocationId', N'qmpShipLocationID', NULL, NULL);
INSERT INTO dbo.uCfgM1FieldMap (Entity, AppField, M1Column, Constant, Notes) VALUES (N'quote', N'shipToOrgId', N'qmpShipOrganizationID', NULL, NULL);
INSERT INTO dbo.uCfgM1FieldMap (Entity, AppField, M1Column, Constant, Notes) VALUES (N'quoteLine', N'curtainSell', N'uqmlCurtainSell', NULL, NULL);
INSERT INTO dbo.uCfgM1FieldMap (Entity, AppField, M1Column, Constant, Notes) VALUES (N'quoteLine', N'doorModel', N'uqmlDoorModelID', NULL, NULL);
INSERT INTO dbo.uCfgM1FieldMap (Entity, AppField, M1Column, Constant, Notes) VALUES (N'quoteLine', N'partDescription', N'qmlPartShortDescription', NULL, NULL);
INSERT INTO dbo.uCfgM1FieldMap (Entity, AppField, M1Column, Constant, Notes) VALUES (N'quoteLine', N'partId', N'qmlPartID', NULL, NULL);
INSERT INTO dbo.uCfgM1FieldMap (Entity, AppField, M1Column, Constant, Notes) VALUES (N'quoteLine', N'partRevision', N'qmlPartRevisionID', NULL, NULL);
INSERT INTO dbo.uCfgM1FieldMap (Entity, AppField, M1Column, Constant, Notes) VALUES (N'quoteLine', N'quoteId', N'qmlQuoteID', NULL, NULL);
INSERT INTO dbo.uCfgM1FieldMap (Entity, AppField, M1Column, Constant, Notes) VALUES (N'quoteLine', N'quoteLineId', N'qmlQuoteLineID', NULL, NULL);
INSERT INTO dbo.uCfgM1FieldMap (Entity, AppField, M1Column, Constant, Notes) VALUES (N'quoteQuantity', N'assemblyUpgrades', N'uqmqAssUpgrades', NULL, NULL);
INSERT INTO dbo.uCfgM1FieldMap (Entity, AppField, M1Column, Constant, Notes) VALUES (N'quoteQuantity', N'doorSellPrice', N'uqmqDoorSellPrice', NULL, NULL);
INSERT INTO dbo.uCfgM1FieldMap (Entity, AppField, M1Column, Constant, Notes) VALUES (N'quoteQuantity', N'installSell', N'uqmqInstallSell', NULL, NULL);
INSERT INTO dbo.uCfgM1FieldMap (Entity, AppField, M1Column, Constant, Notes) VALUES (N'quoteQuantity', N'marginPercent', N'uqmqMargin', NULL, NULL);
INSERT INTO dbo.uCfgM1FieldMap (Entity, AppField, M1Column, Constant, Notes) VALUES (N'quoteQuantity', N'materialDiscounts', N'uqmqMatDiscounts', NULL, NULL);
INSERT INTO dbo.uCfgM1FieldMap (Entity, AppField, M1Column, Constant, Notes) VALUES (N'quoteQuantity', N'materialUpgrades', N'uqmqMatUpgrades', NULL, NULL);
INSERT INTO dbo.uCfgM1FieldMap (Entity, AppField, M1Column, Constant, Notes) VALUES (N'quoteQuantity', N'qty', N'qmqQuoteQuantity', NULL, NULL);
INSERT INTO dbo.uCfgM1FieldMap (Entity, AppField, M1Column, Constant, Notes) VALUES (N'quoteQuantity', N'quoteId', N'qmqQuoteID', NULL, NULL);
INSERT INTO dbo.uCfgM1FieldMap (Entity, AppField, M1Column, Constant, Notes) VALUES (N'quoteQuantity', N'quoteLineId', N'qmqQuoteLineID', NULL, NULL);
INSERT INTO dbo.uCfgM1FieldMap (Entity, AppField, M1Column, Constant, Notes) VALUES (N'quoteQuantity', N'resellerDiscount', N'uqmqResellerDiscount', NULL, NULL);
INSERT INTO dbo.uCfgM1FieldMap (Entity, AppField, M1Column, Constant, Notes) VALUES (N'quoteQuantity', N'totalCost', N'qmqTotalCost', NULL, NULL);
INSERT INTO dbo.uCfgM1FieldMap (Entity, AppField, M1Column, Constant, Notes) VALUES (N'quoteQuantity', N'totalPrice', N'qmqTotalPrice', NULL, NULL);
INSERT INTO dbo.uCfgM1FieldMap (Entity, AppField, M1Column, Constant, Notes) VALUES (N'quoteQuantity', N'totalUnitCost', N'qmqTotalUnitCost', NULL, NULL);
INSERT INTO dbo.uCfgM1FieldMap (Entity, AppField, M1Column, Constant, Notes) VALUES (N'quoteQuantity', N'totalUnitPrice', N'qmqTotalUnitPrice', NULL, NULL);

SELECT COUNT(*) AS Restored FROM dbo.uCfgM1FieldMap;
