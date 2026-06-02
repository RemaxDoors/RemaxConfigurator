import streamlit as st
import pandas as pd
from st_aggrid import AgGrid, GridOptionsBuilder, GridUpdateMode


def get_value(data: dict, field: str, default=None):
    field_key = str(field).lower()

    for key, value in data.items():
        if str(key).lower() == field_key:
            return value

    return default


def contains(data: dict, field: str, text: str) -> bool:
    return text.lower() in str(get_value(data, field, "")).lower()


def starts_with(data: dict, field: str, text: str) -> bool:
    return str(get_value(data, field, "")).lower().startswith(text.lower())


def is_true(data: dict, field: str) -> bool:
    value = get_value(data, field, False)
    return value is True or str(value).strip().lower() in {"true", "1", "yes"}


def money(value) -> str:
    return f"${float(value or 0):,.2f}"


def percent(value) -> str:
    return f"{float(value or 0) * 100:.2f}%"


def selected_grid_row(df: pd.DataFrame, key: str, height: int = 240) -> dict | None:
    grid_builder = GridOptionsBuilder.from_dataframe(df)
    grid_builder.configure_selection("single", use_checkbox=True)
    grid_builder.configure_grid_options(domLayout="normal")

    grid_response = AgGrid(
        df,
        gridOptions=grid_builder.build(),
        update_mode=GridUpdateMode.SELECTION_CHANGED,
        fit_columns_on_grid_load=True,
        height=height,
        key=key,
    )

    selected_rows = grid_response.get("selected_rows", [])
    if selected_rows is None or len(selected_rows) == 0:
        return None

    if isinstance(selected_rows, pd.DataFrame):
        return selected_rows.iloc[0].to_dict()

    return selected_rows[0]


def normalize_rule_values(selected_values: dict) -> dict:
    normalized_values = selected_values.copy()

    for control_name, control_value in selected_values.items():
        if not str(control_name).upper().startswith("CHK"):
            continue

        if control_value is True or str(control_value).strip().lower() in {"1", "true", "yes"}:
            normalized_values[control_name] = "1"
        else:
            normalized_values[control_name] = "0"

    return normalized_values


def mapped_select(
    label: str,
    field_name: str,
    options_registry: dict,
    key: str | None = None,
    default_value=None,
    mandatory: bool = False,
) -> dict:
    """
    Creates a Streamlit selectbox linked to the M1 data mapping registry.

    Returns:
        {
            "field": "CMBDOORMODEL",
            "value": "M1 Value",
            "label": "Display Label"
        }
    """

    options = options_registry.get(field_name, [])

    if not options:
        st.warning(f"No options found for field: {field_name}")

        fallback_value = default_value or ""

        st.session_state[field_name] = fallback_value

        return {
            "field": field_name,
            "value": fallback_value,
            "label": fallback_value,
        }

    widget_key = key or field_name

    values = [opt["value"] for opt in options]

    labels_by_value = {
        opt["value"]: opt.get("label", opt["value"])
        for opt in options
    }

    index = values.index(default_value) if default_value in values else 0
    selected_value = st.selectbox(
        label,
        options=values,
        index=index,
        key=widget_key,
        format_func=lambda value: labels_by_value.get(value, str(value)),
    )

    selected_label = labels_by_value.get(selected_value, selected_value)
    value_key = f"{field_name}_VALUE"
    st.session_state[value_key] = selected_value

    if mandatory and selected_value in [None, ""]:
        st.error(f"{label} is required.")

    return {
        "field": field_name,
        "value": selected_value,   # M1 / pricing / formula value
        "label": selected_label,   # display/export readable label if needed
    }
