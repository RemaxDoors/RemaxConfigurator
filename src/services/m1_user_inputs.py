import pandas as pd


def build_m1_user_inputs(control_values: dict) -> pd.DataFrame:
    """
    Converts app control values into M1 User Inputs format.

    Input:
        {
            "CMBDOORMODEL": "ES40",
            "NUMDOORHEIGHT": 3000,
            "CHKHYPERLIFT": 1,
        }

    Output DataFrame:
        xaiControlName | xaiValue
        CMBDOORMODEL   | ES40
        NUMDOORHEIGHT  | 3000
        CHKHYPERLIFT   | 1
    """

    rows = []

    for control_name, value in control_values.items():
        if value in [None, ""]:
            continue

        rows.append({
            "xaiControlName": control_name,
            "xaiValue": value,
        })

    return pd.DataFrame(rows)