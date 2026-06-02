from __future__ import annotations
from math import ceil
from typing import Any

def build_upgrade_columns(
    selected_values: dict[str, Any],
    part_prices: dict[str, dict[str, Any]],
) -> list[dict[str, Any]]:
    """
    Returns rows for the configurator grid.

    part_prices example:
    {
        "EL-UPS-1KVAASS": {"label": "1kVA UPS Assembly", "price": 1200, "cost": 800},
        "OPTION-POWDERCOAT": {"label": "Powder Coat", "price": 350, "cost": 180},
    }

    Output columns:
    Assembly Upgrade | Assembly Price | Assembly Cost |
    Material Upgrade | Material Price | Material Cost
    Installation/Site | Installation Price | Installation Cost
    """

    assembly_upgrades: list[dict[str, Any]] = []
    material_upgrades: list[dict[str, Any]] = []
    material_discount: list[dict[str, Any]] = []
    installation_site: list[dict[str, Any]] = []

    door_model = str(selected_values.get("CMBDOORMODEL", "") or "").strip()
    ups = str(selected_values.get("CMBUPS", "") or "").strip()
    controller_enclosure = str(selected_values.get("CMBCONTROLLERENCLOSURE", "") or "").strip()
    pe_beams = str(selected_values.get("CMBPEBEAMS", "") or "").strip()
    heat_trace_hood = str(selected_values.get("CMBHEATTRACEHOOD", "") or "").strip()
    wind_track = str(selected_values.get("CMBWINDTRACK", "") or "").strip()
    brake_ip_basic = str(selected_values.get("CMBBRAKEIPBASIC", "") or "").strip()
    motor_spec = str(selected_values.get("CMBMOTORSPEC", "") or "").strip()
    motor_clear_coat = str(selected_values.get("CHKMOTORCLEARCOAT", "") or "").strip().upper()
    motor_oride = str(selected_values.get("CMBMOTORORIDE", "") or "").strip()
    hyperlift = str(selected_values.get("CHKHYPERLIFT", "") or "").strip().upper()
    hold_open = str(selected_values.get("CHKHOLDOPEN", "") or "").strip().upper()
    door_width = float(selected_values.get("NUMDOORWIDTH", 0) or 0)
    door_height = float(selected_values.get("NUMDOORHEIGHT", 0) or 0)
    es40_fascia = str(selected_values.get("CMBES40FASCIA", "") or "").strip()
    colour_finish_type = str(selected_values.get("CMBCOLOURFINISHTYPE", "") or "").strip()
    traffic_light = str(selected_values.get("CMBTRAFFICLIGHT", "") or "").strip()
    brush_seal = str(selected_values.get("CMBBRUSHSEAL", "") or "").strip()
    gearbox_heater = str(selected_values.get("CMBGEARBOXHEATER", "") or "").strip()
    heat_trace_leg = str(selected_values.get("CMBHEATTRACELEG", "") or "").strip()
    interlock = str(selected_values.get("CHKINTERLOCK", "") or "").strip()
    rearhood_brushseal = str(selected_values.get("CMBREARHOODBRUSHSEAL", "") or "").strip()
    cust_steel = str(selected_values.get("CMBCUSTSTEEL", "") or "").strip()
    track_config = str(selected_values.get("CMBTRACKCONFIG", "") or "").strip()
    ex35felt = str(selected_values.get("CHKEX35FELT", "") or "").strip()
    motor_hand  = str(selected_values.get("CMBMOTORHAND", "") or "").strip()
    motor_shroud = str(selected_values.get("CMBMOTORSHROUD", "") or "").strip()

    act1 = str(selected_values.get("CMBACT1", "") or "").strip()
    act2 = str(selected_values.get("CMBACT2", "") or "").strip()
    act3 = str(selected_values.get("CMBACT3", "") or "").strip()
    act4 = str(selected_values.get("CMBACT4", "") or "").strip()
    act5 = str(selected_values.get("CMBACT5", "") or "").strip()
    radar1 = str(selected_values.get("CMBRADAR1", "") or "").strip()
    radar2 = str(selected_values.get("CMBRADAR2", "") or "").strip()
    activation_options = [act1, act2, act3, act4]
    activation_options_with_act5 = [act1, act2, act3, act4, act5]
    ixio_long_stalk_quantity = _matching_count([radar1, radar2], "IXIO Sensor - Long Stalk")
    ixio_short_stalk_quantity = _matching_count([radar1, radar2], "IXIO Sensor - Short Stalk")
    ixio_no_stalk_quantity = _matching_count([radar1, radar2], "IXIO Sensor - No Stalk")
    falcon_no_stalk_quantity = _matching_count([radar1, radar2], "Falcon Radar - No Stalk")
    condor_no_stalk_quantity = _matching_count([radar1, radar2], "Condor Radar - No Stalk")
    condor_long_stalk_quantity = _matching_count([radar1, radar2], "Condor Radar - Long Stalk")
    condor_short_stalk_quantity = _matching_count([radar1, radar2], "Condor Radar - Short Stalk")
    falcon_long_stalk_quantity = _matching_count([radar1, radar2], "Falcon Radar - Long Stalk")
    falcon_short_stalk_quantity = _matching_count([radar1, radar2], "Falcon Radar - Short Stalk")
    pull_cord_quantity = _startswith_count(activation_options, "Pull Cord")
    pentacode_receiver_required = any(
        option.startswith("Pentacode - 2") or option.startswith("Pentacode - 4")
        for option in activation_options
    )
    magic_switch_in_wall_quantity = _activation_quantity(selected_values, "Magic Switch - In Wall")
    magic_switch_ip65_quantity = _activation_quantity(selected_values, "Magic Switch - IP65 Housing")
    pentacode_2_button_quantity = _pentacode_2_button_quantity(selected_values)
    pentacode_4_button_quantity = _pentacode_4_button_quantity(selected_values)
    elsema_remote_count = sum(
        1
        for act_option in activation_options
        if act_option.startswith("Elsema Remote")
    )
    elsema_remote_1_button_quantity = _elsema_remote_1_button_quantity(selected_values)
    elsema_remote_2_button_quantity = _elsema_remote_2_button_quantity(selected_values)
    elsema_remote_4_button_quantity = _elsema_remote_4_button_quantity(selected_values)
    elsema_remote_8_button_quantity = _elsema_remote_8_button_quantity(selected_values)

    excluded_controller_models = [
        "MOVICHILL",
        "MOVICHILL-XL",
        "HS35-THERMIC",
        "HS50-THERMIC",
        "MOVIFOLD",
        "CONCERTINA",
    ]

    # Assembly upgrade rules.
    if ups.startswith("1kVA"):
        part_id = "EL-UPS-1KVAASS"
        part = part_prices.get(part_id, {})
        assembly_upgrades.append({
            "part_id": part_id,
            "label": part.get("label", part_id),
            "price": float(part.get("price", 0) or 0),
            "cost": float(part.get("cost", 0) or 0),
            "quantity": 1,
            "revision": None,
        })

    if ups.startswith("2kVA"):
        part_id = "EL-UPS-2KVAASS"
        part = part_prices.get(part_id, {})
        assembly_upgrades.append({
            "part_id": part_id,
            "label": part.get("label", part_id),
            "price": float(part.get("price", 0) or 0),
            "cost": float(part.get("cost", 0) or 0),
            "quantity": 1,
            "revision": None,
        })

    if ups.startswith("3kVA"):
        part_id = "EL-UPS-3KVAASS"
        part = part_prices.get(part_id, {})
        assembly_upgrades.append({
            "part_id": part_id,
            "label": part.get("label", part_id),
            "price": float(part.get("price", 0) or 0),
            "cost": float(part.get("cost", 0) or 0),
            "quantity": 1,
            "revision": None,
        })

    if controller_enclosure == "ABS Hi-Box IP66" and door_model not in excluded_controller_models:
        part_id = "OPTION-RRD-ENC-CONT403015-ABS"
        part = part_prices.get(part_id, {})
        assembly_upgrades.append({
            "part_id": part_id,
            "label": part.get("label", part_id),
            "price": float(part.get("price", 0) or 0),
            "cost": float(part.get("cost", 0) or 0),
            "quantity": 1,
            "revision": None,
        })

    if controller_enclosure == "Remax S/S IP66" and door_model not in excluded_controller_models:
        part_id = "OPTION-RRD-ENC-CONT403015-SS"
        part = part_prices.get(part_id, {})
        assembly_upgrades.append({
            "part_id": part_id,
            "label": part.get("label", part_id),
            "price": float(part.get("price", 0) or 0),
            "cost": float(part.get("cost", 0) or 0),
            "quantity": 1,
            "revision": None,
        })

    if controller_enclosure == "Custom S/S IP66" and door_model not in excluded_controller_models:
        part_id = "OPTION-RRD-ENC-CONT403015-RSS"
        part = part_prices.get(part_id, {})
        assembly_upgrades.append({
            "part_id": part_id,
            "label": part.get("label", part_id),
            "price": float(part.get("price", 0) or 0),
            "cost": float(part.get("cost", 0) or 0),
            "quantity": 1,
            "revision": None,
        })

    if pe_beams == "2 Level PE":
        part_id = "RRD-PEBASS-D"
        part = part_prices.get(part_id, {})
        assembly_upgrades.append({
            "part_id": part_id,
            "label": part.get("label", part_id),
            "price": float(part.get("price", 0) or 0),
            "cost": float(part.get("cost", 0) or 0),
            "quantity": 1,
            "revision": None,
        })

    if pe_beams == "2x LZRS25":
        part_id = "SENS-LZRS25"
        part = part_prices.get(part_id, {})
        material_upgrades.append({
            "part_id": part_id,
            "label": part.get("label", part_id),
            "price": float(part.get("price", 0) or 0),
            "cost": float(part.get("cost", 0) or 0),
            "quantity": 1,
            "revision": "",
        })

    if heat_trace_hood == "Yes":
        part_id = "OPTION-RRD-FREEZERPACK"
        part = part_prices.get(part_id, {})
        assembly_upgrades.append({
            "part_id": part_id,
            "label": part.get("label", part_id),
            "price": float(part.get("price", 0) or 0),
            "cost": float(part.get("cost", 0) or 0),
            "quantity": 1,
            "revision": None,
        })

    if wind_track == "Yes":
        part_id = "OPTION-RRD-HWTRK"
        quantity = max(1, ceil(door_height / 1000))
        part = part_prices.get(part_id, {})
        assembly_upgrades.append({
            "part_id": part_id,
            "label": part.get("label", part_id),
            "price": float(part.get("price", 0) or 0) * quantity,
            "cost": float(part.get("cost", 0) or 0) * quantity,
            "quantity": quantity,
            "revision": None,
        })

    if ("IP66" in brake_ip_basic or motor_spec == "External / Moisture") \
            and motor_clear_coat != "TRUE" \
            and motor_spec != "Aggressive / Corrosive":
        part_id = "RRD-GFA-BRAKEPUPG-IP66"
        part = part_prices.get(part_id, {})
        assembly_upgrades.append({
            "part_id": part_id,
            "label": part.get("label", part_id),
            "price": float(part.get("price", 0) or 0),
            "cost": float(part.get("cost", 0) or 0),
            "quantity": 1,
            "revision": None,
        })

    if motor_clear_coat == "TRUE" or motor_spec == "Aggressive / Corrosive":
        part_id = "OPTION-RRD-MOTUPG-AGGRESSIVE"
        part = part_prices.get(part_id, {})
        assembly_upgrades.append({
            "part_id": part_id,
            "label": part.get("label", part_id),
            "price": float(part.get("price", 0) or 0),
            "cost": float(part.get("cost", 0) or 0),
            "quantity": 1,
            "revision": None,
        })

    if door_model == "ES40" and door_width > 3000 and es40_fascia == "Yes":
        part_id = "RRD-FASASS-ES40-4"
        part = part_prices.get(part_id, {})
        assembly_upgrades.append({
            "part_id": part_id,
            "label": part.get("label", part_id),
            "price": float(part.get("price", 0) or 0),
            "cost": float(part.get("cost", 0) or 0),
            "quantity": 1,
            "revision": None,
        })

    if any(option.startswith("Induction Loop -") for option in activation_options):
        part_id = "OPTION-SENS-FLASS"
        part = part_prices.get(part_id, {})
        if door_model in ["CONCERTINA", "MOVIFOLD"]:
            revision = "CONCERT/M-FOLD"
        elif door_model in ["HS50-THERMIC", "HS35-THERMIC", "MOVICHILL"]:
            revision = "EXCLUDE BOX"
        else:
            revision = "FULL KIT"
        assembly_upgrades.append({
            "part_id": part_id,
            "label": part.get("label", part_id),
            "price": float(part.get("price", 0) or 0),
            "cost": float(part.get("cost", 0) or 0),
            "quantity": 1,
            "revision": revision,
        })

    if ixio_long_stalk_quantity > 0:
        part_id = "RRD-IXIO-LONGASS"
        part = part_prices.get(part_id, {})
        assembly_upgrades.append({
            "part_id": part_id,
            "label": part.get("label", part_id),
            "price": float(part.get("price", 0) or 0),
            "cost": float(part.get("cost", 0) or 0),
            "quantity": ixio_long_stalk_quantity,
            "revision": "",
        })

    if ixio_short_stalk_quantity > 0:
        part_id = "RRD-IXIO-SHASS"
        part = part_prices.get(part_id, {})
        assembly_upgrades.append({
            "part_id": part_id,
            "label": part.get("label", part_id),
            "price": float(part.get("price", 0) or 0),
            "cost": float(part.get("cost", 0) or 0),
            "quantity": ixio_short_stalk_quantity,
            "revision": "",
        })

    if ixio_no_stalk_quantity > 0:
        part_id = "SENS-IXIODT1"
        part = part_prices.get(part_id, {})
        assembly_upgrades.append({
            "part_id": part_id,
            "label": part.get("label", part_id),
            "price": float(part.get("price", 0) or 0),
            "cost": float(part.get("cost", 0) or 0),
            "quantity": ixio_no_stalk_quantity,
            "revision": "",
        })

    if condor_long_stalk_quantity > 0:
        part_id = "RRD-COND-LONGASS"
        part = part_prices.get(part_id, {})
        assembly_upgrades.append({
            "part_id": part_id,
            "label": part.get("label", part_id),
            "price": float(part.get("price", 0) or 0),
            "cost": float(part.get("cost", 0) or 0),
            "quantity": condor_long_stalk_quantity,
            "revision": "",
        })

    if condor_short_stalk_quantity > 0:
        part_id = "RRD-COND-SHASS"
        part = part_prices.get(part_id, {})
        assembly_upgrades.append({
            "part_id": part_id,
            "label": part.get("label", part_id),
            "price": float(part.get("price", 0) or 0),
            "cost": float(part.get("cost", 0) or 0),
            "quantity": condor_short_stalk_quantity,
            "revision": "",
        })

    if falcon_long_stalk_quantity > 0:
        part_id = "RRD-FALC-LONGASS"
        part = part_prices.get(part_id, {})
        assembly_upgrades.append({
            "part_id": part_id,
            "label": part.get("label", part_id),
            "price": float(part.get("price", 0) or 0),
            "cost": float(part.get("cost", 0) or 0),
            "quantity": falcon_long_stalk_quantity,
            "revision": "",
        })

    if falcon_short_stalk_quantity > 0:
        part_id = "RRD-FALC-SHASS"
        part = part_prices.get(part_id, {})
        assembly_upgrades.append({
            "part_id": part_id,
            "label": part.get("label", part_id),
            "price": float(part.get("price", 0) or 0),
            "cost": float(part.get("cost", 0) or 0),
            "quantity": falcon_short_stalk_quantity,
            "revision": "",
        })

    if falcon_no_stalk_quantity > 0:
        part_id = "SENS-FALC"
        part = part_prices.get(part_id, {})
        material_upgrades.append({
            "part_id": part_id,
            "label": part.get("label", part_id),
            "price": float(part.get("price", 0) or 0),
            "cost": float(part.get("cost", 0) or 0),
            "quantity": falcon_no_stalk_quantity,
            "revision": "",
        })

    if condor_no_stalk_quantity > 0:
        part_id = "SENS-COND"
        part = part_prices.get(part_id, {})
        material_upgrades.append({
            "part_id": part_id,
            "label": part.get("label", part_id),
            "price": float(part.get("price", 0) or 0),
            "cost": float(part.get("cost", 0) or 0),
            "quantity": condor_no_stalk_quantity,
            "revision": "",
        })

    if pull_cord_quantity > 0:
        part_id = "PCSW"
        part = part_prices.get(part_id, {})
        material_upgrades.append({
            "part_id": part_id,
            "label": part.get("label", part_id),
            "price": float(part.get("price", 0) or 0),
            "cost": float(part.get("cost", 0) or 0),
            "quantity": pull_cord_quantity,
            "revision": "",
        })

       
    if any(option == "Existing Induction Loop" for option in activation_options_with_act5):
        part_id = "OPTION-SENS-FLASS-EXISTING"
        part = part_prices.get(part_id, {})
        assembly_upgrades.append({
            "part_id": part_id,
            "label": part.get("label", part_id),
            "price": float(part.get("price", 0) or 0),
            "cost": float(part.get("cost", 0) or 0),
            "quantity": 1,
            "revision": None,
        })

    if magic_switch_in_wall_quantity > 0:
        part_id = "SENS-MAGSW-IW"
        part = part_prices.get(part_id, {})
        material_upgrades.append({
            "part_id": part_id,
            "label": part.get("label", part_id),
            "price": float(part.get("price", 0) or 0),
            "cost": float(part.get("cost", 0) or 0),
            "quantity": magic_switch_in_wall_quantity,
            "revision": "",
        })

        part_id = "EL-CAB-1.5140.24CSECWH"
        part = part_prices.get(part_id, {})
        material_upgrades.append({
            "part_id": part_id,
            "label": part.get("label", part_id),
            "price": float(part.get("price", 0) or 0),
            "cost": float(part.get("cost", 0) or 0),
            "quantity": 1,
            "revision": "",
        })

    if magic_switch_ip65_quantity > 0:
        part_id = "SENS-MAGSW-IP65"
        part = part_prices.get(part_id, {})
        material_upgrades.append({
            "part_id": part_id,
            "label": part.get("label", part_id),
            "price": float(part.get("price", 0) or 0),
            "cost": float(part.get("cost", 0) or 0),
            "quantity": magic_switch_ip65_quantity,
            "revision": "",
        })

    if elsema_remote_count > 0 or any(option.startswith("Elsema Receiver") for option in activation_options):
        part_id = "RRD-ELREC1C"
        part = part_prices.get(part_id, {})
        material_upgrades.append({
            "part_id": part_id,
            "label": part.get("label", part_id),
            "price": float(part.get("price", 0) or 0),
            "cost": float(part.get("cost", 0) or 0),
            "quantity": 1,
            "revision": "",
        })

    if pentacode_receiver_required:
        part_id = "RRD-ELREC1C-PC"
        part = part_prices.get(part_id, {})
        material_upgrades.append({
            "part_id": part_id,
            "label": part.get("label", part_id),
            "price": float(part.get("price", 0) or 0),
            "cost": float(part.get("cost", 0) or 0),
            "quantity": 1,
            "revision": "",
        })

    if pentacode_2_button_quantity > 0:
        part_id = "RRD-ELREM2C-PC"
        part = part_prices.get(part_id, {})
        material_upgrades.append({
            "part_id": part_id,
            "label": part.get("label", part_id),
            "price": float(part.get("price", 0) or 0),
            "cost": float(part.get("cost", 0) or 0),
            "quantity": pentacode_2_button_quantity,
            "revision": "",
        })

    if pentacode_4_button_quantity > 0:
        part_id = "RRD-ELREM1C-PC"
        part = part_prices.get(part_id, {})
        material_upgrades.append({
            "part_id": part_id,
            "label": part.get("label", part_id),
            "price": float(part.get("price", 0) or 0),
            "cost": float(part.get("cost", 0) or 0),
            "quantity": pentacode_4_button_quantity,
            "revision": "",
        })

    if elsema_remote_1_button_quantity > 0:
        part_id = "RRD-ELREM1C"
        part = part_prices.get(part_id, {})
        material_upgrades.append({
            "part_id": part_id,
            "label": part.get("label", part_id),
            "price": float(part.get("price", 0) or 0),
            "cost": float(part.get("cost", 0) or 0),
            "quantity": elsema_remote_1_button_quantity,
            "revision": "",
        })

    if elsema_remote_2_button_quantity > 0:
        part_id = "RRD-ELREM2C"
        part = part_prices.get(part_id, {})
        material_upgrades.append({
            "part_id": part_id,
            "label": part.get("label", part_id),
            "price": float(part.get("price", 0) or 0),
            "cost": float(part.get("cost", 0) or 0),
            "quantity": elsema_remote_2_button_quantity,
            "revision": "",
        })

    if elsema_remote_4_button_quantity > 0:
        part_id = "RRD-ELREM4C"
        part = part_prices.get(part_id, {})
        material_upgrades.append({
            "part_id": part_id,
            "label": part.get("label", part_id),
            "price": float(part.get("price", 0) or 0),
            "cost": float(part.get("cost", 0) or 0),
            "quantity": elsema_remote_4_button_quantity,
            "revision": "",
        })

    if elsema_remote_8_button_quantity > 0:
        part_id = "RRD-ELREM8C"
        part = part_prices.get(part_id, {})
        material_upgrades.append({
            "part_id": part_id,
            "label": part.get("label", part_id),
            "price": float(part.get("price", 0) or 0),
            "cost": float(part.get("cost", 0) or 0),
            "quantity": elsema_remote_8_button_quantity,
            "revision": "",
        })

    if hold_open == "TRUE":
        part_id = "RRD-SWITCH-TOGGLE-22MM"
        part = part_prices.get(part_id, {})
        material_upgrades.append({
            "part_id": part_id,
            "label": part.get("label", part_id),
            "price": float(part.get("price", 0) or 0),
            "cost": float(part.get("cost", 0) or 0),
            "quantity": 1,
            "revision": "",
        })

    if traffic_light != "" and traffic_light != "No" and door_model not in ["CONCERTINA", "MOVIFOLD"]:
        part_id = "OPTION-RRD-TLS-4PC"
        part = part_prices.get(part_id, {})
        assembly_upgrades.append({
            "part_id": part_id,
            "label": part.get("label", part_id),
            "price": float(part.get("price", 0) or 0),
            "cost": float(part.get("cost", 0) or 0),
            "quantity": 1,
            "revision": None,
        })

    if traffic_light == "Yes" and door_model in ["CONCERTINA", "MOVIFOLD"]:
        part_id = "OPTION-INDDR-TLS-2PCRM"
        part = part_prices.get(part_id, {})
        assembly_upgrades.append({
            "part_id": part_id,
            "label": part.get("label", part_id),
            "price": float(part.get("price", 0) or 0),
            "cost": float(part.get("cost", 0) or 0),
            "quantity": 1,
            "revision": None,
        })

    if colour_finish_type != "":
        part_id = "OPTION-POWDERCOAT"
        part = part_prices.get(part_id, {})
        assembly_upgrades.append({
            "part_id": part_id,
            "label": part.get("label", part_id),
            "price": float(part.get("price", 0) or 0),
            "cost": float(part.get("cost", 0) or 0),
            "quantity": 1,
            "revision": None,
        })

    if brush_seal != "" and "Std" not in brush_seal and "None" not in brush_seal:
        part_id = "OPTION-BBSUPG"
        part = part_prices.get(part_id, {})

        if "EX" in door_model:
            revision = "EX"
        elif door_model == "HS25":
            revision = "HS25"
        elif door_model == "HS35":
            revision = "HS35"
        elif door_model in ["HS50", "HS65"]:
            revision = "HS65"
        else:
            revision = None

        assembly_upgrades.append({
            "part_id": part_id,
            "label": part.get("label", part_id),
            "price": float(part.get("price", 0) or 0),
            "cost": float(part.get("cost", 0) or 0),
            "quantity": 1,
            "revision": revision,
        })

    if any("Induction Loop -" in option for option in activation_options):
        part_id = "FLOOR LOOP CUTTING"
        part = part_prices.get(part_id, {})
        installation_site.append({
            "part_id": part_id,
            "label": part.get("label", part_id),
            "price": float(part.get("price", 0) or 0),
            "cost": float(part.get("cost", 0) or 0),
            "quantity": 1,
            "revision": None,
        })
        #material discount rules 
    if hyperlift == "TRUE" and door_model not in ["ES40", "BUGSTOP"]:
        part_id = "OPTION-RRD-HYP-DISCOUNT"
        part = part_prices.get(part_id, {})
        if door_model in ["EX35", "EX45"]:
            revision = "SML"
        elif door_model in ["HS35", "HS35-THERMIC"]:
            revision = "MED"
        else:
            revision = "LGE"
        material_discount.append({
            "part_id": part_id,
            "label": part.get("label", part_id),
            "price": float(part.get("price", 0) or 0),
            "cost": float(part.get("cost", 0) or 0),
            "quantity": 1,
            "revision": revision,
        })


    if door_model in ["MOVICHILL", "HS35-THERMIC","HS50-THERMIC"]:
        if gearbox_heater == "No" and heat_trace_hood == "No" and heat_trace_leg == "No" and controller_enclosure =="Std ABS IP54":
            part_id = "OPTION-RRD-HEAT1-DISCOUNT"
            part = part_prices.get(part_id, {})
            material_discount.append({
                "part_id": part_id,
                "label": part.get("label", part_id),
                "price": float(part.get("price", 0) or 0),
                "cost": float(part.get("cost", 0) or 0),
                "quantity": 1,
                "revision": None,
            })

    if door_model in ["MOVICHILL", "HS35-THERMIC","HS50-THERMIC"]:
        if gearbox_heater == "No" and heat_trace_hood == "No" and heat_trace_leg == "No" and  "IP66" in controller_enclosure:
            part_id = "OPTION-RRD-HEAT2-DISCOUNT"
            part = part_prices.get(part_id, {})
            material_discount.append({
                "part_id": part_id,
                "label": part.get("label", part_id),
                "price": float(part.get("price", 0) or 0),
                "cost": float(part.get("cost", 0) or 0),
                "quantity": 1,
                "revision": None,
            })
    if interlock == "TRUE":
        part_id = "OPTION-INTERLOCK"
        part = part_prices.get(part_id, {})
        material_upgrades.append({
            "part_id": part_id,
            "label": part.get("label", part_id),
            "price": float(part.get("price", 0) or 0),
            "cost": float(part.get("cost", 0) or 0),
            "quantity": 1,
            "revision": None,
        })
    if ("CURTAIN" in pe_beams.upper()
        and "EX" not in door_model.upper()
        and door_model.upper() not in ["MOVIFOLD", "CONCERTINA"]):

        part_id = "OPTION-LIGHT CURTAIN"
        part = part_prices.get(part_id, {})
        material_upgrades.append({
            "part_id": part_id,
            "label": part.get("label", part_id),
            "price": float(part.get("price", 0) or 0),
            "cost": float(part.get("cost", 0) or 0),
            "quantity": 1,
            "revision": None,
        })
    if motor_oride == "Chain Drive" and door_model not in ["HS65", "HS50", "HS50-THERMIC", "CONCERTINA", "MOVIFOLD"]:
        part_id = "OPTION-CHAIN-OPERATOR"
        part = part_prices.get(part_id, {})
        material_upgrades.append({
            "part_id": part_id,
            "label": part.get("label", part_id),
            "price": float(part.get("price", 0) or 0),
            "cost": float(part.get("cost", 0) or 0),
            "quantity": 1,
            "revision": None,
        })

    for act_option in activation_options:
        if act_option.startswith("Induction Loop -") and "Only" in act_option:
            part_id = "OPTION-RRD-SINGLELOOP-DISCOUNT"
            part = part_prices.get(part_id, {})
            material_discount.append({
                "part_id": part_id,
                "label": part.get("label", part_id),
                "price": float(part.get("price", 0) or 0),
                "cost": float(part.get("cost", 0) or 0),
                "quantity": 1,
                "revision": None,
            })
    if "Yes" in rearhood_brushseal:
        part_id ="OPTION-REARHOOD-BBSUPG"
        part = part_prices.get(part_id, {})
        material_upgrades.append({
            "part_id": part_id,
            "label": part.get("label", part_id),
            "price": float(part.get("price", 0) or 0),
            "cost": float(part.get("cost", 0) or 0),
            "quantity": 1,
            "revision": None,
        })
    
    if  "SOB-" in cust_steel and track_config == "Concealed" and door_model not in {"CONCERTINA", "MOVIFOLD"}:
            part_id = "OPTION-SOB-CONCEALED"
            part = part_prices.get(part_id, {})
            if door_model in {"HS50", "HS50-THERMIC", "HS65"}:
                revision = "HS65" 
            else:
                revision =  "HS35"
            material_upgrades.append({
        "part_id": part_id,
        "label": part.get("label", part_id),
        "price": float(part.get("price", 0) or 0),
        "cost": float(part.get("cost", 0) or 0),
        "quantity": 1,
        "revision": revision,
    })
            
            
    if ex35felt  == "TRUE":
        part_id = "OPTION-RRD-FELTSEAL-PRESSURE"
        part = part_prices.get(part_id, {})
        material_upgrades.append({
            "part_id": part_id,
            "label": part.get("label", part_id),
            "price": float(part.get("price", 0) or 0),
            "cost": float(part.get("cost", 0) or 0),
            "quantity": 1,
            "revision": None,
            })
        
    if (
        door_model in {"MOVIFOLD", "CONCERTINA"}
        and motor_hand == "Right"
        and motor_shroud == "Yes - Stainless Steel Upgrade"
    ):
        part_id = "RRD-MOTCOV-CONC-RH"
        part = part_prices.get(part_id, {})
        assembly_upgrades.append({
            "part_id": part_id,
            "label": part.get("label", part_id),
            "price": float(part.get("price", 0) or 0),
            "cost": float(part.get("cost", 0) or 0),
            "quantity": 1,
            "revision": "E",
        })

    # Build a clean grid with separate visible columns.
    rows = []
    max_rows = max(len(assembly_upgrades), len(material_upgrades), len(material_discount))

    for index in range(max_rows):
        assembly = assembly_upgrades[index] if index < len(assembly_upgrades) else {}
        material = material_upgrades[index] if index < len(material_upgrades) else {}
        mat_discount = material_discount[index] if index < len(material_discount) else {}
        install_site = installation_site[index] if index < len(installation_site) else {}

        rows.append({

            "Assembly Upgrade": assembly.get("label", ""),
            "Assembly Part ID": assembly.get("part_id", ""),
            "Assembly Revision": assembly.get("revision", ""),
            "Assembly Qty": assembly.get("quantity", ""),
            "Assembly Price": assembly.get("price", ""),
            "Assembly Cost": assembly.get("cost", ""),
            "Material Discount": mat_discount.get("label", ""),
            "Material Discount Part ID": mat_discount.get("part_id", ""),
            "Material Discount Revision": mat_discount.get("revision", ""),
            "Material Discount Qty": mat_discount.get("quantity", ""),
            "Material Discount Price": mat_discount.get("price", ""),
            "Material Discount Cost": mat_discount.get("cost", ""),
            "Material Upgrade": material.get("label", ""),
            "Material Part ID": material.get("part_id", ""),
            "Material Revision": material.get("revision", ""),
            "Material Qty": material.get("quantity", ""),
            "Material Price": material.get("price", ""),
            "Material Cost": material.get("cost", ""),
        })

    return rows


def _matching_count(values: list[str], expected_value: str) -> int:
    return sum(1 for value in values if str(value or "").strip() == expected_value)


def _startswith_count(values: list[str], prefix: str) -> int:
    return sum(1 for value in values if str(value or "").strip().startswith(prefix))


def _activation_quantity(selected_values: dict[str, Any], activation_name: str) -> int:
    quantity = 0

    for index in range(1, 5):
        activation = str(selected_values.get(f"CMBACT{index}", "") or "").strip()
        if activation == activation_name:
            quantity += _to_int(selected_values.get(f"NUMREMOTEQTY{index}", 0))

    return quantity


def _pentacode_2_button_quantity(selected_values: dict[str, Any]) -> int:
    remote_count = 0

    for index in range(1, 5):
        activation = str(selected_values.get(f"CMBACT{index}", "") or "").strip()
        if activation.startswith("Pentacode - 2"):
            remote_count += _to_int(selected_values.get(f"NUMREMOTEQTY{index}", 0))

    return remote_count


def _pentacode_4_button_quantity(selected_values: dict[str, Any]) -> int:
    remote_count = 0

    for index in range(1, 5):
        activation = str(selected_values.get(f"CMBACT{index}", "") or "").strip()
        if activation.startswith("Pentacode - 4"):
            remote_count += _to_int(selected_values.get(f"NUMREMOTEQTY{index}", 0))

    return remote_count


def _elsema_remote_1_button_quantity(selected_values: dict[str, Any]) -> int:
    remote_count = 0

    for index in range(1, 5):
        activation = str(selected_values.get(f"CMBACT{index}", "") or "").strip()
        if activation.startswith("Elsema Remote - 1"):
            remote_count += _to_int(selected_values.get(f"NUMREMOTEQTY{index}", 0))

    return remote_count


def _elsema_remote_2_button_quantity(selected_values: dict[str, Any]) -> int:
    remote_count = 0

    for index in range(1, 5):
        activation = str(selected_values.get(f"CMBACT{index}", "") or "").strip()
        if activation.startswith("Elsema Remote - 2"):
            remote_count += _to_int(selected_values.get(f"NUMREMOTEQTY{index}", 0))

    return remote_count


def _elsema_remote_4_button_quantity(selected_values: dict[str, Any]) -> int:
    remote_count = 0

    for index in range(1, 5):
        activation = str(selected_values.get(f"CMBACT{index}", "") or "").strip()
        if activation.startswith("Elsema Remote - 4"):
            remote_count += _to_int(selected_values.get(f"NUMREMOTEQTY{index}", 0))

    return remote_count


def _elsema_remote_8_button_quantity(selected_values: dict[str, Any]) -> int:
    remote_count = 0

    for index in range(1, 5):
        activation = str(selected_values.get(f"CMBACT{index}", "") or "").strip()
        if activation.startswith("Elsema Remote - 8"):
            remote_count += _to_int(selected_values.get(f"NUMREMOTEQTY{index}", 0))

    return remote_count


def _to_int(value: Any) -> int:
    try:
        return int(float(value or 0))
    except (TypeError, ValueError):
        return 0
