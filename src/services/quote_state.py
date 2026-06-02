import streamlit as st


def init_estimate_state() -> None:
    st.session_state.setdefault("estimate_lines", [])
    st.session_state.setdefault("estimate_mode", "header")
    st.session_state.setdefault("active_line_number", None)
    st.session_state.setdefault("show_customer_picker", False)


def open_new_line() -> None:
    _reset_line_price_inputs()
    st.session_state["LAST_DEFAULT_DOOR_MODEL"] = None
    st.session_state["LAST_DEFAULT_CURTAIN_SIGNATURE"] = None
    st.session_state["estimate_mode"] = "configurator"
    st.session_state["active_line_number"] = _next_line_number()


def edit_line(line_number: int) -> None:
    line = _find_line(line_number)
    if line is None:
        return

    for control_name, control_value in line.get("controls", {}).items():
        st.session_state[control_name] = control_value

    door_type = line.get("door_type", "") or ("RRD" if line.get("door_model") else "")
    part_id = line.get("part_id", "") or (f"RRD-{line.get('door_model')}" if door_type == "RRD" else "")
    config_id = line.get("config_id", "") or ("RRD-MOVIDOR-TEMPLATE" if door_type == "RRD" else "")
    st.session_state["LINE_DOOR_TYPE"] = door_type
    st.session_state["LINE_DOOR_MODEL"] = line.get("door_model", "")
    st.session_state["LINE_PART_ID"] = part_id
    st.session_state["LINE_CONFIG_ID"] = config_id
    st.session_state["LINE_CONFIGURED"] = bool(config_id)
    st.session_state["DOOR_CONFIG_SAVED"] = bool(config_id)
    st.session_state["LAST_DEFAULT_DOOR_MODEL"] = line.get("door_model", "")
    st.session_state["LAST_DEFAULT_CURTAIN_SIGNATURE"] = (
        line.get("door_model", ""),
        line.get("height", 0),
        line.get("width", 0),
    )
    st.session_state["RESELLERDISCOUNT"] = float(line.get("discount_percent") or 0)
    st.session_state["uqmqMiscExtras"] = float(line.get("uqmqMiscExtras", line.get("misc_extra_price_per_door", 0)) or 0)
    st.session_state["MISCEXTRACOST"] = float(line.get("misc_extra_cost_per_door") or 0)
    st.session_state["uqmqMiscExtraDesc"] = line.get("uqmqMiscExtraDesc", line.get("misc_extra_description", ""))
    st.session_state["active_line_number"] = line_number
    st.session_state["estimate_mode"] = "configurator"


def delete_line(line_number: int) -> None:
    line = _find_line(line_number)
    if line is None:
        return

    st.session_state["estimate_lines"].remove(line)
    _renumber_lines()
    st.session_state["active_line_number"] = None
    st.session_state["estimate_mode"] = "header"



def close_configurator() -> None:
    st.session_state["estimate_mode"] = "header"
    st.session_state["active_line_number"] = None


def save_active_line(
    door_result: dict,
    price_breakdown: dict,
    discounted_unit_sell_price: float,
    discounted_total_sell_price: float,
    reseller_discount: float,
) -> None:
    line_number = st.session_state.get("active_line_number")
    if line_number is None:
        line_number = _next_line_number()

    door_type = door_result["door_controls_values"].get("LINE_DOOR_TYPE", "RRD")
    part_id = door_result["door_controls_values"].get("LINE_PART_ID", f"RRD-{door_result['door_model_value']}")
    config_id = door_result["door_controls_values"].get("LINE_CONFIG_ID", "RRD-MOVIDOR-TEMPLATE")

    line = {
        "Line": line_number,
        "door_type": door_type,
        "part_id": part_id,
        "config_id": config_id,
        "door_model": door_result["door_model_value"],
        "width": door_result["NUMDOORWIDTH"],
        "height": door_result["NUMDOORHEIGHT"],
        "Qty": price_breakdown["qty"],
        "Part Description": (
            f"{part_id} "
            f"{door_result['NUMDOORHEIGHT']}H x {door_result['NUMDOORWIDTH']}W"
        ),
        "base_door_sell_price": price_breakdown["base_door_sell_price"],
        "base_door_cost": price_breakdown["base_door_cost"],
        "upgrade_sell_price": price_breakdown["upgrade_sell_price"],
        "upgrade_cost": price_breakdown["upgrade_cost"],
        "material_discount_sell_price": price_breakdown["material_discount_sell_price"],
        "material_discount_cost": price_breakdown["material_discount_cost"],
        "unit_sell_price": price_breakdown["unit_sell_price"],
        "unit_cost": price_breakdown["unit_cost"],
        "discount_percent": reseller_discount,
        "discounted_unit_sell_price": discounted_unit_sell_price,
        "total_cost": price_breakdown["total_cost"],
        "installation_site_price_per_door": price_breakdown.get("installation_site_price_per_door", 0),
        "installation_site_cost_per_door": price_breakdown.get("installation_site_cost_per_door", 0),
        "uqmqMiscExtras": price_breakdown.get("misc_extra_price_per_door", 0),
        "uqmqMiscExtraDesc": price_breakdown.get("misc_extra_description", ""),
        "misc_extra_price_per_door": price_breakdown.get("misc_extra_price_per_door", 0),
        "misc_extra_cost_per_door": price_breakdown.get("misc_extra_cost_per_door", 0),
        "misc_extra_description": price_breakdown.get("misc_extra_description", ""),
        "margin_value": discounted_unit_sell_price - price_breakdown["unit_cost"],
        "margin_percent": (
            (discounted_unit_sell_price - price_breakdown["unit_cost"]) / discounted_unit_sell_price
            if discounted_unit_sell_price
            else 0.0
        ),
        "total_sell_price": discounted_total_sell_price,
        "controls": door_result["door_controls_values"],
        "upgrade_lines": price_breakdown.get("upgrade_lines", []),
        "installation_lines": price_breakdown.get("installation_lines", []),
    }

    existing_index = next(
        (
            index
            for index, estimate_line in enumerate(st.session_state["estimate_lines"])
            if estimate_line["Line"] == line_number
        ),
        None,
    )

    if existing_index is None:
        st.session_state["estimate_lines"].append(line)
    else:
        st.session_state["estimate_lines"][existing_index] = line

    close_configurator()


def _find_line(line_number: int) -> dict | None:
    return next(
        (
            line
            for line in st.session_state.get("estimate_lines", [])
            if line["Line"] == line_number
        ),
        None,
    )


def _next_line_number() -> int:
    existing_lines = st.session_state.get("estimate_lines", [])
    if not existing_lines:
        return 1

    return max(int(line.get("Line") or 0) for line in existing_lines) + 1


def _renumber_lines() -> None:
    for index, line in enumerate(st.session_state.get("estimate_lines", []), start=1):
        line["Line"] = index


def _reset_line_price_inputs() -> None:
    st.session_state["RESELLERDISCOUNT"] = 0.0
    st.session_state["uqmqMiscExtras"] = 0.0
    st.session_state["MISCEXTRACOST"] = 0.0
    st.session_state["uqmqMiscExtraDesc"] = ""
    st.session_state["LINE_DOOR_TYPE"] = ""
    st.session_state["LINE_DOOR_MODEL"] = ""
    st.session_state["LINE_PART_ID"] = ""
    st.session_state["LINE_CONFIG_ID"] = ""
    st.session_state["LINE_CONFIGURED"] = False
    st.session_state["DOOR_CONFIG_SAVED"] = False
