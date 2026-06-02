import pandas as pd
import streamlit as st
from st_aggrid import AgGrid, GridOptionsBuilder, GridUpdateMode

from repositories.customer_repository import get_ship_locations, search_customers


def _selected_grid_row(df: pd.DataFrame, key: str) -> dict | None:
    grid_builder = GridOptionsBuilder.from_dataframe(df)
    grid_builder.configure_selection("single", use_checkbox=True)
    grid_builder.configure_grid_options(domLayout="normal")

    grid_response = AgGrid(
        df,
        gridOptions=grid_builder.build(),
        update_mode=GridUpdateMode.SELECTION_CHANGED,
        fit_columns_on_grid_load=True,
        height=220,
        key=key,
    )

    selected_rows = grid_response.get("selected_rows", [])
    if selected_rows is None or len(selected_rows) == 0:
        return None

    if isinstance(selected_rows, pd.DataFrame):
        return selected_rows.iloc[0].to_dict()

    return selected_rows[0]


def _render_header_status() -> None:
    customer_name = st.session_state.get("CUSTOMER_NAME", "")
    ship_organization = st.session_state.get("SHIP_ORGANIZATION", "")
    ship_location = st.session_state.get("SHIP_LOCATION", "")

    status_cols = st.columns(3)
    status_cols[0].caption("Customer")
    status_cols[0].success(customer_name or "Not selected")
    status_cols[1].caption("Ship Organization")
    status_cols[1].success(ship_organization or "Not selected")
    status_cols[2].caption("Ship Location")
    status_cols[2].success(ship_location or "Not selected")


def init_estimate_state() -> None:
    st.session_state.setdefault("estimate_lines", [])
    st.session_state.setdefault("estimate_mode", "header")
    st.session_state.setdefault("active_line_number", None)


def open_new_line() -> None:
    st.session_state["estimate_mode"] = "configurator"
    st.session_state["active_line_number"] = len(st.session_state["estimate_lines"]) + 1


def close_configurator() -> None:
    st.session_state["estimate_mode"] = "header"
    st.session_state["active_line_number"] = None


def render_estimate_header() -> dict:
    st.title("Remax Configurator")

    _render_header_status()

    with st.container(border=True):
        st.subheader("Estimate Header")
        row1_col1, row1_col2, row1_col3 = st.columns(3)
        with row1_col1:
            _render_customer_fields()

        with row1_col2:
            _render_ship_organization_fields()

        with row1_col3:
            _render_ship_location_fields()

        row2_col1, row2_col2, row2_col3 = st.columns([1, 1, 2])
        with row2_col1:
            estimate_id = st.text_input("Estimate ID", key="ESTIMATE_ID")
        with row2_col2:
            revision = st.text_input("Revision", value="A", key="REVISION")
        with row2_col3:
            project_name = st.text_input("Project Name", key="PROJECT_NAME")

    return {
        "customer_id": st.session_state.get("CUSTOMER_ID", ""),
        "customer_name": st.session_state.get("CUSTOMER_NAME", ""),
        "ship_location_id": st.session_state.get("SHIP_LOCATION_ID", ""),
        "ship_organization_id": st.session_state.get("SHIP_ORGANIZATION_ID", ""),
        "estimate_id": estimate_id,
        "revision": revision,
        "project_name": project_name,
    }


def render_estimate_lines() -> None:
    left, right = st.columns([1, 4], vertical_alignment="bottom")

    with left:
        st.button("Add Line", type="primary", on_click=open_new_line)

    lines = st.session_state["estimate_lines"]
    if not lines:
        st.caption("No estimate lines added yet.")
        return

    lines_df = pd.DataFrame(lines)
    display_columns = [
        "Line",
        "door_model",
        "Qty",
        "Part Description",
        "base_door_sell_price",
        "base_door_cost",
        "upgrade_sell_price",
        "upgrade_cost",
        "unit_sell_price",
        "unit_cost",
        "discount_percent",
        "margin_percent",
        "total_sell_price",
        "total_cost",
    ]
    display_df = lines_df.reindex(columns=display_columns, fill_value="")
    st.dataframe(display_df, use_container_width=True, hide_index=True)

    subtotal = pd.to_numeric(display_df["total_sell_price"], errors="coerce").fillna(0).sum()
    right.metric("Estimate Total", f"${subtotal:,.2f}")


def save_active_line(
    door_result: dict,
    price_breakdown: dict,
    discounted_unit_sell_price: float,
    discounted_total_sell_price: float,
    reseller_discount: float,
) -> None:
    line_number = st.session_state.get("active_line_number")
    if line_number is None:
        line_number = len(st.session_state["estimate_lines"]) + 1

    line = {
        "Line": line_number,
        "door_model": door_result["door_model_value"],
        "width": door_result["NUMDOORWIDTH"],
        "height": door_result["NUMDOORHEIGHT"],
        "Qty": price_breakdown["qty"],
        "Part Description": (
            f"Movidor {door_result['door_model_value']} "
            f"{door_result['NUMDOORHEIGHT']}H x {door_result['NUMDOORWIDTH']}W"
        ),
        "base_door_sell_price": price_breakdown["base_door_sell_price"],
        "base_door_cost": price_breakdown["base_door_cost"],
        "upgrade_sell_price": price_breakdown["upgrade_sell_price"],
        "upgrade_cost": price_breakdown["upgrade_cost"],
        "unit_sell_price": price_breakdown["unit_sell_price"],
        "unit_cost": price_breakdown["unit_cost"],
        "discount_percent": reseller_discount,
        "discounted_unit_sell_price": discounted_unit_sell_price,
        "total_cost": price_breakdown["total_cost"],
        "margin_value": discounted_unit_sell_price - price_breakdown["unit_cost"],
        "margin_percent": (
            (discounted_unit_sell_price - price_breakdown["unit_cost"]) / discounted_unit_sell_price
            if discounted_unit_sell_price
            else 0.0
        ),
        "total_sell_price": discounted_total_sell_price,
        "controls": door_result["door_controls_values"],
        "upgrade_lines": price_breakdown.get("upgrade_lines", []),
    }

    st.session_state["estimate_lines"].append(line)
    close_configurator()


def _render_customer_fields() -> None:
    st.markdown("##### Customer")
    customer_search = st.text_input(
        "Search Customer Name / ID",
        key="CUSTOMER_SEARCH",
    )

    if len(customer_search.strip()) >= 3:
        customers_df = search_customers(customer_search)

        if customers_df.empty:
            st.caption("No matching customers found.")
        else:
            selected_customer = _selected_grid_row(
                customers_df[["cmoOrganizationID", "cmoname"]],
                key="CUSTOMER_SEARCH_GRID",
            )
            if selected_customer and st.button("Load Customer Info", key="LOAD_CUSTOMER"):
                st.session_state["CUSTOMER_ID"] = str(selected_customer["cmoOrganizationID"])
                st.session_state["CUSTOMER_NAME"] = str(selected_customer["cmoname"])
                st.rerun()
            else:
                st.caption("Select a customer and click 'Load Customer Info' to populate the fields.")

    st.text_input("Customer ID", key="CUSTOMER_ID")
    st.text_input("Customer Name", key="CUSTOMER_NAME")


def _render_ship_organization_fields() -> None:
    st.markdown("##### Ship Organization")
    ship_organization_search = st.text_input(
        "Search Ship Organization",
        key="SHIP_ORGANIZATION_SEARCH",
    )
    if len(ship_organization_search.strip()) >= 3:
        ship_organizations_df = search_customers(ship_organization_search)

        if ship_organizations_df.empty:
            st.caption("No matching ship organizations found.")
        else:
            selected_organization = _selected_grid_row(
                ship_organizations_df[["cmoOrganizationID", "cmoname"]],
                key="SHIP_ORGANIZATION_SEARCH_GRID",
            )
            if selected_organization and st.button("Load Ship Organization Info", key="LOAD_SHIP_ORGANIZATION"):
                st.session_state["SHIP_ORGANIZATION_ID"] = str(
                    selected_organization["cmoOrganizationID"]
                )
                st.session_state["SHIP_ORGANIZATION"] = str(
                    selected_organization["cmoname"]
                )
                st.session_state["SHIP_LOCATION_ID"] = ""
                st.session_state["SHIP_LOCATION"] = ""
                st.rerun()
            else:
                st.caption(
                    "Select a ship organization and click 'Load Ship Organization Info' "
                    "to populate the fields."
                )

    st.text_input("Ship Organization ID", key="SHIP_ORGANIZATION_ID")
    st.text_input("Ship Organization", key="SHIP_ORGANIZATION")


def _render_ship_location_fields() -> None:
    st.markdown("##### Ship Location")
    ship_organization_id = st.session_state.get("SHIP_ORGANIZATION_ID", "").strip()

    if not ship_organization_id:
        st.caption("Select or enter a ship organization to show locations.")
    else:
        ship_locations_df = get_ship_locations(ship_organization_id)

        if ship_locations_df.empty:
            st.caption("No ship locations found for this organization.")
        else:
            selected_location_index = st.selectbox(
                "Ship Location",
                options=ship_locations_df.index.tolist(),
                format_func=lambda index: (
                    f"{ship_locations_df.loc[index, 'cmlLocationID']} - "
                    f"{ship_locations_df.loc[index, 'cmlName']}"
                ),
                key="SELECT_SHIP_LOCATION",
            )
            selected_location = ship_locations_df.loc[selected_location_index]
            if st.button("Load Ship Location Info", key="LOAD_SHIP_LOCATION"):
                st.session_state["SHIP_LOCATION_ID"] = str(
                    selected_location["cmlLocationID"]
                )
                st.session_state["SHIP_LOCATION"] = str(
                    selected_location["cmlName"]
                )
                st.rerun()
            else:
                st.caption("Select a ship location and click 'Load Ship Location Info'.")

    st.text_input("Ship Location ID", key="SHIP_LOCATION_ID")
    st.text_input("Ship Location", key="SHIP_LOCATION")
