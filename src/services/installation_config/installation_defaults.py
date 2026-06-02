from __future__ import annotations

import streamlit as st

from services.installation_config import installation_control_names as control


def get_default_selections(
    config_id: str,
    door_model: str,
    door_width: float,
    door_height: float,
    single_pair: str = "",
    door_spec: str = "",
    is_slider: bool = False,
) -> dict[str, object]:
    config_id = str(config_id or "").strip().upper()
    door_model = str(door_model or "").strip().upper()
    single_pair = str(single_pair or "").strip()
    door_spec = str(door_spec or "").strip().upper()

    defaults: dict[str, object] = {
        control.CMBCONFIGID: config_id,
        control.NUMPERSONINSTALL: 2,
        control.NUMACCOMNIGHT: 0,
        control.NUMTOTALDOORSPROJ: 1,
        control.NUMESTPROJECTSONRUN: 1,
    }

    if config_id.startswith("SWI-"):
        defaults[control.CHKISPAIR] = int(single_pair == "Pair")
        defaults[control.CHKALDISPEC] = int(door_spec.startswith("ALDI"))

    if config_id == "SWI-PVC-TEMPLATE":
        defaults[control.CHKINSSWIP if single_pair == "Pair" else control.CHKINSSWIS] = 1

    elif config_id == "SWI-THERMAL-TEMPLATE":
        if is_slider:
            defaults[control.CHKINSSLD] = 1
        elif single_pair == "Single" and "5000" in door_model:
            defaults[control.CHKINS50SWIS] = 1
        elif single_pair == "Pair" and "5000" in door_model:
            defaults[control.CHKINS50SWIP] = 1
        elif single_pair == "Pair":
            defaults[control.CHKINSSWIP] = 1
        else:
            defaults[control.CHKINSSWIS] = 1

    elif config_id == "RRD-MOVIDOR-TEMPLATE":
        if door_model in {"CONCERTINA", "MOVIFOLD"}:
            defaults[control.CHKINSHSDFOLDING] = 1
        elif float(door_width or 0) <= 4000 and float(door_height or 0) <= 4000:
            defaults[control.CHKINSRRD4X4] = 1
        else:
            defaults[control.CHKINSRRD6X6] = 1

    elif config_id == "STRIPDOOR-TEMPLATE":
        defaults[control.CHKINSSTRIPSM] = 1
        defaults[control.NUMSTRIPAREA] = (float(door_width or 0) / 1000) * (float(door_height or 0) / 1000)

    return defaults


def apply_default_selections(
    config_id: str,
    door_model: str,
    door_width: float,
    door_height: float,
    single_pair: str = "",
    door_spec: str = "",
    is_slider: bool = False,
) -> dict[str, object]:
    defaults = get_default_selections(
        config_id=config_id,
        door_model=door_model,
        door_width=door_width,
        door_height=door_height,
        single_pair=single_pair,
        door_spec=door_spec,
        is_slider=is_slider,
    )

    for control_name, control_value in defaults.items():
        st.session_state[control_name] = control_value

    return defaults
