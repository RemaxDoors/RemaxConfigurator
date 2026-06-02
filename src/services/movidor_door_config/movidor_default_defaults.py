from __future__ import annotations

import streamlit as st

from services.movidor_door_config import movidor_control_names as control


def get_default_selections(door_model: str, door_height: float = 0) -> dict[str, object]:
    door_model = str(door_model or "").strip().upper()
    door_height = float(door_height or 0)

    if door_model in {"BUGSTOP", "ES40"}:
        return {
            control.CMBBRAKEIPBASIC: "",
            control.CMBBRUSHSEAL: "Full Guides (Std)",
            control.CMBCABLELENGTH: "5",
            control.CMBCONTROLLERENCLOSURE: "Std ABS IP54",
            control.CMBHEATTRACELEG: "",
            control.CMBWINDTRACK: "No",
            control.CMBMOTORSHROUD: "No",
            control.CMBPEBEAMS: "1 Level PE",
            control.CMBPOWERSUPPLY: "1P10A",
            control.CMBTRACKCONFIG: "",
            control.CMBTRAFFICLIGHT: "No",
            control.CMBES40VSDMTR: "Yes - Hyperlift",
            control.CMBES40FASCIA: "No",
            control.CHKHYPERLIFT: 1,
            control.CMBFELTSEAL: "No",
            control.CMBELECSPEC: "Carwash",
        }

    if door_model == "HS25":
        return {
            control.CMBBRAKEIPBASIC: "",
            control.CMBBRUSHSEAL: "Full Guides (Std)",
            control.CMBCABLELENGTH: "5",
            control.CMBCONTROLLERENCLOSURE: "Std ABS IP54",
            control.CMBHEATTRACELEG: "",
            control.CMBWINDTRACK: "No",
            control.CMBMOTORSHROUD: "No",
            control.CMBPEBEAMS: "1 Level PE",
            control.CMBPOWERSUPPLY: "1P10A",
            control.CMBTRACKCONFIG: "",
            control.CMBTRAFFICLIGHT: "No",
            control.CMBES40VSDMTR: "No",
            control.CMBES40FASCIA: "No",
            control.CMBFELTSEAL: "No",
            control.CMBELECSPEC: "Carwash",
        }

    if door_model == "HS35":
        return {
            control.CMBBRAKEIPBASIC: "",
            control.CMBBRUSHSEAL: "500 top of Guides (Std)",
            control.CMBCABLELENGTH: "5",
            control.CMBCONTROLLERENCLOSURE: "Std ABS IP54",
            control.CMBHEATTRACELEG: "",
            control.CMBWINDTRACK: "No",
            control.CMBMOTORSHROUD: "No",
            control.CMBPEBEAMS: "1 Level PE",
            control.CMBPOWERSUPPLY: "1P10A",
            control.CMBTRACKCONFIG: "",
            control.CMBTRAFFICLIGHT: "No",
            control.CMBES40VSDMTR: "Yes - Hyperlift",
            control.CMBES40FASCIA: "No",
            control.CMBFELTSEAL: "No",
            control.CMBELECSPEC: "Carwash",
        }

    if door_model in {"EX35", "EX45"}:
        pe_beams = "1 Level - Slimline" if 0 < door_height < 2000 else "Light Curtain - 1830mm"
        return {
            control.CMBBRAKEIPBASIC: "IP65 Std",
            control.CMBBRUSHSEAL: "None (Std)",
            control.CMBCABLELENGTH: "3",
            control.CMBCONTROLLERENCLOSURE: "Std ABS IP54",
            control.CMBHEATTRACELEG: "",
            control.CMBWINDTRACK: "No",
            control.CMBMOTORSHROUD: "No",
            control.CMBPEBEAMS: pe_beams,
            control.CMBPOWERSUPPLY: "1P10A",
            control.CMBTRACKCONFIG: "",
            control.CMBTRAFFICLIGHT: "No",
            control.CMBFELTSEAL: "No",
            control.CMBELECSPEC: "Carwash",
            control.CMBPED1: "In Jbox - Door Side Left",
            control.CMBPED2: "In Jbox - Non Door Side Left",
        }

    if door_model in {"HS35-THERMIC", "HS50-THERMIC"}:
        return {
            control.CMBBRAKEIPBASIC: "IP65 Std",
            control.CMBBRUSHSEAL: "Full Guides & Fascia/Hood (Std)",
            control.CMBCABLELENGTH: "5",
            control.CMBCONTROLLERENCLOSURE: "Remax S/S IP66",
            control.CMBHEATTRACELEG: "Yes",
            control.CMBHEATTRACEHOOD: "No",
            control.CMBGEARBOXHEATER: "No",
            control.CMBFELTSEAL: "No",
            control.CMBWINDTRACK: "No",
            control.CMBMOTORSHROUD: "No",
            control.CMBPEBEAMS: "1 Level PE",
            control.CMBPOWERSUPPLY: "1P15A",
            control.CMBTRACKCONFIG: "",
            control.CMBTRAFFICLIGHT: "No",
            control.CMBCURTAINCOLOUR: "B6353-Grey",
            control.CMBELECSPEC: "Carwash",
        }

    if door_model in {"HS50", "HS65"}:
        return {
            control.CMBBRAKEIPBASIC: "IP65 Std",
            control.CMBBRUSHSEAL: "500 top of Guides (Std)",
            control.CMBCABLELENGTH: "7",
            control.CMBCONTROLLERENCLOSURE: "Std ABS IP54",
            control.CMBHEATTRACELEG: "",
            control.CMBWINDTRACK: "No",
            control.CMBMOTORSHROUD: "No",
            control.CMBPEBEAMS: "1 Level PE",
            control.CMBPOWERSUPPLY: "1P10A",
            control.CMBTRACKCONFIG: "",
            control.CMBTRAFFICLIGHT: "No",
            control.CMBFELTSEAL: "No",
            control.CMBELECSPEC: "Carwash",
        }

    if door_model == "MOVICHILL":
        return {
            control.CMBBRAKEIPBASIC: "IP65 Std",
            control.CMBBRUSHSEAL: "Full Guides & Fascia/Hood (Std)",
            control.CMBCABLELENGTH: "5",
            control.CMBCONTROLLERENCLOSURE: "Remax S/S IP66",
            control.CMBHEATTRACELEG: "Yes",
            control.CMBWINDTRACK: "No",
            control.CMBMOTORSHROUD: "No",
            control.CMBPEBEAMS: "1 Level PE",
            control.CMBPOWERSUPPLY: "1P15A",
            control.CMBTRACKCONFIG: "",
            control.CMBTRAFFICLIGHT: "No",
            control.CMBFELTSEAL: "Yes",
            control.CMBELECSPEC: "Carwash",
        }

    if door_model == "MOVICHILL-XL":
        return {
            control.CMBBRAKEIPBASIC: "IP65 Std",
            control.CMBBRUSHSEAL: "Full Guides & Fascia/Hood (Std)",
            control.CMBCABLELENGTH: "5",
            control.CMBCONTROLLERENCLOSURE: "Remax S/S IP66",
            control.CMBHEATTRACELEG: "Yes",
            control.CMBWINDTRACK: "No",
            control.CMBMOTORSHROUD: "No",
            control.CMBPEBEAMS: "1 Level PE",
            control.CMBPOWERSUPPLY: "3P15A",
            control.CMBTRACKCONFIG: "",
            control.CMBTRAFFICLIGHT: "No",
            control.CMBFELTSEAL: "Yes",
            control.CMBELECSPEC: "Carwash",
        }

    if door_model in {"CONCERTINA", "MOVIFOLD"}:
        return {
            control.CMBBRAKEIPBASIC: "IP65 Std",
            control.CMBBRUSHSEAL: "None",
            control.CMBCABLELENGTH: "7",
            control.CMBCONTROLLERENCLOSURE: "Remax Powdercoated IP66",
            control.CMBHEATTRACELEG: "",
            control.CMBWINDTRACK: "No",
            control.CMBMOTORSHROUD: "No",
            control.CMBPEBEAMS: "Light Curtain - 1830mm",
            control.CMBPOWERSUPPLY: "3P20A",
            control.CMBTRACKCONFIG: "Concealed",
            control.CMBTRAFFICLIGHT: "No",
            control.CMBFELTSEAL: "No",
            control.CMBELECSPEC: "Carwash",
        }

    return {
        control.CMBBRAKEIPBASIC: "",
        control.CMBBRUSHSEAL: "",
        control.CMBCABLELENGTH: "",
        control.CMBCONTROLLERENCLOSURE: "",
        control.CMBHEATTRACELEG: "",
        control.CMBWINDTRACK: "",
        control.CMBMOTORSHROUD: "",
        control.CMBPEBEAMS: "",
        control.CMBPOWERSUPPLY: "",
        control.CMBTRACKCONFIG: "",
        control.CMBTRAFFICLIGHT: "",
        control.CMBFELTSEAL: "No",
        control.CMBELECSPEC: "Carwash",
    }


def apply_default_selections(door_model: str, door_height: float = 0) -> dict[str, object]:
    defaults = get_default_selections(door_model, door_height)

    for control_name, control_value in defaults.items():
        st.session_state[control_name] = control_value

    return defaults
