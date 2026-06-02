import pandas as pd
from sqlalchemy import text
from repositories.sql_service import get_engine
from services.movidor_door_config import movidor_control_names as door_control
from services.curtain_config import curtain_control_names as curtain_control
from services.curtain_config.curtain_pricing import get_curtain_price_key
from services.data_mapping import get_value, is_true, normalize_rule_values
from services.curtain_config.curtain_upgrade_rules import build_upgrade_columns as build_curtain_upgrade_columns
from services.installation_config.installation_rules import build_installation_lines
from services.movidor_door_config.movidor_upgrade_rules import build_upgrade_columns as build_movidor_upgrade_columns


class DoorPriceLookup:
    def __init__(self):
        self.engine = get_engine()

    def get_door_price(self, door_model: str, width: float, height: float) -> dict:
        query = text("""
            SELECT TOP 1
                uaeRetailPriceBase,
                uaeDoorCost
            FROM uSellPriceMatrixs
            WHERE uaeDoorModelID = :door_model
              AND uaeHeight >= :height
              AND uaeWidth >= :width
            ORDER BY uaeHeight ASC, uaeWidth ASC
        """)

        df = pd.read_sql(
            query,
            self.engine,
            params={
                "door_model": door_model,
                "height": height,
                "width": width,
            },
        )

        if df.empty:
            return {
                "sell_price": 0.0,
                "door_cost": 0.0,
            }

        row = df.iloc[0]

        return {
            "sell_price": float(row["uaeRetailPriceBase"] or 0),
            "door_cost": float(row["uaeDoorCost"] or 0),
        }

    def get_door_sell_price(self, door_model: str, width: float, height: float) -> float:
        return self.get_door_price(
            door_model=door_model,
            width=width,
            height=height,
        )["sell_price"]

    def get_finished_curtain_dimensions(self, door_model: str, selected_values: dict) -> dict:
        return self._calculate_finished_curtain_dimensions(
            door_model=door_model,
            selected_values=selected_values,
        )

    def get_curtain_price(self, selected_values: dict) -> dict:
        door_model = str(get_value(selected_values, door_control.CMBDOORMODEL, "") or "").strip()
        curtain_model = get_curtain_price_key(door_model, selected_values)
        dimensions = self._calculate_finished_curtain_dimensions(
            door_model=door_model,
            selected_values=selected_values,
        )
        drop = max(dimensions["finished_height_left"], dimensions["finished_height_right"])
        width = dimensions["finished_width"]

        if curtain_model == "ES40":
            return self._with_dimensions(
                self._get_es40_curtain_price(curtain_model, width, selected_values),
                dimensions,
            )

        if curtain_model == "CONCERTINA":
            return self._with_dimensions(
                self._get_concertina_curtain_price(curtain_model, width, selected_values),
                dimensions,
            )

        price_component = None
        if (
            is_true(selected_values, curtain_control.CHKEMERGZIP)
            and curtain_model == "EX35"
        ):
            price_component = "ALDI D07 with Zip"

        curtain_price = self._get_curtain_component_price(
            door_model=curtain_model,
            drop=drop,
            width=width,
            price_component=price_component,
        )
        components = [
            {
                "component": price_component or "Curtain",
                "quantity": 1,
                "unit_price": curtain_price,
                "extended_price": curtain_price,
            }
        ] if curtain_price else []
        total_curtain_price = sum(component["extended_price"] for component in components)

        return self._with_dimensions({
            "curtain_model": curtain_model,
            "curtain_sell_price": total_curtain_price,
            "curtain_cost": total_curtain_price,
            "components": components,
        }, dimensions)

    def get_upgrade_sell_cost_price(
        self,
        part_id: str,
        part_revision: str | None,
    ) -> dict:
        part_revision = "" if part_revision in {None, "None"} else part_revision
        query = text("""
            SELECT TOP 1
                imhPartID,
                imhPartRevisionID,
                imrShortDescription,
                (
                    COALESCE(imrAverageDutyCost, 0)
                    + COALESCE(imrAverageFreightCost, 0)
                    + COALESCE(imrAverageLaborCost, 0)
                    + COALESCE(imrAverageMaterialCost, 0)
                    + COALESCE(imrAverageMiscCost, 0)
                    + COALESCE(imrAverageSubcontractCost, 0)
                    + COALESCE(imrAverageOverheadCost, 0)
                ) AS TotalUnitCost,
                imhUnitSalePrice
            FROM PartUnitSalePrices
            LEFT JOIN Parts
                ON impPartID = imhPartID
            LEFT JOIN PartRevisions
                ON imhPartID = imrPartID
               AND imhPartRevisionID = imrPartRevisionID
            WHERE (imhEndDate IS NULL OR imhEndDate = '')
              AND imhPartID = :part_id
              AND COALESCE(imhPartRevisionID, '') = :part_revision
        """)

        df = pd.read_sql(
            query,
            self.engine,
            params={
                "part_id": part_id,
                "part_revision": part_revision,
                },
        )

        if df.empty:
            return {
                "part_id": part_id,
                "revision_id": part_revision,
                "description": "",
                "sell_price": 0.0,
                "upgrade_cost": 0.0,
            }

        row = df.iloc[0]

        return {
            "part_id": row["imhPartID"],
            "revision_id": row["imhPartRevisionID"],
            "description": row["imrShortDescription"],
            "sell_price": float(row["imhUnitSalePrice"] or 0),
            "upgrade_cost": float(row["TotalUnitCost"] or 0),
        }

    def get_priced_upgrade_lines(self, selected_values: dict) -> list[dict]:
        priced_lines = []

        normalized_values = normalize_rule_values(selected_values)
        upgrade_rows = build_movidor_upgrade_columns(
            normalized_values,
            part_prices={},
        )
        upgrade_rows.extend(build_curtain_upgrade_columns(
            normalized_values,
            part_prices={},
        ))

        for upgrade_row in upgrade_rows:
            priced_lines.append(self._price_upgrade_grid_row(upgrade_row))

        return priced_lines

    def get_priced_curtain_upgrade_lines(self, selected_values: dict) -> list[dict]:
        normalized_values = normalize_rule_values(selected_values)
        upgrade_rows = build_curtain_upgrade_columns(
            normalized_values,
            part_prices={},
        )

        return [
            self._price_upgrade_grid_row(upgrade_row)
            for upgrade_row in upgrade_rows
        ]

    def get_priced_installation_lines(self, selected_values: dict) -> list[dict]:
        normalized_values = normalize_rule_values(selected_values)
        installation_rows = build_installation_lines(normalized_values)
        priced_lines = []

        for installation_row in installation_rows:
            manual_cost = float(installation_row.get("manual_cost", 0) or 0)
            part_id = installation_row.get("part_id", "")
            quantity = float(installation_row.get("quantity", 1) or 1)

            if part_id:
                part_price = self.get_upgrade_sell_cost_price(
                    part_id=part_id,
                    part_revision=installation_row.get("revision", ""),
                )
                unit_price = part_price["sell_price"]
                unit_cost = part_price["upgrade_cost"]
                description = part_price["description"] or installation_row.get("label", part_id)
            else:
                unit_price = manual_cost
                unit_cost = manual_cost
                description = installation_row.get("label", "")

            priced_lines.append({
                "Installation Item": description,
                "Part ID": part_id,
                "Revision": installation_row.get("revision", ""),
                "Operation": installation_row.get("operation", ""),
                "Qty": quantity,
                "Unit Price": unit_price,
                "Unit Cost": unit_cost,
                "Extended Price": unit_price * quantity,
                "Extended Cost": unit_cost * quantity,
            })

        return priced_lines

    def _get_curtain_component_price(
        self,
        door_model: str,
        drop: float,
        width: float,
        price_component: str | None = None,
    ) -> float:
        component_filter = ""
        params = {
            "door_model": door_model,
            "drop": drop,
            "width": width,
        }

        if price_component is not None:
            component_filter = "AND ucpPriceComponentID = :price_component"
            params["price_component"] = price_component

        query = text(f"""
            SELECT TOP 1
                ISNULL(ucpUnitPrice, 0) AS UnitPrice
            FROM uCurtainPrices
            WHERE ucpDoorModelID = :door_model
              AND ucpDrop >= :drop
              AND ucpWidth >= :width
              {component_filter}
            ORDER BY ucpUnitPrice ASC
        """)

        df = pd.read_sql(query, self.engine, params=params)
        if df.empty:
            return 0.0

        return float(df.iloc[0]["UnitPrice"] or 0)

    def _calculate_finished_curtain_dimensions(self, door_model: str, selected_values: dict) -> dict:
        formula_model = "ES40" if str(door_model or "").strip().upper() == "BUGSTOP" else str(door_model or "").strip().upper()
        door_height = self._to_float(get_value(selected_values, door_control.NUMDOORHEIGHT, 0))
        door_width = self._to_float(get_value(selected_values, door_control.NUMDOORWIDTH, 0))
        floor_slope_amount = self._to_float(get_value(selected_values, curtain_control.NUMFLOORSLOPE, 0))
        floor_slope = str(get_value(selected_values, curtain_control.CMBFLOORSLOPE, "No Slope") or "")
        slope_required = is_true(selected_values, curtain_control.CHKSLOPEREQUIRED)
        track_config = str(get_value(selected_values, door_control.CMBTRACKCONFIG, "") or "")
        wind_track = str(get_value(selected_values, door_control.CMBWINDTRACK, "") or "")

        adjusted_height_left = door_height
        adjusted_height_right = door_height

        if slope_required and floor_slope_amount > 0 and floor_slope != "No Slope":
            if floor_slope == "Subtract from LHS (RHS Taller)":
                adjusted_height_left = max(0, door_height - floor_slope_amount)
            elif floor_slope == "Subtract from RHS (LHS Taller)":
                adjusted_height_right = max(0, door_height - floor_slope_amount)
            elif floor_slope == "Add to LHS (LHS Taller)":
                adjusted_height_left = door_height + floor_slope_amount
            elif floor_slope == "Add to RHS (RHS Taller)":
                adjusted_height_right = door_height + floor_slope_amount

        adjusted_width = door_width
        concealed_correction = 0.0
        high_wind_correction = 0.0

        if track_config == "Concealed":
            if formula_model in {"EX35", "EX45"}:
                concealed_correction = 50
            elif formula_model in {"MOVIFOLD", "CONCERTINA"}:
                concealed_correction = 0
            else:
                concealed_correction = 170

            adjusted_width = door_width + concealed_correction

            if wind_track == "Yes":
                high_wind_correction = 260
                adjusted_width = door_width + high_wind_correction

        curtain_height_correction = (
            self._get_rapid_formula_correction(formula_model, "Curtain Height")
            + self._growing_height_correction(formula_model, door_height)
        )
        curtain_width_correction = self._get_rapid_formula_correction(formula_model, "Curtain Width")

        return {
            "adjusted_height_left": adjusted_height_left,
            "adjusted_height_right": adjusted_height_right,
            "adjusted_width": adjusted_width,
            "curtain_height_correction": curtain_height_correction,
            "curtain_width_correction": curtain_width_correction,
            "concealed_correction": concealed_correction,
            "high_wind_correction": high_wind_correction,
            "finished_height_left": max(0, adjusted_height_left + curtain_height_correction),
            "finished_height_right": max(0, adjusted_height_right + curtain_height_correction),
            "finished_width": max(0, adjusted_width + curtain_width_correction),
        }

    def _get_rapid_formula_correction(self, door_model: str, descriptor: str) -> float:
        query = text("""
            SELECT TOP 1
                ISNULL(urfCorr, 0) AS CorrectionValue
            FROM uRapidFormulas
            WHERE urfDoorModelID = :door_model
              AND urfDesc = :descriptor
            ORDER BY urfDoorModelID DESC, urfRapidFormulaID DESC
        """)

        df = pd.read_sql(
            query,
            self.engine,
            params={
                "door_model": door_model,
                "descriptor": descriptor,
            },
        )
        if df.empty:
            return 0.0

        return float(df.iloc[0]["CorrectionValue"] or 0)

    def _growing_height_correction(self, door_model: str, door_height: float) -> float:
        if door_model == "MOVIFOLD":
            if 5000 < door_height <= 6000:
                return 75
            if 6000 < door_height <= 7000:
                return 150
            if 7000 < door_height <= 8000:
                return 225
            if 8000 < door_height <= 9000:
                return 300

        if door_model == "CONCERTINA":
            if 5000 < door_height <= 6000:
                return 55
            if 6000 < door_height <= 7000:
                return 110
            if 7000 < door_height <= 8000:
                return 165
            if 8000 < door_height <= 9000:
                return 220
            if 9000 < door_height <= 10000:
                return 275

        return 0.0

    def _with_dimensions(self, curtain_price: dict, dimensions: dict) -> dict:
        return {
            **curtain_price,
            "curtain_dimensions": dimensions,
        }

    def _get_es40_curtain_price(self, curtain_model: str, width: float, selected_values: dict) -> dict:
        drop = 10
        bottom_edge = self._get_curtain_component_price(curtain_model, drop, width, "Bottom Edge")
        coloured_unit = self._get_curtain_component_price(curtain_model, drop, width, "Coloured Panel")
        clear_unit = self._get_curtain_component_price(curtain_model, drop, width, "Clear Panel")

        coloured_qty = self._to_float(get_value(selected_values, curtain_control.NUMES40PANELCOLOURED, 0))
        clear_qty = self._to_float(get_value(selected_values, curtain_control.NUMES40PANELSVISIONCLEAR, 0))
        mesh_qty = self._to_float(get_value(selected_values, curtain_control.NUMES40PANELSVISIONMESH, 0))

        components = [
            _curtain_component("Bottom Edge", 1, bottom_edge),
            _curtain_component("Coloured Panel", coloured_qty, coloured_unit),
            _curtain_component("Vision Clear Panel", clear_qty, clear_unit),
            _curtain_component("Vision Mesh Panel", mesh_qty, clear_unit),
        ]
        curtain_price = sum(component["extended_price"] for component in components)

        return {
            "curtain_model": curtain_model,
            "curtain_sell_price": curtain_price,
            "curtain_cost": curtain_price,
            "components": components,
        }

    def _get_concertina_curtain_price(self, curtain_model: str, width: float, selected_values: dict) -> dict:
        bottom_edge = self._get_curtain_component_price(curtain_model, 10, width, "Bottom Edge")
        panel_drop = self._to_float(get_value(selected_values, "NUMPANELHEIGHT", 0))
        if panel_drop == 0:
            panel_drop = max(
                self._to_float(get_value(selected_values, curtain_control.NUMCURTFINHL, 0)),
                self._to_float(get_value(selected_values, curtain_control.NUMCURTFINHR, 0)),
            )

        coloured_unit = self._get_curtain_component_price(curtain_model, panel_drop, width, "Coloured Panel")
        coloured_qty = self._to_float(get_value(selected_values, curtain_control.NUMES40PANELCOLOURED, 0))
        clear_qty = self._to_float(get_value(selected_values, curtain_control.NUMES40PANELSVISIONCLEAR, 0))
        mesh_qty = self._to_float(get_value(selected_values, curtain_control.NUMES40PANELSVISIONMESH, 0))
        windows_per_panel = self._to_float(get_value(selected_values, curtain_control.NUMWINDOWSREQ, 0))

        components = [
            _curtain_component("Bottom Edge", 1, bottom_edge),
            _curtain_component("Coloured Panel", coloured_qty * 2, coloured_unit),
            {
                "component": "Vision Clear Panel",
                "quantity": clear_qty * 2,
                "unit_price": coloured_unit,
                "extended_price": ((clear_qty * coloured_unit) + (clear_qty * windows_per_panel * 26)) * 2,
            },
            {
                "component": "Vision Mesh Panel",
                "quantity": mesh_qty * 2,
                "unit_price": coloured_unit,
                "extended_price": ((mesh_qty * coloured_unit) + (mesh_qty * windows_per_panel * 26)) * 2,
            },
        ]
        curtain_price = sum(component["extended_price"] for component in components)

        return {
            "curtain_model": curtain_model,
            "curtain_sell_price": curtain_price,
            "curtain_cost": curtain_price,
            "components": components,
        }

    def _price_upgrade_grid_row(self, upgrade_row: dict) -> dict:
        priced_row = upgrade_row.copy()

        assembly_price = self._get_grid_part_price(
            part_id=upgrade_row.get("Assembly Part ID"),
            revision=upgrade_row.get("Assembly Revision"),
            quantity=upgrade_row.get("Assembly Qty"),
        )
        material_price = self._get_grid_part_price(
            part_id=upgrade_row.get("Material Part ID"),
            revision=upgrade_row.get("Material Revision"),
            quantity=upgrade_row.get("Material Qty"),
        )
        material_discount = self._get_grid_part_price(
            part_id=upgrade_row.get("Material Discount Part ID"),
            revision=upgrade_row.get("Material Discount Revision"),
            quantity=upgrade_row.get("Material Discount Qty"),
        )

        priced_row.update({
            "Assembly Upgrade": assembly_price["description"] or upgrade_row.get("Assembly Upgrade", ""),
            "Assembly Price": assembly_price["extended_sell_price"],
            "Assembly Cost": assembly_price["extended_upgrade_cost"],
            "Material Upgrade": material_price["description"] or upgrade_row.get("Material Upgrade", ""),
            "Material Price": material_price["extended_sell_price"],
            "Material Cost": material_price["extended_upgrade_cost"],
            "Material Discount": material_discount["description"] or upgrade_row.get("Material Discount", ""),
            "Material Discount Price": material_discount["extended_sell_price"],
            "Material Discount Cost": material_discount["extended_upgrade_cost"],
            "assembly_sell_price": assembly_price["extended_sell_price"],
            "assembly_cost": assembly_price["extended_upgrade_cost"],
            "material_sell_price": material_price["extended_sell_price"],
            "material_cost": material_price["extended_upgrade_cost"],
            "material_discount_sell_price": material_discount["extended_sell_price"],
            "material_discount_cost": material_discount["extended_upgrade_cost"],
        })

        return priced_row

    def _get_grid_part_price(
        self,
        part_id: str | None,
        revision: str | None,
        quantity: float | str | None,
    ) -> dict:
        if not part_id:
            return {
                "description": "",
                "extended_sell_price": 0.0,
                "extended_upgrade_cost": 0.0,
            }

        part_price = self.get_upgrade_sell_cost_price(
            part_id=str(part_id),
            part_revision=revision,
        )
        quantity = float(quantity or 1)

        return {
            "description": part_price["description"] or str(part_id),
            "extended_sell_price": part_price["sell_price"] * quantity,
            "extended_upgrade_cost": part_price["upgrade_cost"] * quantity,
        }

    def get_price_breakdown(
        self,
        door_model: str,
        width: float,
        height: float,
        qty: int,
        selected_values: dict | None = None,
    ) -> dict:
        door_price = self.get_door_price(
            door_model=door_model,
            width=width,
            height=height,
        )
        base_door_sell_price = door_price["sell_price"]
        base_door_cost = door_price["door_cost"]

        selected_values = selected_values or {}
        curtain_price = self.get_curtain_price({
            **selected_values,
            door_control.CMBDOORMODEL: door_model,
            door_control.NUMDOORWIDTH: width,
            door_control.NUMDOORHEIGHT: height,
        })
        upgrade_lines = self.get_priced_upgrade_lines(selected_values)
        assembly_sell_price = sum(
            line["assembly_sell_price"]
            for line in upgrade_lines
        )
        assembly_cost = sum(
            line["assembly_cost"]
            for line in upgrade_lines
        )
        material_sell_price = sum(
            line["material_sell_price"]
            for line in upgrade_lines
        )
        material_cost = sum(
            line["material_cost"]
            for line in upgrade_lines
        )
        material_discount_sell_price = sum(
            line["material_discount_sell_price"]
            for line in upgrade_lines
        )
        material_discount_cost = sum(
            line["material_discount_cost"]
            for line in upgrade_lines
        )
        upgrade_sell_price = (
            assembly_sell_price
            + material_sell_price
            - material_discount_sell_price
        )
        upgrade_cost = (
            assembly_cost
            + material_cost
            - material_discount_cost
        )
        unit_sell_price = base_door_sell_price + upgrade_sell_price
        unit_cost = base_door_cost + upgrade_cost
        total_sell_price = unit_sell_price * qty
        total_cost = unit_cost * qty
        margin_value = unit_sell_price - unit_cost
        margin_percent = margin_value / unit_sell_price if unit_sell_price else 0.0

        return {
            "qty": qty,
            "base_door_sell_price": base_door_sell_price,
            "base_door_cost": base_door_cost,
            "curtain_model": curtain_price["curtain_model"],
            "curtain_sell_price": curtain_price["curtain_sell_price"],
            "curtain_cost": curtain_price["curtain_cost"],
            "curtain_components": curtain_price["components"],
            "curtain_dimensions": curtain_price.get("curtain_dimensions", {}),
            "upgrade_sell_price": upgrade_sell_price,
            "upgrade_cost": upgrade_cost,
            "assembly_sell_price": assembly_sell_price,
            "assembly_cost": assembly_cost,
            "material_sell_price": material_sell_price,
            "material_cost": material_cost,
            "material_discount_sell_price": material_discount_sell_price,
            "material_discount_cost": material_discount_cost,
            "unit_sell_price": unit_sell_price,
            "unit_cost": unit_cost,
            "total_sell_price": total_sell_price,
            "total_cost": total_cost,
            "margin_value": margin_value,
            "margin_percent": margin_percent,
            "upgrade_lines": upgrade_lines,
        }

    def _to_float(self, value) -> float:
        try:
            return float(value or 0)
        except (TypeError, ValueError):
            return 0.0


def _curtain_component(component: str, quantity: float, unit_price: float) -> dict:
    return {
        "component": component,
        "quantity": quantity,
        "unit_price": unit_price,
        "extended_price": quantity * unit_price,
    }
