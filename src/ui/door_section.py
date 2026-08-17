import pandas as pd
import streamlit as st
from services.movidor_door_config.movidor_option_registery import M1_OPTIONS
from services.data_mapping import mapped_select
from services.movidor_door_config.movidor_validation_rules import validate_movidor_config
from services.movidor_door_config.movidor_control_names import (
    HIDDEN_DEFAULT_CONTROL_NAMES,
    CHKHOLDOPEN,
    NUMREMOTEQTY1,
    NUMREMOTEQTY2,
    NUMREMOTEQTY3,
    NUMREMOTEQTY4,
)
from services.movidor_door_config.movidor_default_defaults import apply_default_selections
from services.installation_config import installation_control_names as install_control


FREIGHT_RATES = {
    "VIC": 0.5,
    "TAS": 1.4,
    "NSW": 0.6,
    "SA": 0.7,
    "QLD": 0.9,
    "WA": 1.4,
    "NT": 1.8,
}

# (control_key, label, qty_control or None)
_ACTIVATION_ROWS = [
    ("CMBPED1",          "Pedestrian Button 1",  None),
    ("CMBPED2",          "Pedestrian Button 2",  None),
    ("CMBRADAR1",        "Door Side Radar",       None),
    ("CMBRADAR2",        "Non-Door Side Radar",   None),
    ("CMBACT1",          "Activation 1",          NUMREMOTEQTY1),
    ("CMBACT2",          "Activation 2",          NUMREMOTEQTY2),
    ("CMBACT3",          "Activation 3",          NUMREMOTEQTY3),
    ("CMBACT4",          "Activation 4",          NUMREMOTEQTY4),
]


# ---------------------------------------------------------------------------
# Freight
# ---------------------------------------------------------------------------

def _calculate_freight_allowance(door_height: float, door_width: float, freight_rate: float) -> float:
    longest_dimension = (max(float(door_height or 0), float(door_width or 0)) + 500) / 1000
    volume_factor = 360 * longest_dimension * 0.8 * 0.8
    return volume_factor * float(freight_rate or 0)


def _render_freight_tab(door_height: float, door_width: float) -> None:
    current_rate = float(st.session_state.get(install_control.CMBFREIGHTRATE, FREIGHT_RATES["VIC"]) or FREIGHT_RATES["VIC"])
    current_state = next(
        (state for state, rate in FREIGHT_RATES.items() if float(rate) == current_rate),
        "VIC",
    )
    freight_state = st.selectbox(
        "State / Freight Rate",
        options=list(FREIGHT_RATES.keys()),
        index=list(FREIGHT_RATES.keys()).index(current_state),
        key="CMBFREIGHTRATE_STATE",
    )
    st.session_state[install_control.CMBFREIGHTRATE] = FREIGHT_RATES[freight_state]

    if st.button("Calculate Freight", use_container_width=True):
        st.session_state[install_control.NUMFREIGHTALLOWANCE] = _calculate_freight_allowance(
            door_height, door_width, FREIGHT_RATES[freight_state],
        )

    st.number_input(
        "Freight Allowance ($)",
        min_value=0.0,
        step=1.0,
        key=install_control.NUMFREIGHTALLOWANCE,
    )


# ---------------------------------------------------------------------------
# Validation messages
# ---------------------------------------------------------------------------

def _render_validation_messages(validation_errors: list[dict], validation_warnings: list[dict]) -> None:
    for err in validation_errors:
        st.markdown(
            f"""<div style="border-left:6px solid #dc2626;background:#fef2f2;color:#7f1d1d;
                padding:8px 12px;margin:4px 0;border-radius:6px;">
                <strong>{err.get('field','General')}</strong><br>{err['message']}</div>""",
            unsafe_allow_html=True,
        )
    for warn in validation_warnings:
        st.markdown(
            f"""<div style="border-left:6px solid #f59e0b;background:#fffbeb;color:#78350f;
                padding:8px 12px;margin:4px 0;border-radius:6px;">
                <strong>{warn.get('field','General')}</strong><br>{warn['message']}</div>""",
            unsafe_allow_html=True,
        )


# ---------------------------------------------------------------------------
# Activations
# ---------------------------------------------------------------------------

def _activation_requires_quantity(activation_value: str) -> bool:
    v = str(activation_value or "").strip()
    return any(k in v for k in ("Remote", "Pentacode", "Magic Switch", "Switch"))


def _render_remote_quantity(activation_value: str, qty_key: str, label: str) -> int:
    if not _activation_requires_quantity(activation_value):
        st.session_state[qty_key] = 0
        return st.number_input(label, min_value=0, value=0, step=1, key=qty_key, disabled=True)

    if int(st.session_state.get(qty_key, 0) or 0) <= 0:
        st.session_state[qty_key] = 1

    return st.number_input(label, min_value=1, step=1, key=qty_key)


def _render_activations_tab() -> dict:
    """Renders all activation controls in a compact loop and returns their values."""
    values = {}
    for ctrl_key, label, qty_key in _ACTIVATION_ROWS:
        if qty_key:
            act_col, qty_col = st.columns([4, 1], vertical_alignment="bottom")
            with act_col:
                result = mapped_select(
                    label=label,
                    field_name=ctrl_key,
                    options_registry=M1_OPTIONS,
                    key=ctrl_key,
                    default_value=st.session_state.get(ctrl_key, ""),
                )
            values[ctrl_key] = result["value"]
            with qty_col:
                values[qty_key] = _render_remote_quantity(result["value"], qty_key, "Qty")
        else:
            result = mapped_select(
                label=label,
                field_name=ctrl_key,
                options_registry=M1_OPTIONS,
                key=ctrl_key,
                default_value=st.session_state.get(ctrl_key, ""),
            )
            values[ctrl_key] = result["value"]

    st.divider()
    floor_loop = mapped_select(
        label="Floor Loop Installation",
        field_name="CMBFLOORLOOPINSTALL",
        options_registry=M1_OPTIONS,
        key="CMBFLOORLOOPINSTALL",
        default_value=st.session_state.get("CMBFLOORLOOPINSTALL", ""),
    )
    values["CMBFLOORLOOPINSTALL"] = floor_loop["value"]
    return values


# ---------------------------------------------------------------------------
# Main render
# ---------------------------------------------------------------------------

def render_door_section(mapped_select, price_lookup):

    # ── Top row: model, height, width ────────────────────────────────────
    top1, top2, top3 = st.columns([1, 1.5, 1])
    with top1:
        door_model = mapped_select(
            "Select Door Model", "CMBDOORMODEL", M1_OPTIONS, key="CMBDOORMODEL",
            default_value=st.session_state.get("CMBDOORMODEL", ""),
            mandatory=True,
        )
        door_model_label = door_model["label"]
        door_model_value = door_model["value"]

    with top2:
        NUMDOORHEIGHT = st.number_input(
            "Door Height (mm)", min_value=0,
            value=int(st.session_state.get("NUMDOORHEIGHT", 0)),
            placeholder="Height",
        )
    with top3:
        NUMDOORWIDTH = st.number_input(
            "Door Width (mm)", min_value=0,
            value=int(st.session_state.get("NUMDOORWIDTH", 0)),
            placeholder="Width",
        )

    # ── Inline metrics bar ───────────────────────────────────────────────
    door_sell_price = None
    if door_model_value and NUMDOORWIDTH > 0 and NUMDOORHEIGHT > 0:
        door_sell_price = price_lookup.get_door_sell_price(
            door_model=door_model_value,
            width=NUMDOORWIDTH,
            height=NUMDOORHEIGHT,
        )
        m1, m2, m3 = st.columns(3)
        m1.metric("Model", door_model_label)
        m2.metric("Dimensions", f"{NUMDOORHEIGHT:,} H × {NUMDOORWIDTH:,} W mm")
        m3.metric("Base Door Price", f"${door_sell_price:,.2f}" if door_sell_price else "—")

    QTY = int(st.session_state.get("QTY", 1) or 1)

    if door_model_value and st.session_state.get("LAST_DEFAULT_DOOR_MODEL") != door_model_value:
        apply_default_selections(door_model_value, NUMDOORHEIGHT)
        st.session_state["LAST_DEFAULT_DOOR_MODEL"] = door_model_value
        st.rerun()

    validation_placeholder = st.empty()

    # ── Determine model flags for conditional sections ───────────────────
    model_upper = str(door_model_value or "").upper()
    is_es40       = "ES40" in model_upper
    is_thermic    = "THERMIC" in model_upper or "MOVICHILL" in model_upper
    windtrack_supported = any(m in model_upper for m in ("HS50", "HS35", "HS65", "MOVICHILL"))

    # ── Tabs ─────────────────────────────────────────────────────────────
    tab_overview, tab_upgrades, tab_activations, tab_freight = st.tabs(
        ["🔧 Overview", "⚙️ Upgrades", "🎛️ Activations", "🚚 Freight"]
    )

    # ── Overview tab ─────────────────────────────────────────────────────
    with tab_overview:
        ov1, ov2 = st.columns(2)
        with ov1:
            cmbGPOISO = mapped_select(
                label="GPO / Isolator", field_name="CMBGPOISO", options_registry=M1_OPTIONS,
                key="CMBGPOISO", default_value=st.session_state.get("CMBGPOISO", ""), mandatory=True,
            )
            motor_oride = mapped_select(
                label="Hand Crank / Chain Drive", field_name="CMBMOTORORIDE", options_registry=M1_OPTIONS,
                key="CMBMOTORORIDE", default_value=st.session_state.get("CMBMOTORORIDE", ""),
            )
            track_config = mapped_select(
                label="Tracks Proud / Conc?", field_name="CMBTRACKCONFIG", options_registry=M1_OPTIONS,
                key="CMBTRACKCONFIG", mandatory=True, default_value=st.session_state.get("CMBTRACKCONFIG", ""),
            )
            windtrack_registry = M1_OPTIONS.copy()
            windtrack_registry["CMBWINDTRACK"] = (
                [{"value": "", "label": ""}, {"value": "Yes", "label": "Yes"}, {"value": "No", "label": "No"}]
                if windtrack_supported else
                [{"value": "", "label": ""}, {"value": "Not Available", "label": "Not Available"}, {"value": "No", "label": "No"}]
            )
            wind_track = mapped_select(
                label="High Wind Tracks Required", field_name="CMBWINDTRACK",
                options_registry=windtrack_registry, key="CMBWINDTRACK",
                default_value=st.session_state.get("CMBWINDTRACK", ""), mandatory=True,
            )
        with ov2:
            cmbElecSpec = mapped_select(
                label="Electrical Spec", field_name="CMBELECSPEC", options_registry=M1_OPTIONS,
                key="CMBELECSPEC", default_value=st.session_state.get("CMBELECSPEC", ""),
            )
            power_supply_registry = M1_OPTIONS.copy()
            if door_model_value == "ES40":
                power_supply_registry["CMBPOWERSUPPLY"] = [{"value": "1P10A", "label": "1-Ph 10A + N + E"}]
                st.session_state["CMBPOWERSUPPLY"] = "1P10A"
            cmbPowerSupply = mapped_select(
                label="Power Supply", field_name="CMBPOWERSUPPLY",
                options_registry=power_supply_registry, key="CMBPOWERSUPPLY",
                default_value=st.session_state.get("CMBPOWERSUPPLY", ""),
            )

    # ── Upgrades tab ─────────────────────────────────────────────────────
    with tab_upgrades:
        chk_col, drop1_col, drop2_col = st.columns([1, 1.5, 1.5])

        with chk_col:
            st.markdown("##### Options")
            CHKHYPERLIFT    = int(st.checkbox("Hyperlift Motor",        value=bool(st.session_state.get("CHKHYPERLIFT", 0)),    key="CHKHYPERLIFT"))
            chkHoldOpen     = int(st.checkbox("Hold Open Switch",       value=bool(st.session_state.get(CHKHOLDOPEN, 0)),       key=CHKHOLDOPEN))
            CHKINTERLOCK    = int(st.checkbox("Interlock",              value=bool(st.session_state.get("CHKINTERLOCK", 0)),    key="CHKINTERLOCK"))
            CHKSTAINLESS    = int(st.checkbox("Movisan (Stainless)",    value=bool(st.session_state.get("CHKSTAINLESS", 0)),    key="CHKSTAINLESS"))
            CHKEX35FELT     = int(st.checkbox("EX35 Felt",              value=bool(st.session_state.get("CHKEX35FELT", 0)),     key="CHKEX35FELT"))
            CHKMOTORCLEARCOAT = int(st.checkbox("Motor Clear Coat",     value=bool(st.session_state.get("CHKMOTORCLEARCOAT", 0)), key="CHKMOTORCLEARCOAT"))

        with drop1_col:
            st.markdown("##### Enclosure & Protection")
            controller_enclosure = mapped_select(
                label="Controller Enclosure", field_name="CmbControllerEnclosure",
                options_registry=M1_OPTIONS, key="CMBCONTROLLERENCLOSURE", mandatory=True,
                default_value=st.session_state.get("CMBCONTROLLERENCLOSURE", st.session_state.get("CmbControllerEnclosure", "")),
            )
            motor_shroud = mapped_select(
                label="Motor Shroud", field_name="CMBMOTORSHROUD", options_registry=M1_OPTIONS,
                key="CMBMOTORSHROUD", mandatory=True, default_value=st.session_state.get("CMBMOTORSHROUD", ""),
            )
            motor_spec = mapped_select(
                label="Brake / VSD Protection", field_name="CMBMOTORSPEC", options_registry=M1_OPTIONS,
                key="CMBMOTORSPEC", default_value=st.session_state.get("CMBMOTORSPEC", ""),
            )

            brushseal_registry = M1_OPTIONS.copy()
            if door_model_value in {"ES40", "HS25"}:
                brushseal_registry["CMBBRUSHSEAL"] = [
                    {"value": "None", "label": "None"},
                    {"value": "Full Guides (Std)", "label": "Full Guides (Std)"},
                    {"value": "Full Guides & Fascia/Hood", "label": "Full Guides & Fascia/Hood"},
                ]
            elif door_model_value in {"EX35", "EX45"}:
                brushseal_registry["CMBBRUSHSEAL"] = [
                    {"value": "None (Std)", "label": "None (Std)"},
                    {"value": "Fascia Only", "label": "Fascia Only"},
                    {"value": "Leg seal for Pressure Room Only", "label": "Leg seal for Pressure Room Only"},
                ]
            elif is_thermic:
                brushseal_registry["CMBBRUSHSEAL"] = [
                    {"value": "Full Guides & Fascia/Hood (Std)", "label": "Full Guides & Fascia/Hood (Std)"}
                ]
                st.session_state["CMBBRUSHSEAL"] = "Full Guides & Fascia/Hood (Std)"
            elif door_model_value in {"MOVIFOLD", "CONCERTINA"}:
                brushseal_registry["CMBBRUSHSEAL"] = [
                    {"value": "None", "label": "None"},
                    {"value": "Legs", "label": "Legs"},
                ]
            else:
                brushseal_registry["CMBBRUSHSEAL"] = [
                    {"value": "None", "label": "None"},
                    {"value": "500 top of Guides (Std)", "label": "500 top of Guides (Std)"},
                    {"value": "Guides Only", "label": "Full Guides Only"},
                    {"value": "Full Guides & Fascia/Hood", "label": "Full Guides & Fascia/Hood"},
                ]
            brushseal = mapped_select(
                label="Brush Seal", field_name="CMBBRUSHSEAL",
                options_registry=brushseal_registry, key="CMBBRUSHSEAL",
                default_value=st.session_state.get("CMBBRUSHSEAL", ""),
            )
            traffic_light = mapped_select(
                label="Traffic Light", field_name="CMBTRAFFICLIGHT", options_registry=M1_OPTIONS,
                key="CMBTRAFFICLIGHT", default_value=st.session_state.get("CMBTRAFFICLIGHT", ""),
            )
            pe_beam = mapped_select(
                label="PE Beam", field_name="CMBPEBEAMS", options_registry=M1_OPTIONS,
                key="CMBPEBEAMS", default_value=st.session_state.get("CMBPEBEAMS", ""),
            )

        with drop2_col:
            st.markdown("##### Extras & Finish")
            UPS = mapped_select(
                label="UPS", field_name="CMBUPS", options_registry=M1_OPTIONS,
                key="CMBUPS", default_value=st.session_state.get("CMBUPS", ""),
            )
            custsteel = mapped_select(
                label="Custom Steel Work", field_name="CMBCUSTSTEEL", options_registry=M1_OPTIONS,
                key="CMBCUSTSTEEL", default_value=st.session_state.get("CMBCUSTSTEEL", ""),
            )
            rearhoodbrushseal = mapped_select(
                label="Rear Hood Brush Seal", field_name="CMBREARHOODBRUSHSEAL", options_registry=M1_OPTIONS,
                key="CMBREARHOODBRUSHSEAL", default_value=st.session_state.get("CMBREARHOODBRUSHSEAL", ""),
            )
            specialconduit = mapped_select(
                label="Conduit", field_name="CMBSPECIALCONDUIT", options_registry=M1_OPTIONS,
                key="CMBSPECIALCONDUIT", default_value=st.session_state.get("CMBSPECIALCONDUIT", ""),
            )
            colourfinishtype = mapped_select(
                label="Powdercoat / Painting", field_name="CMBCOLOURFINISHTYPE", options_registry=M1_OPTIONS,
                key="CMBCOLOURFINISHTYPE", default_value=st.session_state.get("CMBCOLOURFINISHTYPE", ""),
            )

        # Model-specific sections — only rendered when relevant
        if is_es40:
            st.divider()
            st.markdown("##### ES40 Options")
            es_col1, es_col2 = st.columns(2)
            with es_col1:
                cmbES40Fascia = mapped_select(
                    label="Fascia", field_name="CMBES40FASCIA", options_registry=M1_OPTIONS,
                    key="CMBES40FASCIA", default_value=st.session_state.get("CMBES40FASCIA", ""),
                )
            with es_col2:
                cmbES40VSDMtr = mapped_select(
                    label="VSD Motor", field_name="CMBES40VSDMTR", options_registry=M1_OPTIONS,
                    key="CMBES40VSDMTR", default_value=st.session_state.get("CMBES40VSDMTR", ""),
                )
        else:
            cmbES40Fascia = {"value": st.session_state.get("CMBES40FASCIA", ""), "label": ""}
            cmbES40VSDMtr = {"value": st.session_state.get("CMBES40VSDMTR", ""), "label": ""}

        if is_thermic:
            st.divider()
            st.markdown("##### Thermic / Movichill Options")
            th_col1, th_col2, th_col3, th_col4 = st.columns(4)
            with th_col1:
                cmbHeatTraceLeg = mapped_select(
                    label="Heat Trace Legs", field_name="CMBHEATTRACELEG", options_registry=M1_OPTIONS,
                    key="CMBHEATTRACELEG", default_value=st.session_state.get("CMBHEATTRACELEG", ""),
                )
            with th_col2:
                cmbGearboxHeater = mapped_select(
                    label="Gearbox Heater", field_name="CMBGEARBOXHEATER", options_registry=M1_OPTIONS,
                    key="CMBGEARBOXHEATER", default_value=st.session_state.get("CMBGEARBOXHEATER", ""),
                )
            with th_col3:
                cmbHeatTraceHood = mapped_select(
                    label="In Hood", field_name="CMBHEATTRACEHOOD", options_registry=M1_OPTIONS,
                    key="CMBHEATTRACEHOOD", default_value=st.session_state.get("CMBHEATTRACEHOOD", ""),
                )
            with th_col4:
                cmbFeltSeal = mapped_select(
                    label="Felt Seal", field_name="CMBFELTSEAL", options_registry=M1_OPTIONS,
                    key="CMBFELTSEAL", default_value=st.session_state.get("CMBFELTSEAL", ""),
                )
        else:
            cmbHeatTraceLeg  = {"value": st.session_state.get("CMBHEATTRACELEG", ""),  "label": ""}
            cmbGearboxHeater = {"value": st.session_state.get("CMBGEARBOXHEATER", ""), "label": ""}
            cmbHeatTraceHood = {"value": st.session_state.get("CMBHEATTRACEHOOD", ""), "label": ""}
            cmbFeltSeal      = {"value": st.session_state.get("CMBFELTSEAL", ""),      "label": ""}

    # ── Activations tab ──────────────────────────────────────────────────
    with tab_activations:
        activation_values = _render_activations_tab()

    # ── Freight tab ──────────────────────────────────────────────────────
    with tab_freight:
        _render_freight_tab(NUMDOORHEIGHT, NUMDOORWIDTH)

    # ── Build controls dict & validate ───────────────────────────────────
    door_controls_values = {
        "CMBDOORMODEL":         door_model_value,
        "NUMDOORHEIGHT":        NUMDOORHEIGHT,
        "NUMDOORWIDTH":         NUMDOORWIDTH,
        "QTY":                  QTY,
        install_control.CMBFREIGHTRATE:      st.session_state.get(install_control.CMBFREIGHTRATE, FREIGHT_RATES["VIC"]),
        install_control.NUMFREIGHTALLOWANCE: st.session_state.get(install_control.NUMFREIGHTALLOWANCE, 0),
        "CMBGPOISO":            cmbGPOISO["value"],
        "CMBMOTORORIDE":        motor_oride["value"],
        "CMBTRACKCONFIG":       track_config["value"],
        "CMBWINDTRACK":         wind_track["value"],
        "CMBELECSPEC":          cmbElecSpec["value"],
        "CMBPOWERSUPPLY":       cmbPowerSupply["value"],
        "CMBCONTROLLERENCLOSURE": controller_enclosure["value"],
        "CMBMOTORSHROUD":       motor_shroud["value"],
        "CMBMOTORSPEC":         motor_spec["value"],
        "CMBBRUSHSEAL":         brushseal["value"],
        "CMBTRAFFICLIGHT":      traffic_light["value"],
        "CMBPEBEAMS":           pe_beam["value"],
        "CMBUPS":               UPS["value"],
        "CMBCUSTSTEEL":         custsteel["value"],
        "CMBREARHOODBRUSHSEAL": rearhoodbrushseal["value"],
        "CMBSPECIALCONDUIT":    specialconduit["value"],
        "CMBCOLOURFINISHTYPE":  colourfinishtype["value"],
        "CMBES40FASCIA":        cmbES40Fascia["value"],
        "CMBES40VSDMTR":        cmbES40VSDMtr["value"],
        "CMBHEATTRACELEG":      cmbHeatTraceLeg["value"],
        "CMBGEARBOXHEATER":     cmbGearboxHeater["value"],
        "CMBHEATTRACEHOOD":     cmbHeatTraceHood["value"],
        "CMBFELTSEAL":          cmbFeltSeal["value"],
        "CHKHYPERLIFT":         CHKHYPERLIFT,
        CHKHOLDOPEN:            chkHoldOpen,
        "CHKINTERLOCK":         CHKINTERLOCK,
        "CHKSTAINLESS":         CHKSTAINLESS,
        "CHKEX35FELT":          CHKEX35FELT,
        "CHKMOTORCLEARCOAT":    CHKMOTORCLEARCOAT,
        **activation_values,
    }

    for control_name in HIDDEN_DEFAULT_CONTROL_NAMES:
        door_controls_values[control_name] = st.session_state.get(control_name, "")

    validation_result = validate_movidor_config(door_controls_values)
    validation_errors   = validation_result.get("errors", [])
    validation_warnings = validation_result.get("warnings", [])

    if validation_errors or validation_warnings:
        with validation_placeholder.container():
            _render_validation_messages(validation_errors, validation_warnings)

    return {
        "door_controls_df":     pd.DataFrame([door_controls_values]),
        "door_controls_values": door_controls_values,
        "validation_result":    validation_result,
        "door_model_label":     door_model_label,
        "door_model_value":     door_model_value,
        "door_sell_price":      door_sell_price,
        "NUMDOORHEIGHT":        NUMDOORHEIGHT,
        "NUMDOORWIDTH":         NUMDOORWIDTH,
        "QTY":                  QTY,
        "brushseal_code":       brushseal["value"],
    }
import pandas as pd
import streamlit as st
from services.mapping_service import mapped_selectbox

# -----------------------------
# Door model, size and price - configurator selections
# -----------------------------
def render_door_section(Data_Mapping: dict, price_lookup):
    top1, top2, top3, top4, top5 = st.columns([1, 1.5, 1, 1, 1])

    with top1:
        door_model_label, door_model_code = mapped_selectbox(
            "Door Model",
            "CMBDOORMODEL",
            Data_Mapping,
            key="CMBDOORMODEL",
            default_label=st.session_state.get("CMBDOORMODEL", ""),
        )
    
    with top2:
        NUMDOORHEIGHT = st.number_input(
            "Door Height (mm)",
            min_value=0,
            value=int(st.session_state.get("NUMDOORHEIGHT", 0)),
            placeholder="Height"
        )

    with top3:
        NUMDOORWIDTH = st.number_input(
            "Door Width (mm)",
            min_value=0,
            value=int(st.session_state.get("NUMDOORWIDTH", 0)),
            placeholder="Width"
        )
    with top4:
        NUMCEILINGHEIGHT = st.number_input(
            "Ceiling Height (mm)",
            min_value=0,
            value=int(st.session_state.get("NUMCEILINGHEIGHT", 0)),
            placeholder="Ceiling Height"
        )

    door_sell_price = None
    if door_model_code and NUMDOORWIDTH > 0 and NUMDOORHEIGHT > 0:
        door_sell_price = price_lookup.get_door_sell_price(
            door_model=door_model_label,
            width=NUMDOORWIDTH,
            height=NUMDOORHEIGHT
        )
        
    with top5:
        st.markdown("**DoorSellPrice**")
        if door_sell_price:
            st.success(f"{door_sell_price:,.2f}")
        else:
            st.caption("Select model + size")

        QTY = st.number_input(
            "Quantity",
            min_value=1,
            value=int(st.session_state.get("QTY", 1)),
            step=1
        )
        

    # -----------------------------
    # overview
    # -----------------------------
    with st.expander("Configurations", expanded=True):
        con1, con2, con3 = st.columns(3, vertical_alignment="top")
        with con1:
            with st.expander("Overview", expanded=True):
                ov1, ov2, = st.columns([1.5,1], vertical_alignment="top")
                with ov1:
                        cmbGPOISO_label, cmbGPOISO_code = mapped_selectbox(
                           "GPO / Isolator",
                            "CMBGPOISO",
                            Data_Mapping,
                            key="CMBGPOISO",
                            default_label=st.session_state.get("CMBGPOISO", ""),
                            mandatory=True,
                        )
                        motor_oride_label, motor_oride_code = mapped_selectbox(
                            "Hand Crank / Chain Drive",
                            "CMBMOTORORIDE",
                            Data_Mapping,
                            key="CMBMOTORORIDE",
                            default_label=st.session_state.get("CMBMOTORORIDE", ""),
                        )
                        track_config_label, track_config_code = mapped_selectbox(
                            "Tracks Proud / Conc?",
                            "CMBTRACKCONFIG",
                            Data_Mapping,
                            key="CMBTRACKCONFIG",
                            default_label=st.session_state.get("CMBTRACKCONFIG", ""),
                        )
                        wind_track_label, wind_track_code = mapped_selectbox(
                            "High Wind Tracks Required",
                            "CMBWINDTRACK",
                            Data_Mapping,
                            key="CMBWINDTRACK",
                            default_label=st.session_state.get("CMBWINDTRACK", ""),
                        )

                with ov2:
                        cmbPowerSupply_label, cmbPowerSupply_code = mapped_selectbox(
                            "Power Supply",
                            "CMBPOWERSUPPLY",
                            Data_Mapping,
                            key="CMBPOWERSUPPLY",
                            default_label=st.session_state.get("CMBPOWERSUPPLY", ""),
                        )
                
        with con2:
                    # -----------------------------
                    # common options
                    # -----------------------------
            with st.expander("Upgrades / Common Options", expanded=True):
                up1, up2, up3, up4  = st.columns([1.25, 1.75, 1.5, 1.5], vertical_alignment="top")

                with up1:
                            
                            CHKHYPERLIFT = int(st.checkbox("Hyperlift Motor?", value=bool(st.session_state.get("CHKHYPERLIFT", 0)), key="CHKHYPERLIFT"))
                            CHKINTERLOCK = int(st.checkbox("Interlock?", value=bool(st.session_state.get("CHKINTERLOCK", 0)), key="CHKINTERLOCK"))
                            CHKSTAINLESS = int(st.checkbox("Movisan (Stainless Spec)", value=bool(st.session_state.get("CHKSTAINLESS", 0)), key="CHKSTAINLESS"))
                            CHKEX35FELT = int(st.checkbox("EX35 Felt", value=bool(st.session_state.get("CHKEX35FELT", 0)), key="CHKEX35FELT"))

                with up2:
                            controller_enclosure_label, controller_enclosure_code = mapped_selectbox(
                                "Controller Enclosure", "CMBCONTROLLERENCLOSURE", Data_Mapping, key="CMBCONTROLLERENCLOSURE",default_label=st.session_state.get("CMBCONTROLLERENCLOSURE", "")
                            )
                            motor_shroud_label, motor_shroud_code = mapped_selectbox(
                                "Motor Shroud", "CMBMOTORSHROUD", Data_Mapping, key="CMBMOTORSHROUD",default_label=st.session_state.get("CMBMOTORSHROUD", ""),
                            )
                            motor_spec_label, motor_spec_code = mapped_selectbox(
                                "Brake/VSD Protection", "CMBMOTORSPEC", Data_Mapping,   key="CMBMOTORSPEC",default_label=st.session_state.get("CMBMOTORSPEC", ""),
                            )
                            brushseal_label, brushseal_code = mapped_selectbox(
                                "Brush Seal", "CMBBRUSHSEAL", Data_Mapping, key="CMBBRUSHSEAL",default_label=st.session_state.get("CMBBRUSHSEAL", ""),
                            )
                            traffic_light_label, traffic_light_code = mapped_selectbox(
                                "Traffic Light", "CMBTRAFFICLIGHT", Data_Mapping,   key="CMBTRAFFICLIGHT",default_label=st.session_state.get("CMBTRAFFICLIGHT", ""),
                            )
                            pe_beam_label, PE_Beam_code = mapped_selectbox(
                                "PE Beam", "CMBPEBEAMS", Data_Mapping,   key="CMBPEBEAMS",default_label=st.session_state.get("CMBPEBEAMS", ""),
                            )

                with up3:
                            UPS_label, UPS_code = mapped_selectbox(
                                "UPS", "CMBUPS", Data_Mapping
                            )
                            custsteel_label, custsteel_code = mapped_selectbox(
                                "Custom Steel Work", "CMBCUSTSTEEL", Data_Mapping,   key="CMBCUSTSTEEL",default_label=st.session_state.get("CMBCUSTSTEEL", ""),
                            )
                            rearhoodbrushseal_label, rearhoodbrushseal_code = mapped_selectbox(
                                "Rear Hood Brush Seal", "CMBREARHOODBRUSHSEAL", Data_Mapping,   key="CMBREARHOODBRUSHSEAL",default_label=st.session_state.get("CMBREARHOODBRUSHSEAL", ""),
                            )
                            specialconduit_label, specialconduit_code = mapped_selectbox(
                                "Conduit", "CMBSPECIALCONDUIT", Data_Mapping,   key="CMBSPECIALCONDUIT",default_label=st.session_state.get("CMBSPECIALCONDUIT", ""),
                            )
                            colourfinishtype_label, colourfinishtype_code = mapped_selectbox(
                                "Powdercoat / Painting", "CMBCOLOURFINISHTYPE", Data_Mapping,   key="CMBCOLOURFINISHTYPE",default_label=st.session_state.get("CMBCOLOURFINISHTYPE", ""),
                            )
                with up4:
                            expand_es40 = False
                            expand_thermic_movi = False
                            if door_model_label and door_model_label != "":
                                model_upper = door_model_label.upper() 
                                
                                if "ES40" in model_upper:
                                    expand_es40 = True
                                if "THERMIC" in model_upper or "MOVICHILL" in model_upper:
                                    expand_thermic_movi = True

                            with st.expander("ES40 Only", expanded=expand_es40):
                                cmbES40Fascia_label, cmbES40Fascia_code = mapped_selectbox(
                                    "Fascia", "CMBES40FASCIA", Data_Mapping,key="CMBES40FASCIA",default_label=st.session_state.get("CMBES40FASCIA", ""),
                                )
                                cmbES40VSDMtr_LABEL, cmbES40VSDMtr_CODE = mapped_selectbox(
                                    "VSD Motor", "CMBES40VSDMTR", Data_Mapping,key="CMBES40VSDMTR",default_label=st.session_state.get("CMBES40VSDMTR", ""),
                                )
                            with st.expander("THERMIC+MOVICHILL ONLY", expanded=expand_thermic_movi):
                                    cmbHeatTraceLeg_label, cmbHeatTraceLeg_code = mapped_selectbox(
                                        "Heat Trace Legs", "CMBHEATTRACELEG", Data_Mapping,key="CMBHEATTRACELEG",default_label=st.session_state.get("CMBHEATTRACELEG", ""),
                                    )
                                    cmbGearboxHeater_label, cmbGearboxHeater_code = mapped_selectbox(
                                        "Gearbox Heater", "CMBGEARBOXHEATER", Data_Mapping,key="CMBGEARBOXHEATER",default_label=st.session_state.get("CMBGEARBOXHEATER", ""),
                                    )
                                    cmbHeatTraceHood_label, cmbHeatTraceHood_code = mapped_selectbox(
                                        "In Hood", "CMBHEATTRACEHOOD", Data_Mapping,key="CMBHEATTRACEHOOD",default_label=st.session_state.get("CMBHEATTRACEHOOD", ""),
                                    )
                                    cmbFeltSeal_label, cmbFeltSeal_code = mapped_selectbox(
                                        "Felt Seal", "CMBFELTSEAL", Data_Mapping,key="CMBFELTSEAL",default_label=st.session_state.get("CMBFELTSEAL", ""),
                                    )
            with con3:
                with st.expander("Activations", expanded=True):
                    CmbPed1_label, CmbPed1_code = mapped_selectbox(
                        "Pedestrian Button 1", "CMBPED1", Data_Mapping,key="CMBPED1",default_label=st.session_state.get("CMBPED1", ""),
                    )
                    CmbPed2_label, CmbPed2_code = mapped_selectbox(
                        "Pedestrian Button 2", "CMBPED2", Data_Mapping,key="CMBPED2",default_label=st.session_state.get("CMBPED2", ""),
                    )
                    CmbRadar1_label, CmbRadar1_code = mapped_selectbox(
                        "Door Side Radar", "CMBRADAR1", Data_Mapping,key="CMBRADAR1",default_label=st.session_state.get("CMBRADAR1", ""),
                    )
                    CmbRadar2_label, CmbRadar2_code = mapped_selectbox(
                        "Non Door Side Radar", "CMBRADAR2", Data_Mapping,key="CMBRADAR2",default_label=st.session_state.get("CMBRADAR2", ""),
                    )
                    CmbAct1_label, CmbAct1_code = mapped_selectbox(
                        "Activation 1", "CMBACT1", Data_Mapping,key="CMBACT1",default_label=st.session_state.get("CMBACT1", ""),
                    )
                    CmbAct2_label, CmbAct2_code = mapped_selectbox(
                        "Activation 2", "CMBACT2", Data_Mapping ,key="CMBACT2",default_label=st.session_state.get("CMBACT2", ""),
                    )
                    CmbAct3_label, CmbAct3_code = mapped_selectbox(
                        "Activation 3", "CMBACT3", Data_Mapping,key="CMBACT3",default_label=st.session_state.get("CMBACT3", ""),
                    )
                    CmbAct4_label, CmbAct4_code = mapped_selectbox(
                        "Activation 4", "CMBACT4", Data_Mapping,key="CMBACT4",default_label=st.session_state.get("CMBACT4", ""),
                    )
                    CmbFloorLoopInstall_label, CmbFloorLoopInstall_code = mapped_selectbox(
                        "Floor Loop Installation", "CMBFLOORLOOPINSTALL", Data_Mapping,key="CMBFLOORLOOPINSTALL",default_label=st.session_state.get("CMBFLOORLOOPINSTALL", ""),
                    )
                
    door_input_data = {
                    "NUMDOORHEIGHT": NUMDOORHEIGHT,
                    "NUMDOORWIDTH": NUMDOORWIDTH,
                    "NUMCEILINGHEIGHT": NUMCEILINGHEIGHT,               
                    "CMBDOORMODEL": door_model_code,
                    "DoorSellPrice": door_sell_price,
                    "CMBMOTORORIDE": motor_oride_code,
                    "CMBTRACKCONFIG": track_config_code,
                    "CMBWINDTRACK": wind_track_code,
                    "CMBCONTROLLERENCLOSURE": controller_enclosure_code,
                    "CMBMOTORSHROUD": motor_shroud_code,
                    "CMBMOTORSPEC": motor_spec_code,             
                    "CMBBRUSHSEAL": brushseal_code,
                    "CMBGPOISO": cmbGPOISO_code,
                    "CMBPOWERSUPPLY": cmbPowerSupply_code,
                    "CMBTRAFFICLIGHT": traffic_light_code,
                    "CMBPEBEAMS": PE_Beam_code,
                    "CHKHYPERLIFT": CHKHYPERLIFT,
                    "CHKINTERLOCK": CHKINTERLOCK,
                    "CHKSTAINLESS": CHKSTAINLESS,
                    "CHKEX35FELT": CHKEX35FELT,
                    "CMBUPS": UPS_code,
                    "CMBCUSTSTEEL": custsteel_code,
                    "CMBREARHOODBRUSHSEAL": rearhoodbrushseal_code,
                    "CMBSPECIALCONDUIT": specialconduit_code,
                    "CMBCOLOURFINISHTYPE": colourfinishtype_code,
                    "CMBES40FASCIA": cmbES40Fascia_code,         
                    "CMBES40VSDMTR": cmbES40VSDMtr_CODE,         
                    "CMBHEATTRACELEG": cmbHeatTraceLeg_code,     
                    "CMBGEARBOXHEATER": cmbGearboxHeater_code,   
                    "CMBHEATTRACEHOOD": cmbHeatTraceHood_code,   
                    "CMBFELTSEAL": cmbFeltSeal_code,
                    "CMBPED1": CmbPed1_code,
                    "CMBPED2": CmbPed2_code,
                    "CMBRADAR1": CmbRadar1_code,
                    "CMBRADAR2": CmbRadar2_code,
                    "CMBACT1": CmbAct1_code,
                    "CMBACT2": CmbAct2_code,
                    "CMBACT3": CmbAct3_code,
                    "CMBACT4": CmbAct4_code,
                    "CMBFLOORLOOPINSTALL": CmbFloorLoopInstall_code,
                    "QTY": QTY
                }
    export_data = {
                    "CMBDOORMODEL": door_model_label,
                    "NUMDOORHEIGHT": NUMDOORHEIGHT,
                    "NUMDOORWIDTH": NUMDOORWIDTH,
                    "NUMCEILINGHEIGHT": NUMCEILINGHEIGHT,
                    "CMBGPOISO": cmbGPOISO_label,
                    "CMBMOTORORIDE": motor_oride_label,
                    "CMBTRACKCONFIG": track_config_label,
                    "CMBWINDTRACK": wind_track_label,
                    "CMBPOWERSUPPLY": cmbPowerSupply_label,
                    "CMBCONTROLLERENCLOSURE": controller_enclosure_label,
                    "CMBMOTORSHROUD": motor_shroud_label,
                    "CMBMOTORSPEC": motor_spec_label,
                    "CMBBRUSHSEAL": brushseal_label,
                    "CMBTRAFFICLIGHT": traffic_light_label,
                    "CMBPEBEAMS": pe_beam_label,
                    "CMBUPS": UPS_label,
                    "CMBCUSTSTEEL": custsteel_label,
                    "CMBREARHOODBRUSHSEAL": rearhoodbrushseal_label,
                    "CMBSPECIALCONDUIT": specialconduit_label,
                    "CMBCOLOURFINISHTYPE": colourfinishtype_label,
                    "CHKHYPERLIFT": CHKHYPERLIFT,
                    "CHKINTERLOCK": CHKINTERLOCK,
                    "CHKSTAINLESS": CHKSTAINLESS,
                    "CHKEX35FELT": CHKEX35FELT,
                    "CMBES40FASCIA": cmbES40Fascia_label,
                    "CMBES40VSDMTR": cmbES40VSDMtr_LABEL,
                    "CMBHEATTRACELEG": cmbHeatTraceLeg_label,
                    "CMBGEARBOXHEATER": cmbGearboxHeater_label,
                    "CMBHEATTRACEHOOD": cmbHeatTraceHood_label,
                    "CMBFELTSEAL": cmbFeltSeal_label,
                    "CMBPED1": CmbPed1_label,
                    "CMBPED2": CmbPed2_label,
                    "CMBRADAR1": CmbRadar1_label,
                    "CMBRADAR2": CmbRadar2_label,
                    "CMBACT1": CmbAct1_label,
                    "CMBACT2": CmbAct2_label,
                    "CMBACT3": CmbAct3_label,
                    "CMBACT4": CmbAct4_label,
                    "CMBFLOORLOOPINSTALL": CmbFloorLoopInstall_label
                }

    door_df = pd.DataFrame([door_input_data])

    return {
            "door_input_data": door_input_data,
            "door_df": door_df,
            "export_data": export_data,
            "door_model_label": door_model_label,
            "door_model_code": door_model_code,
            "door_sell_price": door_sell_price,
            "NUMDOORHEIGHT": NUMDOORHEIGHT,
            "NUMDOORWIDTH": NUMDOORWIDTH,
        }