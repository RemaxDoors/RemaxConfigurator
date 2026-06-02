from services.data_mapping import contains, get_value, is_true, starts_with


def validate_movidor_config(data: dict) -> list[dict]:
    errors = []
    warnings = []

    door_model = str(get_value(data, "CMBDOORMODEL", "")).upper()
    height = float(get_value(data, "NUMDOORHEIGHT", 0) or 0)
    width = float(get_value(data, "NUMDOORWIDTH", 0) or 0)

    # 1. HS35-Thermic max height
    if door_model == "HS35-THERMIC" and height > 4000:
        errors.append({
            "field": "NUMDOORHEIGHT",
            "message": (
                "4000mm Build Height Max for HS35-Thermic. "
                "Delaminating / Scrubbing issue identified beyond this."
            ),
        })

    # 2. Moisture requires weatherproof enclosure
    if contains(data, "CMBCONTROLMOIST", "Yes") and contains(data, "CMBCONTROLLERENCLOSURE", "IP54"):
        errors.append({
            "field": "CMBCONTROLLERENCLOSURE",
            "message": (
                "Controller is exposed to moisture. "
                "Enclosure upgrade to weatherproof box is required."
            ),
        })

    # 3. Traffic light + interlock needs weatherproof enclosure
    if (
        contains(data, "CMBTRAFFICLIGHT", "Yes")
        and is_true(data, "CHKINTERLOCK")
        and contains(data, "CMBCONTROLLERENCLOSURE", "IP54")
        and get_value(data, "CMBCARONAOPTION", "") != "SEW Motor - Carona Supply"
    ):
        errors.append({
            "field": "CMBCONTROLLERENCLOSURE",
            "message": (
                "Traffic lights and interlock are selected. "
                "Enclosure upgrade to weatherproof box is required."
            ),
        })

    # 4. Heat trace requires weatherproof enclosure
    if (
        (
            get_value(data, "CMBHEATTRACEHOOD", "") == "Yes"
            or get_value(data, "CMBHEATTRACELEG", "") == "Yes"
        )
        and contains(data, "CMBCONTROLLERENCLOSURE", "IP54")
    ):
        errors.append({
            "field": "CMBCONTROLLERENCLOSURE",
            "message": (
                "Door model has heat trace selected. "
                "Enclosure upgrade to weatherproof box is required."
            ),
        })

    # 5. Hyperlift requires Carwash electrical spec
    if is_true(data, "CHKHYPERLIFT") and get_value(data, "CMBELECSPEC", "") != "Carwash":
        errors.append({
            "field": "CMBELECSPEC",
            "message": "Hyperlift doors must use 'Carwash' electrical spec.",
        })

    # 6. EX35 too short for light curtains
    if (
        height < 2000
        and contains(data, "CMBPEBEAMS", "Curtain")
        and door_model == "EX35"
    ):
        errors.append({
            "field": "CMBPEBEAMS",
            "message": "Door is too short to have light curtains. Please select PE Slimline Beams.",
        })

    # 7. Hyperlift cannot use gearbox heater
    if is_true(data, "CHKHYPERLIFT") and get_value(data, "CMBGEARBOXHEATER", "") == "Yes":
        errors.append({
            "field": "CMBGEARBOXHEATER",
            "message": "Unable to put gearbox heater on Hyperlift. GFA motor required.",
        })

    # 8. Hyperlift cannot use motor clear coat
    if is_true(data, "CHKHYPERLIFT") and is_true(data, "CHKMOTORCLEARCOAT"):
        errors.append({
            "field": "CHKMOTORCLEARCOAT",
            "message": "Unable to put Clear Coat upgrade on Hyperlift. GFA motor required.",
        })

    # 9. Push button in column not allowed for EX / Movifold / Concertina
    if (
        door_model in ["EX35", "EX45", "MOVIFOLD", "CONCERTINA"]
        and contains(data, "CMBPED1", "Column")
    ):
        errors.append({
            "field": "CMBPED1",
            "message": "Unable to put Push Button in Door Column. Change to J-Box.",
        })

    # 10. Floor slope amount needs direction
    floor_slope_amount = get_value(data, "NUMFLOORSLOPE", "")
    floor_slope_direction = get_value(data, "CMBFLOORSLOPE", "")

    if (
        floor_slope_amount not in ["", 0, "0", None]
        and floor_slope_direction in ["", "No Slope", None]
    ):
        errors.append({
            "field": "CMBFLOORSLOPE",
            "message": "Slope detail missing. Choose slope direction or set slope to 0mm.",
        })

    # 11. EX35/EX45 on insulated panel needs Ramset fixing
    if (
        door_model in ["EX35", "EX45"]
        and get_value(data, "CMBWALLCONST", "") == "Insulated Panel"
        and get_value(data, "CMBLEGFIXING", "") not in [
            "",
            "M10 SS Allthread & Sleeve & Ramset Wall Anchor",
        ]
        and get_value(data, "CMBJOBTYPE", "") in ["Install", "Supply Only - With Fixings"]
    ):
        errors.append({
            "field": "CMBLEGFIXING",
            "message": (
                "EX35 mounted to ICP Panel needs Ramset in leg fixings. "
                "Please change leg to wall fixings."
            ),
        })

    # 12. UPS requires single phase power
    ups = str(get_value(data, "CMBUPS", "") or "")

    if ups not in ["", "No UPS"] and not starts_with(data, "CMBPOWERSUPPLY", "1P"):
        errors.append({
            "field": "CMBPOWERSUPPLY",
            "message": "UPS is selected. Power Supply must be Single Phase.",
        })

    # 13. 1kVA UPS only allowed for EX35 / EX45 / ES40
    if ups == "1kVA UPS - 10A" and door_model not in ["EX35", "EX45", "ES40"]:
        errors.append({
            "field": "CMBUPS",
            "message": "1kVA UPS can only be used on ES40/EX35/EX45. Upgrade to larger UPS.",
        })

    # 14. 1kVA UPS does not suit 5.250 motor
    if (
        door_model in ["EX35", "EX45", "ES40"]
        and ups == "1kVA UPS - 10A"
        and get_value(data, "CMBMOTORFILTER", "") == "5.250"
    ):
        errors.append({
            "field": "CMBUPS",
            "message": "UPS does not suit. 1kVA is for 3.350 only. Change to 2kVA.",
        })

    # 15. Induction loop warning
    induction_selected = any(
        "Induction" in str(get_value(data, f"CMBACT{i}", ""))
        for i in range(1, 5)
    )

    if induction_selected and contains(data, "CMBCONTROLLERENCLOSURE", "IP54"):
        warnings.append({
            "field": "CMBCONTROLLERENCLOSURE",
            "message": (
                "Floor Loop has been selected. "
                "Enclosure upgrade to ABS Hi-Box or Stainless Steel is recommended."
            ),
        })

    # 16. Concertina area warnings
    area_m2 = (height / 1000) * (width / 1000)

    if door_model == "CONCERTINA" and area_m2 > 80:
        warnings.append({
            "field": "NUMDOORHEIGHT",
            "message": "Max size for Concertina is 80m². Seek technical advice before quoting.",
        })

    if door_model == "CONCERTINA" and area_m2 > 60:
        warnings.append({
            "field": "NUMDOORHEIGHT",
            "message": "Concertina speeds and wind loads are restricted for sizes over 60m².",
        })

    # 17. Hyperlift must be single phase
    if is_true(data, "CHKHYPERLIFT") and contains(data, "CMBPOWERSUPPLY", "3P"):
        errors.append({
            "field": "CMBPOWERSUPPLY",
            "message": "Hyperlift must be single phase supply.",
        })

    # 18. Thermic curtain cannot be used in freezer
    if (
        "THERMIC" in door_model
        and (
            contains(data, "CMBTEMPDSIDE", "Freezer")
            or contains(data, "CMBTEMPNONDSIDE", "Freezer")
        )
    ):
        errors.append({
            "field": "CMBDOORMODEL",
            "message": (
                "THERMIC Curtains should not be installed on freezers. "
                "Fabric goes brittle."
            ),
        })
    return {
        "errors": errors,
        "warnings": warnings,
        "is_valid": len(errors) == 0,
    }
