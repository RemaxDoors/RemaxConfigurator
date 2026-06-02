import streamlit as st

from repositories.customer_repository import get_ship_locations, search_customers
from services.data_mapping import selected_grid_row


def render_customer_picker() -> None:
    if not st.session_state.get("show_customer_picker", False):
        return

    with st.container(border=True):
        top_left, top_right = st.columns([5, 1], vertical_alignment="center")
        top_left.subheader("Search / Change Customer")
        if top_right.button("Close", key="CLOSE_CUSTOMER_PICKER"):
            st.session_state["show_customer_picker"] = False
            st.rerun()

        customer_tab, ship_tab, location_tab = st.tabs([
            "Customer",
            "Ship Organisation",
            "Ship Location",
        ])

        with customer_tab:
            _render_customer_search()

        with ship_tab:
            _render_ship_organisation_search()

        with location_tab:
            _render_ship_location_picker()


def _render_customer_search() -> None:
    search_text = st.text_input("Search Customer Name / ID", key="CUSTOMER_SEARCH")

    if len(search_text.strip()) < 3:
        st.caption("Enter at least 3 characters.")
        return

    customers_df = search_customers(search_text)
    if customers_df.empty:
        st.caption("No matching customers found.")
        return

    selected_customer = selected_grid_row(
        customers_df[["cmoOrganizationID", "cmoname"]],
        key="CUSTOMER_SEARCH_GRID",
    )
    if selected_customer and st.button("Use Customer", key="USE_CUSTOMER"):
        st.session_state["CUSTOMER_ID"] = str(selected_customer["cmoOrganizationID"])
        st.session_state["CUSTOMER_NAME"] = str(selected_customer["cmoname"])
        st.rerun()


def _render_ship_organisation_search() -> None:
    search_text = st.text_input(
        "Search Ship Organisation Name / ID",
        key="SHIP_ORGANIZATION_SEARCH",
    )

    if len(search_text.strip()) < 3:
        st.caption("Enter at least 3 characters.")
        return

    organisations_df = search_customers(search_text)
    if organisations_df.empty:
        st.caption("No matching ship organisations found.")
        return

    selected_organisation = selected_grid_row(
        organisations_df[["cmoOrganizationID", "cmoname"]],
        key="SHIP_ORGANIZATION_SEARCH_GRID",
    )
    if selected_organisation and st.button("Use Ship Organisation", key="USE_SHIP_ORGANIZATION"):
        st.session_state["SHIP_ORGANIZATION_ID"] = str(
            selected_organisation["cmoOrganizationID"]
        )
        st.session_state["SHIP_ORGANIZATION"] = str(selected_organisation["cmoname"])
        st.session_state["SHIP_LOCATION_ID"] = ""
        st.session_state["SHIP_LOCATION"] = ""
        st.rerun()


def _render_ship_location_picker() -> None:
    ship_organisation_id = st.session_state.get("SHIP_ORGANIZATION_ID", "").strip()

    if not ship_organisation_id:
        st.caption("Select or enter a ship organisation first.")
        return

    locations_df = get_ship_locations(ship_organisation_id)
    if locations_df.empty:
        st.caption("No ship locations found for this organisation.")
        return

    selected_location_index = st.selectbox(
        "Ship Location",
        options=locations_df.index.tolist(),
        format_func=lambda index: (
            f"{locations_df.loc[index, 'cmlLocationID']} - "
            f"{locations_df.loc[index, 'cmlName']}"
        ),
        key="SELECT_SHIP_LOCATION",
    )
    selected_location = locations_df.loc[selected_location_index]

    if st.button("Use Ship Location", key="USE_SHIP_LOCATION"):
        st.session_state["SHIP_LOCATION_ID"] = str(selected_location["cmlLocationID"])
        st.session_state["SHIP_LOCATION"] = str(selected_location["cmlName"])
        st.rerun()
