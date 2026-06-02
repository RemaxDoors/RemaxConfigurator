import pandas as pd
import streamlit as st
from st_aggrid import AgGrid, DataReturnMode, GridOptionsBuilder, JsCode

from repositories.quote_repository import load_record_controls, search_records
from services.configuration_loader import apply_loaded_config_to_session, pivot_controls
from services.quote_state import open_new_line


def render_configured_part_search() -> None:
    with st.container(border=True):
        st.subheader("Search Old Configured Parts")
        search_col, button_col = st.columns([4, 1], vertical_alignment="bottom")

        with search_col:
            search_text = st.text_input(
                "Search by quote, customer, part, or description",
                key="OLD_CONFIG_SEARCH_TEXT",
            )
        with button_col:
            if st.button("Search", key="BTN_SEARCH_OLD_CONFIG", use_container_width=True):
                if not search_text.strip():
                    st.warning("Enter a search value.")
                else:
                    st.session_state["search_results"] = search_records(search_text)

        results_df = st.session_state.get("search_results", pd.DataFrame())
        if results_df.empty:
            return

        st.markdown("#### Search Results")
        st.caption("Double-click a row to load that configured part.")
        grid_response = _render_search_grid(results_df)
        event_name = grid_response.get("eventName")
        double_clicked_row = grid_response.get("data") or {}
        if event_name == "rowDoubleClicked" and double_clicked_row:
            selected_row = _selected_result_row(results_df, double_clicked_row)
            if selected_row is not None:
                _load_configured_part(selected_row)


def _render_search_grid(results_df: pd.DataFrame) -> dict:
    display_df = results_df.reset_index().rename(columns={"index": "_search_index"})
    grid_options = GridOptionsBuilder.from_dataframe(display_df)
    grid_options.configure_selection("single", use_checkbox=False)
    grid_options.configure_default_column(sortable=True, filter=True, resizable=True)
    grid_options.configure_column("_search_index", hide=True)
    grid_options.configure_grid_options(
        rowSelection="single",
        suppressCellFocus=True,
        animateRows=True,
    )

    return AgGrid(
        display_df,
        gridOptions=grid_options.build(),
        data_return_mode=DataReturnMode.CUSTOM,
        custom_jscode_for_grid_return=JsCode("""
            function({streamlitRerunEventTriggerName, eventData}) {
                return {
                    eventName: streamlitRerunEventTriggerName,
                    data: eventData && eventData.data ? eventData.data : null,
                    selectedRows: eventData && eventData.api ? eventData.api.getSelectedRows() : []
                };
            }
        """),
        update_on=["rowDoubleClicked", "selectionChanged"],
        allow_unsafe_jscode=True,
        fit_columns_on_grid_load=True,
        height=320,
        key="OLD_CONFIG_SEARCH_GRID",
    )


def _selected_result_row(results_df: pd.DataFrame, grid_row: dict) -> pd.Series | None:
    row_index = grid_row.get("_search_index")
    if row_index is None:
        return None

    try:
        return results_df.loc[int(row_index)]
    except (KeyError, TypeError, ValueError):
        return None


def _load_configured_part(selected_row: pd.Series) -> None:
    try:
        controls_df = load_record_controls(
            record_id=selected_row["RECORD_ID"],
            line_id=selected_row["LINE_ID"],
            part_id=str(selected_row["PARTID"]),
        )
    except Exception as error:
        st.error(f"Failed to load configurator controls: {error}")
        return

    st.session_state["loaded_controls_raw"] = controls_df
    if controls_df.empty:
        st.warning("No configurator controls found for this record.")
        return

    pivot_df = pivot_controls(controls_df)
    st.session_state["loaded_controls_pivot"] = pivot_df
    apply_loaded_config_to_session(pivot_df)
    open_new_line()
    _set_loaded_line_context(selected_row)
    st.success("Configurator values loaded into a new estimate line.")
    st.rerun()


def _set_loaded_line_context(selected_row: pd.Series) -> None:
    part_id = str(selected_row.get("PARTID", "") or "").strip().upper()
    door_model = str(selected_row.get("uqmlDoorModelID", "") or st.session_state.get("CMBDOORMODEL", "") or "").strip().upper()
    door_type = part_id.split("-", 1)[0] if "-" in part_id else "RRD"

    if door_type == "RRD":
        config_id = "RRD-MOVIDOR-TEMPLATE"
    elif door_type == "STRIPDOOR":
        config_id = "STRIPDOOR-TEMPLATE"
    elif door_type == "SWI":
        config_id = "SWI-THERMAL-TEMPLATE" if ("4500" in door_model or "5000" in door_model) else "SWI-PVC-TEMPLATE"
    elif door_type == "ENTURI":
        config_id = "RMX-ENTURI-TEMPLATE"
    else:
        config_id = ""

    st.session_state["LINE_DOOR_TYPE"] = door_type
    st.session_state["LINE_DOOR_MODEL"] = door_model
    st.session_state["LINE_PART_ID"] = part_id
    st.session_state["LINE_CONFIG_ID"] = config_id
    st.session_state["LINE_CONFIGURED"] = bool(config_id)
    st.session_state["DOOR_CONFIG_SAVED"] = bool(config_id)
