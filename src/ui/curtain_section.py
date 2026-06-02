import pandas as pd
import streamlit as st

from services.movidor_door_config import movidor_control_names as door_control
from services.curtain_config import curtain_control_names as control
from services.curtain_config.curtain_defaults import apply_default_selections, calculate_es40_panels
from services.curtain_config.curtain_options import (
    M1_OPTIONS,
    get_window_location_options,
    get_window_row_options,
    get_window_type_options,
)
from services.curtain_config.curtain_pricing import (
    build_curtain_upgrade_summary,
    get_curtain_price_key,
)
from services.curtain_config.curtain_validation import validate_curtain_config
from services.data_mapping import get_value


def render_curtain_section(price_lookup=None) -> dict:
    door_model = str(st.session_state.get(door_control.CMBDOORMODEL, "") or "")
    door_height = float(st.session_state.get(door_control.NUMDOORHEIGHT, 0) or 0)
    door_width = float(st.session_state.get(door_control.NUMDOORWIDTH, 0) or 0)

    _apply_defaults_if_needed(door_model, door_height, door_width, price_lookup)
    _set_initial_dimension_values(door_height, door_width)
    _normalize_widget_state()

    with st.expander("Curtain Options", expanded=True):
        header_col1, header_col2, header_col3, header_col4 = st.columns(4)
        header_col1.text_input("Door Model", value=door_model, disabled=True, key="CURTAIN_DISPLAY_DOOR_MODEL")
        header_col2.text_input(
            "Track Config",
            value=str(st.session_state.get(door_control.CMBTRACKCONFIG, "") or ""),
            disabled=True,
            key="CURTAIN_DISPLAY_TRACK_CONFIG",
        )
        header_col3.text_input(
            "High Wind Track",
            value=str(st.session_state.get(door_control.CMBWINDTRACK, "") or ""),
            disabled=True,
            key="CURTAIN_DISPLAY_WIND_TRACK",
        )
        header_col4.text_input(
            "Price Table",
            value=get_curtain_price_key(door_model, st.session_state),
            disabled=True,
            key="CURTAIN_DISPLAY_PRICE_KEY",
        )

        size_col, window_col, option_col, alert_col = st.columns([1, 1.4, 1, 1.1], vertical_alignment="top")

        with size_col:
            st.markdown("##### Curtain Size")
            st.number_input("Finished Height Left", min_value=0.0, step=1.0, key=control.NUMCURTFINHL)
            st.number_input("Finished Height Right", min_value=0.0, step=1.0, key=control.NUMCURTFINHR)
            st.number_input("Finished Width", min_value=0.0, step=1.0, key=control.NUMCURTFINW)
            _selectbox("Floor Slope", control.CMBFLOORSLOPE, M1_OPTIONS[control.CMBFLOORSLOPE])
            st.number_input("Floor Slope Amount", min_value=0.0, step=1.0, key=control.NUMFLOORSLOPE)

        with window_col:
            st.markdown("##### Windows")
            _selectbox("Curtain Colour", control.CMBCURTAINCOLOUR, M1_OPTIONS[control.CMBCURTAINCOLOUR])
            _selectbox("Window Rows", control.CMBNUMWINDROWS, get_window_row_options(door_model))
            _selectbox("Default Window Type", control.CMBWINDOWTYPEDEFAULT, get_window_type_options(door_model))

            st.number_input("Default # of Windows", min_value=0, step=1, key=control.NUMWINDOWSDEFAULT)
            use_default_windows = st.checkbox("Use Default # Windows", key=control.CHKUSEDEFAULTWINPERROW)
            if use_default_windows:
                st.session_state[control.NUMWINDOWSREQ] = int(st.session_state.get(control.NUMWINDOWSDEFAULT, 0) or 0)
            st.number_input(
                "# of Windows Required Per Row",
                min_value=0,
                step=1,
                key=control.NUMWINDOWSREQ,
                disabled=use_default_windows,
            )
            _sync_extra_windows()
            st.number_input("Extra Windows", min_value=0, step=1, key=control.NUMEXTRAWINDOWS, disabled=True)

        with option_col:
            st.markdown("##### Add-ons")
            st.checkbox("Slope Edge Required", key=control.CHKSLOPEREQUIRED)
            st.checkbox("Custom Bottom Edge", key=control.CHKCUSTBOTTOMEDGE)
            st.checkbox("Custom Screen Printing", key=control.CHKCUSTSCREENPRINT)
            st.checkbox("Emergency Zip with 'Push Here' Graphic", key=control.CHKEMERGZIP)
            st.checkbox("Drip Edge Required", key=control.CHKDRIPEDGE)
            st.checkbox("Como Wear Strip", key=control.CHKCOMOWEAR)
            st.checkbox("EX BV Seal", key=control.CHKEX35BVSEAL)
            st.checkbox("HS25 Special", key=control.CHKHS25SPECIAL, disabled=True)

        curtain_values = {
            **_get_curtain_values(),
            door_control.CMBDOORMODEL: door_model,
            door_control.CMBWINDTRACK: st.session_state.get(door_control.CMBWINDTRACK, ""),
        }
        validation_result = validate_curtain_config({
            **curtain_values,
        })

        with alert_col:
            _render_curtain_alerts(validation_result)
            upgrade_summary = build_curtain_upgrade_summary(curtain_values)
            if upgrade_summary:
                st.markdown("##### Curtain Upgrades")
                st.dataframe(pd.DataFrame(upgrade_summary), use_container_width=True, hide_index=True)

        st.markdown("##### Window Row Details")
        _render_window_rows(door_model)

        # ── ES40 / BUGSTOP / CONCERTINA panel counts (must run after window rows) ──
        if door_model.upper() in {"ES40", "BUGSTOP", "CONCERTINA"}:
            _apply_panel_calculations(door_model, door_height, door_width)

        _render_priced_curtain_upgrades(price_lookup, curtain_values)

    return {
        "curtain_values": _get_curtain_values(),
        "validation_result": validation_result,
    }


def _apply_defaults_if_needed(door_model: str, door_height: float, door_width: float, price_lookup=None) -> None:
    """Reset window/colour defaults when door model or dimensions change."""
    signature = (door_model, door_height, door_width)
    if st.session_state.get("LAST_DEFAULT_CURTAIN_SIGNATURE") != signature:
        apply_default_selections(door_model, door_height, door_width)
        st.session_state["LAST_DEFAULT_CURTAIN_SIGNATURE"] = signature
        # Recalculate dimensions so correction factors are applied immediately
        _recalculate_dimensions(door_model, door_height, door_width, price_lookup)

    # Also recalculate whenever slope / track settings change (slope is set in
    # this section AFTER door config is saved, so they must re-trigger here)
    _recalculate_dimensions_if_slope_changed(door_model, door_height, door_width, price_lookup)


def _recalculate_dimensions(door_model: str, door_height: float, door_width: float, price_lookup) -> None:
    """Compute finished heights/width from DB correction factors and write to session state."""
    if price_lookup is None:
        # Fallback: no correction, use raw door dimensions
        st.session_state[control.NUMCURTFINHL] = door_height
        st.session_state[control.NUMCURTFINHR] = door_height
        st.session_state[control.NUMCURTFINW] = door_width
        return

    dims = price_lookup.get_finished_curtain_dimensions(
        door_model=door_model,
        selected_values=st.session_state,
    )
    st.session_state[control.NUMCURTFINHL] = dims["finished_height_left"]
    st.session_state[control.NUMCURTFINHR] = dims["finished_height_right"]
    st.session_state[control.NUMCURTFINW] = dims["finished_width"]
    st.session_state["NUMADJUSTEDWIDTH"]   = dims["adjusted_width"]


def _recalculate_dimensions_if_slope_changed(
    door_model: str,
    door_height: float,
    door_width: float,
    price_lookup,
) -> None:
    """
    Mirrors VB AdjustedDLO() + CalculateCurtainSize().

    Finished Height Left  = max(0, (door_height ± slope) + CurtainHeightCorrection)
    Finished Height Right = max(0, (door_height ± slope) + CurtainHeightCorrection)
    Finished Width        = max(0, (door_width  + track/wind correction) + CurtainWidthCorrection)

    Re-runs whenever slope, track config, or wind track changes so the curtain
    dimensions stay correct even after the user adjusts these in the curtain section.
    """
    slope_required = st.session_state.get(control.CHKSLOPEREQUIRED, False)
    floor_slope    = str(st.session_state.get(control.CMBFLOORSLOPE, "No Slope") or "No Slope")
    slope_amount   = float(st.session_state.get(control.NUMFLOORSLOPE, 0) or 0)
    track_config   = str(st.session_state.get(door_control.CMBTRACKCONFIG, "") or "")
    wind_track     = str(st.session_state.get(door_control.CMBWINDTRACK, "") or "")

    dim_signature = (
        door_model, door_height, door_width,
        slope_required, floor_slope, slope_amount,
        track_config, wind_track,
    )
    if st.session_state.get("LAST_CURTAIN_DIM_SIGNATURE") == dim_signature:
        return

    _recalculate_dimensions(door_model, door_height, door_width, price_lookup)
    st.session_state["LAST_CURTAIN_DIM_SIGNATURE"] = dim_signature


def _set_initial_dimension_values(door_height: float, door_width: float) -> None:
    st.session_state.setdefault(control.NUMCURTFINHL, door_height)
    st.session_state.setdefault(control.NUMCURTFINHR, door_height)
    st.session_state.setdefault(control.NUMCURTFINW, door_width)
    st.session_state.setdefault(control.NUMFLOORSLOPE, 0.0)
    st.session_state.setdefault(control.CMBFLOORSLOPE, "No Slope")
    st.session_state.setdefault(control.NUMEXTRAWINDOWS, 0)


def _normalize_widget_state() -> None:
    checkbox_names = [
        control.CHKSLOPEREQUIRED,
        control.CHKCUSTBOTTOMEDGE,
        control.CHKCUSTSCREENPRINT,
        control.CHKEMERGZIP,
        control.CHKDRIPEDGE,
        control.CHKCOMOWEAR,
        control.CHKEX35BVSEAL,
        control.CHKUSEDEFAULTWINPERROW,
        control.CHKHS25SPECIAL,
    ]
    integer_names = [
        control.NUMWINDOWSDEFAULT,
        control.NUMWINDOWSREQ,
        control.NUMEXTRAWINDOWS,
    ]
    decimal_names = [
        control.NUMCURTFINHL,
        control.NUMCURTFINHR,
        control.NUMCURTFINW,
        control.NUMFLOORSLOPE,
    ]

    for control_name in checkbox_names:
        value = st.session_state.get(control_name, False)
        st.session_state[control_name] = value is True or str(value).strip().lower() in {"1", "true", "yes"}

    for control_name in integer_names:
        value = st.session_state.get(control_name, 0)
        try:
            st.session_state[control_name] = int(float(value or 0))
        except (TypeError, ValueError):
            st.session_state[control_name] = 0

    for control_name in decimal_names:
        value = st.session_state.get(control_name, 0)
        try:
            st.session_state[control_name] = float(value or 0)
        except (TypeError, ValueError):
            st.session_state[control_name] = 0.0


def _apply_panel_calculations(door_model: str, door_height: float, door_width: float) -> None:
    """
    Calculates ES40/BUGSTOP/CONCERTINA panel counts and writes them to session state
    so the pricing lookup receives correct quantities.
    Mirrors VB ES40CalculatePanels().
    """
    # Finished curtain heights (already in session state after defaults/save)
    fin_hl = float(st.session_state.get(control.NUMCURTFINHL, door_height) or door_height)
    fin_hr = float(st.session_state.get(control.NUMCURTFINHR, door_height) or door_height)

    # Adjusted DLO heights (door height ± slope, no curtain correction)
    slope_required = st.session_state.get(control.CHKSLOPEREQUIRED, False)
    floor_slope    = str(st.session_state.get(control.CMBFLOORSLOPE, "No Slope") or "No Slope")
    slope_amount   = float(st.session_state.get(control.NUMFLOORSLOPE, 0) or 0)

    adj_left = adj_right = door_height
    if slope_required and slope_amount > 0 and floor_slope != "No Slope":
        if floor_slope == "Subtract from LHS (RHS Taller)":
            adj_left  = max(0.0, door_height - slope_amount)
        elif floor_slope == "Subtract from RHS (LHS Taller)":
            adj_right = max(0.0, door_height - slope_amount)
        elif floor_slope == "Add to LHS (LHS Taller)":
            adj_left  = door_height + slope_amount
        elif floor_slope == "Add to RHS (RHS Taller)":
            adj_right = door_height + slope_amount

    # Read current window row types from session state (set by the row widgets above)
    row_types = [
        str(st.session_state.get(name, "") or "")
        for name in control.WINDOW_ROW_TYPE_NAMES
    ]

    result = calculate_es40_panels(
        door_model=door_model,
        finished_height_left=fin_hl,
        finished_height_right=fin_hr,
        adjusted_height_left=adj_left,
        adjusted_height_right=adj_right,
        window_row_types=row_types,
    )

    st.session_state[control.NUMES40PANELSREQ]        = result["panels_req"]
    st.session_state[control.NUMES40PANELCOLOURED]     = result["panels_coloured"]
    st.session_state[control.NUMES40PANELSVISIONCLEAR] = result["panels_vision_clear"]
    st.session_state[control.NUMES40PANELSVISIONMESH]  = result["panels_vision_mesh"]
    st.session_state[control.NUMPANELHEIGHT]           = result["panel_height"]


def _render_window_rows(door_model: str) -> None:
    row_count = _visible_window_row_count()
    location_options = get_window_location_options(door_model)
    type_options = get_window_type_options(door_model)

    if row_count == 0:
        st.caption("No window rows selected.")
        return

    for row_start in range(0, row_count, 2):
        row_cols = st.columns(2)
        for offset, column in enumerate(row_cols):
            row_index = row_start + offset
            if row_index >= row_count:
                continue

            with column:
                st.markdown(f"Row {row_index + 1}")
                _selectbox(
                    "Location",
                    control.WINDOW_ROW_LOCATION_NAMES[row_index],
                    location_options,
                )
                _selectbox(
                    "Type",
                    control.WINDOW_ROW_TYPE_NAMES[row_index],
                    type_options,
                )


def _render_priced_curtain_upgrades(price_lookup, curtain_values: dict) -> None:
    if price_lookup is None:
        return

    priced_lines = price_lookup.get_priced_curtain_upgrade_lines(curtain_values)
    material_columns = [
        "Material Upgrade",
        "Material Part ID",
        "Material Revision",
        "Material Qty",
        "Material Price",
        "Material Cost",
    ]

    material_df = (
        pd.DataFrame(priced_lines)
        .reindex(columns=material_columns, fill_value="")
        .loc[lambda df: df["Material Part ID"].astype(str).str.strip() != ""]
    )

    if material_df.empty:
        return

    st.markdown("##### Priced Curtain Upgrades")
    st.dataframe(material_df, use_container_width=True, hide_index=True)


def _visible_window_row_count() -> int:
    row_count = str(st.session_state.get(control.CMBNUMWINDROWS, "") or "").strip()
    if row_count in {"", "No Window", "CUSTOM"}:
        return 0

    try:
        return max(0, min(14, int(row_count)))
    except ValueError:
        return 0


def _sync_extra_windows() -> None:
    row_count = _visible_window_row_count()
    windows_per_row = int(st.session_state.get(control.NUMWINDOWSREQ, 0) or 0)
    st.session_state[control.NUMEXTRAWINDOWS] = max(row_count - 1, 0) * windows_per_row


def _selectbox(label: str, control_name: str, options: list[dict[str, str]], key: str | None = None) -> str:
    values = [option["value"] for option in options]
    labels_by_value = {option["value"]: option.get("label", option["value"]) for option in options}
    current_value = st.session_state.get(control_name, values[0] if values else "")
    index = values.index(current_value) if current_value in values else 0

    widget_key = key or control_name
    selected_value = st.selectbox(
        label,
        options=values,
        index=index,
        key=widget_key,
        format_func=lambda value: labels_by_value.get(value, value),
    )
    if widget_key != control_name:
        st.session_state[control_name] = selected_value
    return selected_value


def _get_curtain_values() -> dict:
    return {
        control_name: get_value(st.session_state, control_name, "")
        for control_name in control.CURTAIN_CONTROL_NAMES
    }


def _render_curtain_alerts(validation_result: dict) -> None:
    errors = validation_result.get("errors", [])
    warnings = validation_result.get("warnings", [])

    if errors:
        st.error("Curtain has validation errors.")
        for error in errors:
            st.markdown(f"- {error['message']}")

    if warnings:
        st.warning("Curtain has warnings.")
        for warning in warnings:
            st.markdown(f"- {warning['message']}")

    if not errors and not warnings:
        st.success("Curtain checks look okay.")
