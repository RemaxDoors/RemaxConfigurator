import streamlit as st


def prefill_from_hubspot(data: dict) -> None:
    st.session_state["CUSTOMER_ID"] = data.get("customer_id", "")
    st.session_state["CUSTOMER_NAME"] = data.get("customer_name", "")
    st.session_state["SHIP_ORGANIZATION_ID"] = data.get("ship_organization_id", "")
    st.session_state["SHIP_ORGANIZATION"] = data.get("ship_organization", "")
    st.session_state["SHIP_LOCATION_ID"] = data.get("ship_location_id", "")
    st.session_state["SHIP_LOCATION"] = data.get("ship_location", "")
    st.session_state["PROJECT_NAME"] = data.get("project_name", "")
