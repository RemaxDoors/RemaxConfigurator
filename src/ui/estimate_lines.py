import pandas as pd
import streamlit as st
from st_aggrid import AgGrid, DataReturnMode, GridOptionsBuilder, JsCode

from services.data_mapping import money, percent
from services.quote_state import edit_line, open_new_line, delete_line, copy_line
from ui.configured_part_search import render_configured_part_search


def render_estimate_lines() -> None:
    with st.container(border=True):
        header_col, total_col = st.columns([4, 1], vertical_alignment="center")
        header_col.subheader("Line Items")

        lines = st.session_state.get("estimate_lines", [])
        if not lines:
            st.caption("No estimate lines added yet.")
        else:
            total_col.metric("Estimate Total", _estimate_total(lines))
            _render_line_grid(lines)

        action_col1, action_col2, action_col3 = st.columns([1, 1.2, 4], vertical_alignment="center")
        action_col1.button("+ New Line", type="primary", on_click=open_new_line, use_container_width=True)
        if action_col2.button("🔎 Search Parts", use_container_width=True):
            st.session_state["SHOW_CONFIGURED_PART_SEARCH"] = not st.session_state.get("SHOW_CONFIGURED_PART_SEARCH", False)

        if st.session_state.get("SHOW_CONFIGURED_PART_SEARCH", False):
            render_configured_part_search()


def _render_line_grid(lines: list[dict]) -> None:
    display_df = _line_grid_dataframe(lines)
    grid_options = _line_grid_options(display_df)

    grid_response = AgGrid(
        display_df,
        gridOptions=grid_options,
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
        height=280,
        key="ESTIMATE_LINES_GRID",
    )

    selected_line_number = _selected_line_number(grid_response)
    if selected_line_number is not None:
        st.session_state["SELECTED_ESTIMATE_LINE"] = selected_line_number

    event_name = grid_response.get("eventName")
    double_clicked_row = grid_response.get("data") or {}
    if event_name == "rowDoubleClicked" and double_clicked_row.get("Line"):
        edit_line(int(double_clicked_row["Line"]))
        st.rerun()

    selected_line_number = st.session_state.get("SELECTED_ESTIMATE_LINE")
    action_col1, action_col2, action_col3, action_col4 = st.columns([1, 1, 1, 3])
    action_col1.button(
        "✏️ Edit",
        disabled=selected_line_number is None,
        on_click=_edit_selected_line,
        use_container_width=True,
    )
    action_col2.button(
        "📋 Copy",
        disabled=selected_line_number is None,
        on_click=_copy_selected_line,
        help="Duplicate this line with identical configuration and pricing",
        use_container_width=True,
    )
    action_col3.button(
        "🗑️ Delete",
        disabled=selected_line_number is None,
        on_click=_delete_selected_line,
        use_container_width=True,
    )
    action_col4.caption("Click a row to select it · Double-click to open in configurator")


def _line_grid_dataframe(lines: list[dict]) -> pd.DataFrame:
    rows = []
    for line in lines:
        rows.append({
            "Line": int(line.get("Line") or 0),
            "Door Type": line.get("door_type", ""),
            "Part ID": line.get("part_id", line.get("door_model", "")),
            "Width": line.get("width", ""),
            "Height": line.get("height", ""),
            "Qty": line.get("Qty", ""),
            "Description": line.get("Part Description", ""),
            "Unit Sell": money(line.get("unit_sell_price")),
            "Unit Cost": money(line.get("unit_cost")),
            "Margin": percent(line.get("margin_percent")),
            "Total Sell": money(line.get("total_sell_price")),
        })

    return pd.DataFrame(rows)


def _line_grid_options(display_df: pd.DataFrame) -> dict:
    grid_builder = GridOptionsBuilder.from_dataframe(display_df)
    grid_builder.configure_selection("single", use_checkbox=False)
    grid_builder.configure_default_column(
        sortable=True,
        filter=True,
        resizable=True,
    )
    grid_builder.configure_column("Line", width=80)
    grid_builder.configure_column("Door Type", width=110)
    grid_builder.configure_column("Part ID", width=140)
    grid_builder.configure_column("Width", width=100)
    grid_builder.configure_column("Height", width=100)
    grid_builder.configure_column("Qty", width=80)
    grid_builder.configure_column("Description", minWidth=320, flex=2)
    grid_builder.configure_column("Unit Sell", width=130)
    grid_builder.configure_column("Unit Cost", width=130)
    grid_builder.configure_column("Margin", width=110)
    grid_builder.configure_column("Total Sell", width=140)
    grid_builder.configure_grid_options(
        rowSelection="single",
        suppressCellFocus=True,
        animateRows=True,
    )
    return grid_builder.build()


def _selected_line_number(grid_response) -> int | None:
    selected_rows = grid_response.get("selectedRows") or []
    if not selected_rows:
        return None

    return int(selected_rows[0]["Line"])


def _edit_selected_line() -> None:
    selected_line_number = st.session_state.get("SELECTED_ESTIMATE_LINE")
    if selected_line_number is None:
        return

    edit_line(int(selected_line_number))


def _copy_selected_line() -> None:
    selected_line_number = st.session_state.get("SELECTED_ESTIMATE_LINE")
    if selected_line_number is None:
        return
    copy_line(int(selected_line_number))


def _delete_selected_line() -> None:
    selected_line_number = st.session_state.get("SELECTED_ESTIMATE_LINE")
    if selected_line_number is None:
        return

    delete_line(int(selected_line_number))
    st.session_state["SELECTED_ESTIMATE_LINE"] = None


def _estimate_total(lines: list[dict]) -> str:
    total = sum(float(line.get("total_sell_price") or 0) for line in lines)
    return money(total)
