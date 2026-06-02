import streamlit as st


def _header_display_field(label: str, state_key: str) -> str:
    value = st.text_input(
        label,
        value=st.session_state.get(state_key, ""),
        disabled=True,
    )
    return value


def render_estimate_header() -> dict:
    st.title("Remax Configurator")

    with st.container(border=True):
        st.subheader("Estimate Details")

        col1, col2, col3 = st.columns(3)
        with col1:
            _header_display_field("Customer", "CUSTOMER_NAME")
            _header_display_field("Customer ID", "CUSTOMER_ID")

        with col2:
            _header_display_field("Ship Organisation", "SHIP_ORGANIZATION")
            _header_display_field("Ship Organisation ID", "SHIP_ORGANIZATION_ID")

        with col3:
            _header_display_field("Ship Location", "SHIP_LOCATION")
            _header_display_field("Ship Location ID", "SHIP_LOCATION_ID")

        detail_col1, detail_col2, detail_col3 = st.columns([2, 1, 1])
        with detail_col1:
            project_name = st.text_input("Project Name", key="PROJECT_NAME")
        with detail_col2:
            estimate_id = st.text_input("Estimate ID", key="ESTIMATE_ID")
        with detail_col3:
            revision = st.text_input("Revision", value="A", key="REVISION")

        if st.button("Search / Change Customer", key="SHOW_CUSTOMER_PICKER"):
            st.session_state["show_customer_picker"] = True
            st.rerun()

    return {
        "customer_id": st.session_state.get("CUSTOMER_ID", ""),
        "customer_name": st.session_state.get("CUSTOMER_NAME", ""),
        "ship_location_id": st.session_state.get("SHIP_LOCATION_ID", ""),
        "ship_organization_id": st.session_state.get("SHIP_ORGANIZATION_ID", ""),
        "estimate_id": estimate_id,
        "revision": revision,
        "project_name": project_name,
    }
