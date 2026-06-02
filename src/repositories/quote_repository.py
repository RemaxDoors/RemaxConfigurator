import pandas as pd
from sqlalchemy import text
from repositories.sql_service import get_engine


_RRD_PART_IDS = """
    'RRD-ES40','RRD-HS35','RRD-EX35','RRD-HS50',
    'RRD-HS50-THERMIC','RRD-EX45','RRD-CONCERTINA',
    'RRD-MOVIFOLD','RRD-MOVICHILL','RRD-HS35-THERMIC',
    'RRD-HS65','RRD-HS25','RRD-BUGSTOP',
    'RRD-MOVICHILL-XL','RRD-MS40-THERMIC'
"""


def search_records(search_text: str) -> pd.DataFrame:
    wildcard_term = f"%{search_text}%"
    engine = get_engine()

    query = text(f"""
        -- Quotes leg
        SELECT
            'Quote'                             AS SOURCE,
            CAST(qmlQuoteID AS VARCHAR(50))     AS RECORD_ID,
            CAST(qmlQuoteLineID AS VARCHAR(50)) AS LINE_ID,
            QL.uqmlDoorModelID,
            qmpQuoteDate                        AS RECORD_DATE,
            O.cmoname                           AS CUSTOMERNAME,
            S.cmoName                           AS SHIPCUSTOMERNAME,
            qmlPartID                           AS PARTID,
            qmlPartShortDescription             AS PARTDESCRIPTION,
            qmqQuoteQuantity                    AS QTY,
            qmqRevisedUnitPriceBase             AS UNITSELLPRICE,
            qmqUnitDiscountBase                 AS DISCOUNT,
            uqmqResellerDiscount                AS RESELLERDISCOUNT,
            qmqTotalUnitCost,
            uqmqMargin
        FROM QuoteLines AS QL
        LEFT JOIN QUOTES Q
            ON Q.qmpQuoteID = QL.qmlQuoteID
        LEFT JOIN Organizations O
            ON O.cmoOrganizationID = Q.qmpCustomerOrganizationID
        LEFT JOIN Organizations S
            ON S.cmoOrganizationID = Q.qmpShipOrganizationID
        LEFT JOIN QuoteQuantities AS QQ
            ON QL.qmlQuoteID = QQ.qmqQuoteID
           AND QL.qmlQuoteLineID = QQ.qmqQuoteLineID
        WHERE
            (
                CAST(O.cmoname              AS VARCHAR(200)) LIKE :term
                OR CAST(S.cmoName           AS VARCHAR(200)) LIKE :term
                OR CAST(qmlQuoteID          AS VARCHAR(50))  LIKE :term
                OR CAST(qmlQuoteLineID      AS VARCHAR(50))  LIKE :term
                OR CAST(qmlPartID           AS VARCHAR(50))  LIKE :term
                OR CAST(qmlPartShortDescription AS VARCHAR(200)) LIKE :term
            )
            AND qmlPartID IN ({_RRD_PART_IDS})
            AND qmqTotalUnitCost IS NOT NULL

        UNION ALL

        -- Sales Orders leg
        SELECT
            'SalesOrder'                            AS SOURCE,
            CAST(SL.omlSalesOrderID AS VARCHAR(50)) AS RECORD_ID,
            CAST(SL.omlSalesOrderLineID AS VARCHAR(50)) AS LINE_ID,
            QL.uqmlDoorModelID,
            SO.ompOrderDate                         AS RECORD_DATE,
            O.cmoname                               AS CUSTOMERNAME,
            S.cmoName                               AS SHIPCUSTOMERNAME,
            SL.omlPartID                            AS PARTID,
            SL.omlPartShortDescription              AS PARTDESCRIPTION,
            QQ.qmqQuoteQuantity                     AS QTY,
            QQ.qmqRevisedUnitPriceBase              AS UNITSELLPRICE,
            QQ.qmqUnitDiscountBase                  AS DISCOUNT,
            QQ.uqmqResellerDiscount                 AS RESELLERDISCOUNT,
            QQ.qmqTotalUnitCost,
            QQ.uqmqMargin
        FROM SalesOrderLines AS SL
        INNER JOIN QuoteLines AS QL
            ON QL.qmlQuoteID = SL.omlQuoteID
           AND QL.qmlQuoteLineID = SL.omlQuoteLineID
        LEFT JOIN SalesOrders AS SO
            ON SO.ompSalesOrderID = SL.omlSalesOrderID
        LEFT JOIN Organizations O
            ON O.cmoOrganizationID = SO.ompCustomerOrganizationID
        LEFT JOIN Organizations S
            ON S.cmoOrganizationID = SO.ompShipOrganizationID
        LEFT JOIN QuoteQuantities AS QQ
            ON QQ.qmqQuoteID = QL.qmlQuoteID
           AND QQ.qmqQuoteLineID = QL.qmlQuoteLineID
        WHERE
            (
                CAST(O.cmoname              AS VARCHAR(200)) LIKE :term
                OR CAST(S.cmoName           AS VARCHAR(200)) LIKE :term
                OR CAST(SL.omlSalesOrderID  AS VARCHAR(50))  LIKE :term
                OR CAST(SL.omlSalesOrderLineID AS VARCHAR(50)) LIKE :term
                OR CAST(SL.omlPartID        AS VARCHAR(50))  LIKE :term
                OR CAST(SL.omlPartShortDescription AS VARCHAR(200)) LIKE :term
            )
            AND SL.omlPartID IN ({_RRD_PART_IDS})
            AND QQ.qmqTotalUnitCost IS NOT NULL

        ORDER BY RECORD_DATE DESC
    """)

    with engine.connect() as conn:
        df = pd.read_sql(query, conn, params={"term": wildcard_term})

    return df


def load_record_controls(
    record_id: int | str,
    line_id: int | str,
    part_id: str | None = None,
) -> pd.DataFrame:
    """
    Load saved control values from uTraining_SalesPricingView for a quote or sales order line.
    Works for both sources — the view's Unique_ID is '{record_id}-{line_id}' in both cases.
    """
    engine = get_engine()
    unique_id = f"{record_id}-{line_id}"

    query = text("""
        SELECT
            [Unique_ID]
      ,[Part-ID]
      ,[DoorModelID]
      ,[DoorSellPrice]
      ,[LastRunDate]
      ,[xaiControlName]
      ,[xaiValue]
      ,[UNIT SELL PRICE]
      ,[QTY]
      ,[Material Upgrades]
      ,[Install Sell]
      ,[Material Discounts]
      ,[Assembly Upgrades]
        FROM [uTraining_SalesPricingView]
        WHERE [Unique_ID] = :unique_id
          AND (:part_id IS NULL OR [Part-ID] = :part_id)
        ORDER BY [xaiControlName]
    """)

    with engine.connect() as conn:
        df = pd.read_sql(
            query,
            conn,
            params={
                "unique_id": unique_id,
                "part_id": part_id,
            }
        )

    return df