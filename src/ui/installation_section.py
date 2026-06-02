import pandas as pd
import streamlit as st

from services.data_mapping import get_value
from services.installation_config import installation_control_names as control
from services.installation_config.installation_defaults import apply_default_selections
from services.installation_config.installation_rules import build_installation_lines
from services.installation_config.installation_validation import validate_installation_config
from services.movidor_door_config import movidor_control_names as door_control
from services.movidor_door_config.movidor_option_registery import M1_OPTIONS


def render_installation_section(mapped_select, price_lookup=None) -> dict:
    door_model = str(st.session_state.get(door_control.CMBDOORMODEL, "") or "")
    door_height = float(st.session_state.get(door_control.NUMDOORHEIGHT, 0) or 0)
    door_width = float(st.session_state.get(door_control.NUMDOORWIDTH, 0) or 0)
    config_id = str(st.session_state.get("LINE_CONFIG_ID", "") or "")
    if not config_id and door_model:
        config_id = "RRD-MOVIDOR-TEMPLATE"
    st.session_state[control.CMBCONFIGID] = config_id

    job_type = str(st.session_state.get(control.CMBJOBTYPE, "") or "")
    _apply_defaults_if_needed(config_id, door_model, door_width, door_height, job_type)
    _normalize_installation_state()
    _normalize_text_state()

    st.header("Installation Configurator")
    with st.expander("Installation Options", expanded=True):
        top_col, rapid_col, misc_col, cost_col = st.columns([1.1, 1.1, 1.1, 1], vertical_alignment="top")

        with top_col:
            jobtype = mapped_select(
                label="Job Type",
                field_name=control.CMBJOBTYPE,
                options_registry=M1_OPTIONS,
                key=control.CMBJOBTYPE,
                default_value=st.session_state.get(control.CMBJOBTYPE, ""),
            )
            if jobtype.get("value") != "Install":
                st.session_state[control.CHKINSRRD4X4] = False
                st.session_state[control.CHKINSRRD6X6] = False

            st.text_input("Config ID", value=config_id, disabled=True, key="INSTALL_DISPLAY_CONFIG_ID")
            st.number_input("People on Install", min_value=0, step=1, key=control.NUMPERSONINSTALL)
            st.number_input("Total Doors in Project", min_value=0, step=1, key=control.NUMTOTALDOORSPROJ)
            st.number_input("Estimated Projects on Run", min_value=0, step=1, key=control.NUMESTPROJECTSONRUN)

        with rapid_col:
            st.markdown("##### Rapid Door")
            _checkbox("Rapid Door Installation - Up to 4x4", control.CHKINSRRD4X4)
            _checkbox("Rapid Door Installation - Above 4x4", control.CHKINSRRD6X6)
            _checkbox("Concertina/Movifold Door Installation", control.CHKINSHSDFOLDING)
            _checkbox("Removal of existing Rapid Door", control.CHKLABRRDREMOVAL)
            _checkbox("Disposal of existing Rapid Door", control.CHKLABRRDDISPOSAL)
            _checkbox("Install Pack", control.CHKINSPACK)

        with misc_col:
            st.markdown("##### Site / Misc")
            _checkbox("Site Assessment", control.CHKLABSITEASS)
            _checkbox("Site Attendance / Visit", control.CHKLABSITEATT)
            _checkbox("After Hours", control.CHKINSAH)
            _checkbox("Accommodation Required", control.CHKACCOM)
            _checkbox("Return Trip for connect + commission", control.CHKRETURNTRIP)
            _checkbox("Lifting Frame Required", control.CHKLIFTINGFRAME)
            _checkbox("Assa Door Removal Kit", control.CHKASSAREMOVAL)
            _checkbox("Spare Isolator Required", control.CHKSPAREISOLATOR)
            _checkbox("Roller Shutter Removal Kit", control.CHKROLLERSHUTTERREMOVAL)

        with cost_col:
            st.markdown("##### Cost Inputs")
            st.number_input("Driving Time (hours)", min_value=0.0, step=0.5, key=control.NUMDRIVINGTIME)
            st.number_input("Accommodation Nights", min_value=0, step=1, key=control.NUMACCOMNIGHT)
            st.metric("Freight Allowance", f"${float(st.session_state.get(control.NUMFREIGHTALLOWANCE, 0) or 0):,.2f}")
            if st.session_state.get(control.CHKRETURNTRIP):
                st.number_input("Return Trip Cost", min_value=0.0, step=1.0, key=control.NUMRETURN_COST)
            else:
                st.session_state[control.NUMRETURN_COST] = 0.0
            st.text_input("Lump Sum Description", key=control.TXTLUMPSUMDESC)
            st.number_input("Lump Sum Cost", min_value=0.0, step=1.0, key=control.NUMLUMSUM)

        installation_values = {
            **_get_installation_values(),
            control.CMBCONFIGID: config_id,
            "JOBTYPE_LABEL": jobtype.get("label", ""),
        }
        validation_result = validate_installation_config(installation_values)
        installation_lines = build_installation_lines(installation_values)

        if validation_result["errors"]:
            st.error("Installation has validation errors.")
            for error in validation_result["errors"]:
                st.markdown(f"- {error['message']}")

    installation_values = {
        **_get_installation_values(),
        control.CMBCONFIGID: config_id,
    }

    return {
        "installation_values": installation_values,
        "validation_result": validation_result,
        "installation_lines": installation_lines,
    }


def _apply_defaults_if_needed(
    config_id: str,
    door_model: str,
    door_width: float,
    door_height: float,
    job_type: str = "",
) -> None:
    signature = (config_id, door_model, door_width, door_height, job_type)
    if st.session_state.get("LAST_DEFAULT_INSTALLATION_SIGNATURE") == signature:
        return

    apply_default_selections(
        config_id=config_id,
        door_model=door_model,
        door_width=door_width,
        door_height=door_height,
    )
    st.session_state["LAST_DEFAULT_INSTALLATION_SIGNATURE"] = signature


def _normalize_installation_state() -> None:
    for control_name in control.CHECKBOX_CONTROL_NAMES:
        value = st.session_state.get(control_name, False)
        st.session_state[control_name] = value is True or str(value).strip().lower() in {"1", "true", "yes"}

    for control_name in control.NUMBER_CONTROL_NAMES:
        if control_name in {control.NUMFREIGHTALLOWANCE, control.CMBFREIGHTRATE}:
            continue

        value = st.session_state.get(control_name, 0)
        try:
            st.session_state[control_name] = float(value or 0)
        except (TypeError, ValueError):
            st.session_state[control_name] = 0.0

    st.session_state.setdefault(control.CMBJOBTYPE, "")


def _normalize_text_state() -> None:
    for control_name in (control.TXTLUMPSUMDESC, control.TXTSWINGINSTALLPARTID, control.CMBCONFIGID):
        value = st.session_state.get(control_name, "")
        if pd.isna(value):
            st.session_state[control_name] = ""
        else:
            st.session_state[control_name] = str(value)


def _checkbox(label: str, control_name: str) -> bool:
    return st.checkbox(label, key=control_name)


def _get_installation_values() -> dict:
    return {
        control_name: get_value(st.session_state, control_name, "")
        for control_name in control.INSTALLATION_CONTROL_NAMES
    }
