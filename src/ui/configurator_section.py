import pandas as pd
import streamlit as st

from repositories.pricing_lookup import DoorPriceLookup
from services.quote_state import close_configurator, save_active_line
from services.data_mapping import mapped_select, money, percent
from services.curtain_config import curtain_control_names as curtain_control
from services.curtain_config.curtain_defaults import apply_default_selections as apply_curtain_defaults
from services.installation_config import installation_control_names as install_control
from services.movidor_door_config import movidor_control_names as door_control
from services.movidor_door_config.movidor_option_registery import M1_OPTIONS
from ui.curtain_section import render_curtain_section
from ui.door_section import render_door_section
from ui.installation_section import render_installation_section


DOOR_TYPE_OPTIONS = ("", "SWI", "RRD", "ENTURI", "STRIPDOOR")

DOOR_TYPE_MODELS = {
    "SWI": ("2400", "3000", "4500", "5000"),
    "RRD": tuple(
        option["value"]
        for option in M1_OPTIONS.get(door_control.CMBDOORMODEL, [])
        if option.get("value")
    ),
    "ENTURI": ("ENTURI",),
    "STRIPDOOR": ("STRIPDOOR",),
}


def _configuration_name(door_type: str, door_model: str) -> str:
    door_type = str(door_type or "").strip().upper()
    door_model = str(door_model or "").strip().upper()

    if door_type == "RRD":
        return "RRD-MOVIDOR-TEMPLATE"
    if door_type == "STRIPDOOR":
        return "STRIPDOOR-TEMPLATE"
    if door_type == "SWI":
        if "4500" in door_model or "5000" in door_model:
            return "SWI-THERMAL-TEMPLATE"
        return "SWI-PVC-TEMPLATE"
    if door_type == "ENTURI":
        return "RMX-ENTURI-TEMPLATE"
    return ""


def _part_id(door_type: str, door_model: str) -> str:
    door_type = str(door_type or "").strip().upper()
    door_model = str(door_model or "").strip().upper()

    if not door_type or not door_model:
        return ""
    if door_type == "STRIPDOOR":
        return "STRIPDOOR"
    return f"{door_type}-{door_model}"


def _model_options(door_type: str) -> list[str]:
    return ["", *DOOR_TYPE_MODELS.get(str(door_type or "").strip().upper(), ())]


def _configure_selected_line() -> None:
    door_type = st.session_state.get("LINE_DOOR_TYPE", "")
    door_model = st.session_state.get("LINE_DOOR_MODEL", "")
    part_id = _part_id(door_type, door_model)
    config_id = _configuration_name(door_type, door_model)

    st.session_state["LINE_PART_ID"] = part_id
    st.session_state["LINE_CONFIG_ID"] = config_id
    # Keep display fields in sync so st.text_input renders the updated values
    st.session_state["LINE_PART_ID_DISPLAY"] = part_id
    st.session_state["LINE_CONFIG_ID_DISPLAY"] = config_id
    st.session_state["LINE_CONFIGURED"] = bool(door_type and door_model and config_id)
    st.session_state["DOOR_CONFIG_SAVED"] = False
    st.session_state[install_control.CMBCONFIGID] = config_id
    # Force installation defaults to reapply with the new config
    st.session_state["LAST_DEFAULT_INSTALLATION_SIGNATURE"] = None

    if door_type == "RRD":
        st.session_state[door_control.CMBDOORMODEL] = door_model
        if st.session_state.get("LAST_DEFAULT_DOOR_MODEL") != door_model:
            st.session_state["LAST_DEFAULT_DOOR_MODEL"] = None
            st.session_state["LAST_DEFAULT_CURTAIN_SIGNATURE"] = None


def _render_configurator_selector() -> dict:
    st.markdown("### Configure Line")
    selector = st.container(border=True)

    with selector:
        selected_door_type = st.session_state.get("LINE_DOOR_TYPE", "")
        if selected_door_type not in DOOR_TYPE_OPTIONS:
            selected_door_type = ""

        col1, col2, col3, col4, col5 = st.columns([1, 1.4, 1.2, 1.8, 0.9], vertical_alignment="bottom")

        with col1:
            door_type = st.selectbox(
                "Door Type",
                DOOR_TYPE_OPTIONS,
                index=DOOR_TYPE_OPTIONS.index(selected_door_type),
                key="LINE_DOOR_TYPE",
            )

        model_options = _model_options(door_type)
        selected_model = st.session_state.get("LINE_DOOR_MODEL", "")
        if selected_model not in model_options:
            selected_model = ""
            st.session_state["LINE_DOOR_MODEL"] = ""

        with col2:
            door_model = st.selectbox(
                "Door Model",
                model_options,
                index=model_options.index(selected_model),
                key="LINE_DOOR_MODEL",
            )

        part_id = _part_id(door_type, door_model)
        config_id = _configuration_name(door_type, door_model)

        with col3:
            st.text_input("Part ID", value=part_id, disabled=True, key="LINE_PART_ID_DISPLAY")
        with col4:
            st.text_input("Configurator Name", value=config_id, disabled=True, key="LINE_CONFIG_ID_DISPLAY")
        with col5:
            st.button(
                "Configure",
                type="primary",
                on_click=_configure_selected_line,
                disabled=not bool(door_type and door_model and config_id),
                use_container_width=True,
            )

    configured_part_id = st.session_state.get("LINE_PART_ID", part_id)
    configured_config_id = st.session_state.get("LINE_CONFIG_ID", config_id)
    is_configured = (
        bool(st.session_state.get("LINE_CONFIGURED", False))
        and configured_part_id == part_id
        and configured_config_id == config_id
    )

    return {
        "door_type": st.session_state.get("LINE_DOOR_TYPE", ""),
        "door_model": st.session_state.get("LINE_DOOR_MODEL", ""),
        "part_id": configured_part_id,
        "config_id": configured_config_id,
        "is_configured": is_configured,
    }


def _save_door_config() -> None:
    door_model = str(st.session_state.get(door_control.CMBDOORMODEL, "") or "")
    door_height = float(st.session_state.get(door_control.NUMDOORHEIGHT, 0) or 0)
    door_width = float(st.session_state.get(door_control.NUMDOORWIDTH, 0) or 0)
    curtain_dimensions = DoorPriceLookup().get_finished_curtain_dimensions(
        door_model=door_model,
        selected_values=st.session_state,
    )
    finished_height_left = float(curtain_dimensions.get("finished_height_left", door_height) or door_height)
    finished_height_right = float(curtain_dimensions.get("finished_height_right", door_height) or door_height)
    finished_width = float(curtain_dimensions.get("finished_width", door_width) or door_width)

    apply_curtain_defaults(door_model, door_height, finished_width)
    st.session_state[curtain_control.NUMCURTFINHL] = finished_height_left
    st.session_state[curtain_control.NUMCURTFINHR] = finished_height_right
    st.session_state[curtain_control.NUMCURTFINW] = finished_width
    st.session_state["NUMADJUSTEDWIDTH"] = float(curtain_dimensions.get("adjusted_width", door_width) or door_width)
    st.session_state["LAST_DEFAULT_CURTAIN_SIGNATURE"] = (door_model, door_height, door_width)
    st.session_state["DOOR_CONFIG_SAVED"] = True


def _toggle_detail(detail_key: str) -> None:
    st.session_state[detail_key] = not st.session_state.get(detail_key, False)


def _readonly_amount(label: str, value: float, key: str) -> None:
    st.number_input(
        label,
        value=float(value or 0),
        format="%.2f",
        key=key,
        disabled=True,
    )


def _compact_dataframe(dataframe: pd.DataFrame) -> None:
    row_count = max(len(dataframe), 1)
    st.dataframe(
        dataframe,
        use_container_width=True,
        hide_index=True,
        height=min(260, 38 + row_count * 35),
    )


def _render_sidebar_price_summary(
    discounted_unit_sell_price: float,
    final_unit_cost: float,
    final_margin_value: float,
    final_margin_percent: float,
    discounted_total_sell_price: float,
    qty: int,
) -> None:
    with st.sidebar:
        st.markdown("### 💰 Price Summary")
        st.metric("Unit Sell", money(discounted_unit_sell_price))
        st.metric("Unit Cost", money(final_unit_cost))
        st.metric(
            "Margin",
            percent(final_margin_percent),
            delta=money(final_margin_value),
        )
        st.divider()
        st.metric("Qty", qty)
        st.metric("Total Sell", money(discounted_total_sell_price))


def _render_price_summary(
    price_breakdown: dict,
    misc_extra_price: float,
    misc_extra_cost: float,
    installation_site_price: float,
    installation_site_cost: float,
    reseller_discount: float,
    discount_amount: float,
    discounted_unit_sell_price: float,
    discounted_total_sell_price: float,
    final_unit_cost: float,
    final_total_cost: float,
    final_margin_value: float,
    final_margin_percent: float,
) -> None:
    st.markdown("#### Price Summary")

    summary_col1, summary_col2, summary_col3 = st.columns(3)

    summary_col1.metric("Total Unit Sell", money(discounted_unit_sell_price))
    summary_col2.metric("Total Unit Cost", money(final_unit_cost))
    summary_col3.metric("Margin", percent(final_margin_percent), money(final_margin_value))

    st.caption(
        "Unit sell = discounted door/upgrades + installation/site sell + misc extras. "
        "Installation/site is not affected by reseller discount."
    )

    rows = [
        ("Door Sell Price", money(price_breakdown["base_door_sell_price"]), "door_sell"),
        ("Door Cost", money(price_breakdown["base_door_cost"]), "door"),
        ("Material Upgrade", money(price_breakdown["material_sell_price"]), "material"),
        ("Material Discount", money(-price_breakdown["material_discount_sell_price"]), "material_discount"),
        ("Assembly Upgrades", money(price_breakdown["assembly_sell_price"]), "assembly"),
        ("Reseller Discount", f"{reseller_discount:.2f}% / {money(discount_amount)}", "reseller_discount"),
        ("Misc Extra Price (p/door)", money(misc_extra_price), "misc_price"),
        ("Misc Extra Cost (p/door)", money(misc_extra_cost), "misc_cost"),
        ("Installation/Site", money(installation_site_price), "installation"),
        ("Total Sell Price", money(discounted_total_sell_price), "total"),
    ]

    summary_left, _ = st.columns([1, 1], vertical_alignment="top")
    with summary_left:
        with st.container(border=True):
            for row_start in range(0, len(rows), 3):
                row_cols = st.columns(3, vertical_alignment="center")
                for offset, column in enumerate(row_cols):
                    row_index = row_start + offset
                    if row_index >= len(rows):
                        continue

                    label, value, detail_key = rows[row_index]
                    with column:
                        label_col, button_col = st.columns([4, 1], vertical_alignment="center")
                        label_col.caption(label)
                        if button_col.button("🔎", key=f"PRICE_DETAIL_{detail_key}", help=f"Show {label} breakdown"):
                            st.session_state["PRICE_DETAIL_PANEL"] = detail_key
                        st.markdown(f"**{value}**")


def _render_selected_price_detail(
    price_breakdown: dict,
    installation_lines: list[dict],
    misc_extra_price: float,
    misc_extra_cost: float,
    misc_extra_description: str,
    reseller_discount: float,
    discount_amount: float,
    discounted_unit_sell_price: float,
    discounted_total_sell_price: float,
    final_unit_cost: float,
    final_total_cost: float,
) -> None:
    detail_key = st.session_state.get("PRICE_DETAIL_PANEL")
    if not detail_key:
        return

    st.markdown("#### Breakdown")

    if detail_key == "door_sell":
        _compact_dataframe(pd.DataFrame([{
            "Door Sell Price": price_breakdown["base_door_sell_price"],
        }]))
    elif detail_key == "door":
        _compact_dataframe(pd.DataFrame([{
            "Door Sell": price_breakdown["base_door_sell_price"],
            "Door Cost": price_breakdown["base_door_cost"],
        }]))
    elif detail_key == "material":
        _render_upgrade_detail(price_breakdown.get("upgrade_lines", []), "material")
    elif detail_key == "material_discount":
        _render_upgrade_detail(price_breakdown.get("upgrade_lines", []), "material_discount")
    elif detail_key == "assembly":
        _render_upgrade_detail(price_breakdown.get("upgrade_lines", []), "assembly")
    elif detail_key == "reseller_discount":
        _compact_dataframe(pd.DataFrame([{
            "Reseller Discount": f"{reseller_discount:.2f}%",
            "Discount Amount Per Door": discount_amount,
        }]))
    elif detail_key in {"misc_price", "misc_cost"}:
        _compact_dataframe(pd.DataFrame([{
            "Misc Extra Price (p/door)": misc_extra_price,
            "Misc Extra Cost (p/door)": misc_extra_cost,
            "Description": misc_extra_description,
        }]))
    elif detail_key == "installation":
        _render_installation_breakdown(installation_lines)
    elif detail_key == "total":
        _compact_dataframe(pd.DataFrame([{
            "Unit Sell": discounted_unit_sell_price,
            "Unit Cost": final_unit_cost,
            "Total Sell": discounted_total_sell_price,
            "Total Cost": final_total_cost,
        }]))


def _render_upgrade_detail(upgrade_lines: list[dict], detail_type: str) -> None:
    if not upgrade_lines:
        st.caption("No upgrade rows.")
        return

    upgrades_df = pd.DataFrame(upgrade_lines)
    if detail_type == "assembly":
        columns = [
            "Assembly Upgrade",
            "Assembly Part ID",
            "Assembly Revision",
            "Assembly Qty",
            "Assembly Price",
            "Assembly Cost",
        ]
        id_column = "Assembly Part ID"
    elif detail_type == "material":
        columns = [
            "Material Upgrade",
            "Material Part ID",
            "Material Revision",
            "Material Qty",
            "Material Price",
            "Material Cost",
        ]
        id_column = "Material Part ID"
    else:
        columns = [
            "Material Discount",
            "Material Discount Part ID",
            "Material Discount Revision",
            "Material Discount Qty",
            "Material Discount Price",
            "Material Discount Cost",
        ]
        id_column = "Material Discount Part ID"

    detail_df = (
        upgrades_df
        .reindex(columns=columns, fill_value="")
        .loc[lambda df: df[id_column].astype(str).str.strip() != ""]
    )

    if detail_df.empty:
        st.caption("No rows for this component.")
    else:
        _compact_dataframe(detail_df)


def _render_upgrade_breakdowns(upgrade_lines: list[dict]) -> None:
    if not upgrade_lines:
        st.caption("No upgrades selected.")
        return

    upgrades_df = pd.DataFrame(upgrade_lines)

    assembly_columns = [
        "Assembly Upgrade",
        "Assembly Part ID",
        "Assembly Revision",
        "Assembly Qty",
        "Assembly Price",
        "Assembly Cost",
    ]
    material_columns = [
        "Material Upgrade",
        "Material Part ID",
        "Material Revision",
        "Material Qty",
        "Material Price",
        "Material Cost",
    ]
    material_discount_columns = [
        "Material Discount",
        "Material Discount Part ID",
        "Material Discount Revision",
        "Material Discount Qty",
        "Material Discount Price",
        "Material Discount Cost",
    ]

    assembly_df = (
        upgrades_df
        .reindex(columns=assembly_columns, fill_value="")
        .loc[lambda df: df["Assembly Part ID"].astype(str).str.strip() != ""]
    )
    material_df = (
        upgrades_df
        .reindex(columns=material_columns, fill_value="")
        .loc[lambda df: df["Material Part ID"].astype(str).str.strip() != ""]
    )
    material_discount_df = (
        upgrades_df
        .reindex(columns=material_discount_columns, fill_value="")
        .loc[lambda df: df["Material Discount Part ID"].astype(str).str.strip() != ""]
    )

    with st.expander("Assembly Upgrades", expanded=not assembly_df.empty):
        if assembly_df.empty:
            st.caption("No assembly upgrades selected.")
        else:
            st.dataframe(assembly_df, use_container_width=True, hide_index=True)

    with st.expander("Material Upgrades", expanded=not material_df.empty):
        if material_df.empty:
            st.caption("No material upgrades selected.")
        else:
            st.dataframe(material_df, use_container_width=True, hide_index=True)

    with st.expander("Material Discounts", expanded=not material_discount_df.empty):
        if material_discount_df.empty:
            st.caption("No material discounts selected.")
        else:
            st.dataframe(material_discount_df, use_container_width=True, hide_index=True)

    with st.expander("All Upgrade Rows", expanded=False):
        st.dataframe(upgrades_df, use_container_width=True, hide_index=True)


def _render_curtain_breakdown(price_breakdown: dict) -> None:
    return


def _render_installation_breakdown(installation_lines: list[dict]) -> None:
    if not installation_lines:
        return

    st.markdown("#### Installation Cost")
    st.caption("Installation is added to unit cost only and is not affected by reseller discount.")
    total_cols = st.columns(2)
    total_cols[0].metric(
        "Installation / Site Price",
        money(sum(line["Extended Price"] for line in installation_lines)),
    )
    total_cols[1].metric(
        "Installation / Site Cost",
        money(sum(line["Extended Cost"] for line in installation_lines)),
    )
    _compact_dataframe(pd.DataFrame(installation_lines))


def _render_stepper(step: int) -> None:
    """Renders a 4-step progress indicator. step is 1-based."""
    steps = ["1 · Select Door", "2 · Door Config", "3 · Curtain & Install", "4 · Pricing"]
    cols = st.columns(len(steps))
    for i, (col, label) in enumerate(zip(cols, steps), start=1):
        if i < step:
            colour, bg, border = "#166534", "#dcfce7", "#16a34a"   # done — green
        elif i == step:
            colour, bg, border = "#1e3a8a", "#dbeafe", "#2563eb"   # active — blue
        else:
            colour, bg, border = "#6b7280", "#f3f4f6", "#d1d5db"   # future — grey
        col.markdown(
            f"""<div style="text-align:center;padding:8px 4px;border-radius:8px;
                border:2px solid {border};background:{bg};color:{colour};
                font-weight:{'700' if i == step else '500'};font-size:0.85rem;">
                {label}</div>""",
            unsafe_allow_html=True,
        )
    st.write("")  # spacer


def render_configurator() -> None:
    line_number = st.session_state.get("active_line_number") or 1
    st.title(f"Configurator — Line {line_number}")

    back_col, _ = st.columns([1, 5], vertical_alignment="center")
    with back_col:
        st.button("← Back to Estimate", on_click=close_configurator)

    price_lookup = DoorPriceLookup()
    selected_config = _render_configurator_selector()

    door_config_saved = st.session_state.get("DOOR_CONFIG_SAVED", False)

    # Stepper: determine current step
    if not selected_config["is_configured"]:
        _render_stepper(1)
    elif not door_config_saved:
        _render_stepper(2)
    else:
        _render_stepper(3)

    if not selected_config["is_configured"]:
        st.info("Select a door type and model, then click **Configure** to open the matching configurator.")
        return

    if selected_config["door_type"] != "RRD":
        st.warning(
            f"{selected_config['config_id']} is selected for {selected_config['part_id']}. "
            "The shared launcher is ready, but this configurator screen still needs to be built."
        )
        return

    with st.expander("Door Configuration", expanded=not door_config_saved):
        door_result = render_door_section(mapped_select, price_lookup=price_lookup)
        validation_result = door_result["validation_result"]

        door_can_save = (
            bool(door_result["door_model_value"])
            and door_result["NUMDOORHEIGHT"] > 0
            and door_result["NUMDOORWIDTH"] > 0
            and validation_result.get("is_valid", True)
        )

        save_col, status_col = st.columns([1, 4], vertical_alignment="center")
        with save_col:
            st.button(
                "Save Door Configuration",
                type="primary",
                on_click=_save_door_config,
                disabled=not door_can_save,
                use_container_width=True,
            )
        with status_col:
            if door_config_saved:
                st.success("✅ Door configuration saved.")
            else:
                st.info("Save the door configuration to continue to curtain and installation.")

    if not door_config_saved:
        return

    st.divider()

    # ── Curtain + Installation side by side ──────────────────────────────
    curtain_col, install_col = st.columns(2, gap="large")
    with curtain_col:
        curtain_result = render_curtain_section(price_lookup=price_lookup)
    with install_col:
        installation_result = render_installation_section(
            mapped_select,
            price_lookup=price_lookup,
        )

    door_result["door_controls_values"] = {
        **door_result["door_controls_values"],
        **installation_result["installation_values"],
        **curtain_result["curtain_values"],
        "LINE_DOOR_TYPE": selected_config["door_type"],
        "LINE_PART_ID": selected_config["part_id"],
        "LINE_CONFIG_ID": selected_config["config_id"],
    }

    st.divider()
    st.subheader("Calculation")

    calc_input_col1, calc_input_col2, _ = st.columns([1, 1, 3], vertical_alignment="bottom")
    with calc_input_col1:
        quote_quantity = st.number_input(
            "Quote Quantity",
            min_value=1,
            value=int(st.session_state.get("QTY", 1) or 1),
            step=1,
            key="QTY",
        )
    with calc_input_col2:
        reseller_discount = st.number_input(
            "Reseller Discount (%)",
            min_value=0.0,
            max_value=100.0,
            value=float(st.session_state.get("RESELLERDISCOUNT", 0.0) or 0.0),
            key="RESELLERDISCOUNT",
        )
    misc_col1, misc_col2, misc_col3 = st.columns([1, 1, 3], vertical_alignment="bottom")
    with misc_col1:
        misc_extra_price = st.number_input(
            "Misc Extra Price (p/door)",
            min_value=0.0,
            step=1.0,
            value=float(st.session_state.get("uqmqMiscExtras", 0.0) or 0.0),
            key="uqmqMiscExtras",
        )
    with misc_col2:
        misc_extra_cost = st.number_input(
            "Misc Extra Cost (p/door)",
            min_value=0.0,
            step=1.0,
            value=float(st.session_state.get("MISCEXTRACOST", 0.0) or 0.0),
            key="MISCEXTRACOST",
        )
    with misc_col3:
        misc_extra_description = st.text_input(
            "Misc Extra Description",
            value=str(st.session_state.get("uqmqMiscExtraDesc", "") or ""),
            key="uqmqMiscExtraDesc",
        )
    door_result["QTY"] = quote_quantity
    door_result["door_controls_values"]["QTY"] = quote_quantity
    door_result["door_controls_values"]["uqmqMiscExtras"] = misc_extra_price
    door_result["door_controls_values"]["uqmqMiscExtraDesc"] = misc_extra_description

    price_breakdown = price_lookup.get_price_breakdown(
        door_model=door_result["door_model_value"],
        width=door_result["NUMDOORWIDTH"],
        height=door_result["NUMDOORHEIGHT"],
        qty=quote_quantity,
        selected_values=door_result["door_controls_values"],
    )

    installation_lines = price_lookup.get_priced_installation_lines(installation_result["installation_values"])
    installation_site_price = sum(line["Extended Price"] for line in installation_lines)
    installation_site_cost = sum(line["Extended Cost"] for line in installation_lines)
    installation_site_description = "; ".join(
        line["Installation Item"]
        for line in installation_lines
        if line.get("Installation Item")
    )

    sell_price_before_reseller_discount = (
        price_breakdown["base_door_sell_price"]
        + price_breakdown["material_sell_price"]
        + price_breakdown["assembly_sell_price"]
        - price_breakdown["material_discount_sell_price"]
    )
    sell_price_before_reseller_discount = round(sell_price_before_reseller_discount)
    final_unit_cost = (
        price_breakdown["base_door_cost"]
        + price_breakdown["material_cost"]
        + price_breakdown["assembly_cost"]
        - price_breakdown["material_discount_cost"]
        + misc_extra_cost
        + installation_site_cost
    )
    discount_amount = sell_price_before_reseller_discount * (reseller_discount / 100)
    discounted_unit_sell_price = round(
        sell_price_before_reseller_discount
        - discount_amount
        + installation_site_price
        + misc_extra_price
    )
    discounted_total_sell_price = discounted_unit_sell_price * price_breakdown["qty"]
    final_total_cost = final_unit_cost * price_breakdown["qty"]
    final_margin_value = discounted_unit_sell_price - final_unit_cost
    final_margin_percent = (
        final_margin_value / discounted_unit_sell_price
        if discounted_unit_sell_price
        else 0.0
    )

    _render_stepper(4)
    _render_sidebar_price_summary(
        discounted_unit_sell_price=discounted_unit_sell_price,
        final_unit_cost=final_unit_cost,
        final_margin_value=final_margin_value,
        final_margin_percent=final_margin_percent,
        discounted_total_sell_price=discounted_total_sell_price,
        qty=price_breakdown["qty"],
    )
    _render_price_summary(
        price_breakdown=price_breakdown,
        misc_extra_price=misc_extra_price,
        misc_extra_cost=misc_extra_cost,
        installation_site_price=installation_site_price,
        installation_site_cost=installation_site_cost,
        reseller_discount=reseller_discount,
        discount_amount=discount_amount,
        discounted_unit_sell_price=discounted_unit_sell_price,
        discounted_total_sell_price=discounted_total_sell_price,
        final_unit_cost=final_unit_cost,
        final_total_cost=final_total_cost,
        final_margin_value=final_margin_value,
        final_margin_percent=final_margin_percent,
    )

    price_breakdown["unit_sell_price"] = discounted_unit_sell_price
    price_breakdown["unit_cost"] = final_unit_cost
    price_breakdown["total_sell_price"] = discounted_total_sell_price
    price_breakdown["total_cost"] = final_total_cost
    price_breakdown["margin_value"] = final_margin_value
    price_breakdown["margin_percent"] = final_margin_percent
    price_breakdown["misc_extra_price_per_door"] = misc_extra_price
    price_breakdown["misc_extra_cost_per_door"] = misc_extra_cost
    price_breakdown["misc_extra_description"] = misc_extra_description
    price_breakdown["installation_site_cost_per_door"] = installation_site_cost
    price_breakdown["installation_site_price_per_door"] = installation_site_price
    price_breakdown["installation_site_description"] = installation_site_description
    price_breakdown["installation_lines"] = installation_lines

    st.button(
        "Save Line to Estimate",
        type="primary",
        on_click=save_active_line,
        args=(
            door_result,
            price_breakdown,
            discounted_unit_sell_price,
            discounted_total_sell_price,
            reseller_discount,
        ),
        disabled=(
            not validation_result.get("is_valid", True)
            or not installation_result["validation_result"].get("is_valid", True)
            or not curtain_result["validation_result"].get("is_valid", True)
        ),
    )

    _render_selected_price_detail(
        price_breakdown=price_breakdown,
        installation_lines=installation_lines,
        misc_extra_cost=misc_extra_cost,
        misc_extra_price=misc_extra_price,
        misc_extra_description=misc_extra_description,
        reseller_discount=reseller_discount,
        discount_amount=discount_amount,
        discounted_unit_sell_price=discounted_unit_sell_price,
        discounted_total_sell_price=discounted_total_sell_price,
        final_unit_cost=final_unit_cost,
        final_total_cost=final_total_cost,
    )

    if reseller_discount > 0:
        st.info(
            f"Reseller Discount applied: {reseller_discount:.2f}% "
            f"(${discount_amount:,.2f} per door)"
        )
