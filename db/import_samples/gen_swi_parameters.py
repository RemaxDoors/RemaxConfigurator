"""Build the SWI-PVC-TEMPLATE parameter CSV from M1's SetArray blocks.

Option cell format (lib/param-csv.ts): segments joined by "|", each "value=label"
or bare "value" when the two match. A leading "|" is the blank/unselected option.
Written with csv.writer so labels containing commas get quoted properly.
"""
import csv

# The colour list M1 assigns to eight different controls.
COLOURS = ["", "Clear (Duraflex)", "Blue", "Black", "Grey",
           "Opaque (Texaflex Clear)", "Red"]

# aSign. M1 declares a blank at index 0 AND index 13; only one is kept --
# UQ_uCfgParameterOptions is (ParamID, OptionValue, OptionLabel), so a second
# blank/blank pair is a duplicate key and the import would fail on it.
SIGNS = [
    ("", ""),
    ("LBL-24TRUSS", "2400 Series, STAFF ONLY"),
    ("LBL-24IKEA", "IKEA - Keep Clear - Swinging Door"),
    ("LBL-24FCTMO", "Coles/Liquorland 2400 Series Dock Side, ASPWC"),
    ("LBL-24FCAS", "Coles/Liquorland 2400 Store, Team Members Only Series"),
    ("LBL-24FCAS", "First Choice 2400, Approach Slowly with Caution"),
    ("LBL-24FCTMO", "First Choice 2400, Team Members Only"),
    ("LBL-24KMART-ASPWC", "Kmart 2400 Series, ASPWC"),
    ("LBL-24KMART-TMO", "Kmart 2400, Team Members Only"),
    ("LBL-24SPOTDS", "Spotlight/Anaconda 2400 Dock Side, ASPWC"),
    ("LBL-24SPOTSS", "Spotlight/Anaconda 2400 Store Side, TMO"),
    ("LBL-24TARDS", "Target Dock Side, Open With Care"),
    ("LBL-24TARSS", "Target Store Side, Team Member Access"),
]

MOUNTING = [
    ("", ""),
    ("Hinge Plate", "Hinge Plate"),
    ("Gantry Frame", "Gantry Frame (needs to be built)"),
    ("Gantry SP", "Gantry Frame, Single Post (needs to be built)"),
    ("Existing Gantry", "Existing Gantry (no extra frame required)"),
    ("Existing Hinge Plate", "Existing Hinge Plate"),
    ("Steel Support Frame", "Steel Support Frame, 75x50mm RHS"),
]

WALL = ["", "Timber Frame", "Metal Stud", "Coolroom Panel", "Blockwork",
        "Precast", "Steel Frame", "Pressed Metal Frame", "ICP with Timber",
        "Pressed Metal w/Timber", "S/S Capping w/Timber"]

SPECIFICATION = ["", "Liquorland Store", "Liquorland W/House", "Coles",
                 "Spotlight", "Officeworks", "Richies", "Harris Scarfe",
                 "Rebel Sport", "Woolworths", "IGA", "Reject Shop",
                 "Not Specified"]


def opts(pairs):
    """pairs: list of (value, label) or plain strings where value == label."""
    segs = []
    for p in pairs:
        v, l = p if isinstance(p, tuple) else (p, p)
        segs.append(v if v == l else "{0}={1}".format(v, l))
    return "|".join(segs)


ROWS = [
    # --- unchanged from the existing file -----------------------------------
    ("CHKIMPACTBAND", "Impact Bands?", "Checkbox", "SIGNAGE", ""),
    ("CHKMK5REPLACE", "MK5 Premier?", "Checkbox", "REPLACEMENT PANEL OPTIONS", ""),
    ("CHKMTI90REPLACE", "MTI 90 Door?", "Checkbox", "REPLACEMENT PANEL OPTIONS", ""),
    ("CHKREPLACEPANEL", "Replacement Panels?", "Checkbox", "REPLACEMENT PANEL OPTIONS", ""),
    ("CHKCRATEREQUIRED", "Crate Required?", "Checkbox", "INSTALLATION", ""),
    ("CHKPWDCTSHS", "Support Frame (Remax Supply)", "Checkbox", "POWDERCOATING", ""),
    ("CHKVISIONBAND", "Vision Band?", "Checkbox", "VISION BAND DETAILS", ""),
    ("CHKSSSF", "Self Support Frame?", "Checkbox", "OVERVIEW", ""),
    ("CHKPWDCTDHWARE", "Door Hardware", "Checkbox", "POWDERCOATING", ""),
    ("CHKINSTALLATION", "Install Configured", "Checkbox", "INSTALLATION", ""),
    ("CHKMTI105REPLACE", "MTI 105 Door?", "Checkbox", "REPLACEMENT PANEL OPTIONS", ""),
    ("CHKREPLACEA", "Replace Left(A) Panel", "Checkbox", "REPLACEMENT PANEL OPTIONS", ""),
    ("CHKREPLACEB", "Replace Right(B) Panel", "Checkbox", "REPLACEMENT PANEL OPTIONS", ""),
    ("CHKMK6REPLACE", "MK6 Premier?", "Checkbox", "REPLACEMENT PANEL OPTIONS", ""),
    # CMBFREIGHTRATE has no SetArray block in M1 -- left exactly as it was.
    ("CMBFREIGHTRATE", "State / Freight Rate", "Dropdown", "Freight",
     "0.9=VIC|1.9=TAS|0.9002=NSW|0.9001=SA|1.5=QLD|1.9=WA|1.9001=NT"),
    ("NUMFREIGHTALLOWANCE", "Freight Allowance ($)", "Number", "Freight", ""),

    # --- existing rows, option lists brought in line with M1 -----------------
    # Each gains M1's leading blank (the unselected state).
    ("CMBSPRINGTYPE", "Spring Material", "Dropdown", "OVERVIEW",
     opts(["", "Stainless Steel", "Standard"])),
    ("CMBHOLDOPEN", "Hold Open", "Dropdown", "OVERVIEW",
     opts(["", "Single Store Side", "Single BOH Side", "Double"])),
    ("CMBSINGLEPAIR", "Single/Pair", "Dropdown", "OVERVIEW",
     opts(["", "Single", "Pair"])),
    ("CMBJOBTYPE", "Job Type", "Dropdown", "Freight",
     opts(["", "Delivery", "Install"])),
    # RENAMED: M1 is Controls("cmbDoorHandling"), so the control name is
    # CMBDOORHANDLING. The old file said CMBDOORHANDING (no L). Nothing in the
    # database or the codebase referenced either spelling, so this is safe.
    ("CMBDOORHANDLING", "Door Handing", "Dropdown", "OVERVIEW",
     opts(["", "Left (A)", "Right (B)"])),

    # --- new: had no row at all -------------------------------------------
    ("CMBDOORMODEL", "Door Model", "Dropdown", "OVERVIEW",
     opts([("", ""), ("2400", "2400 Series"),
           ("3000", "3000 Series (Service Only)"), ("3500", "3500 Series")])),
    ("CMBSTATE", "State (CNC)", "Dropdown", "OVERVIEW",
     opts([("NSW", "NSW CNC"), ("VIC", "VIC CNC")])),
    ("CMBSPECIFICATION", "Specification", "Dropdown", "OVERVIEW",
     opts(SPECIFICATION)),
    # M1 also sets Controls("cmbHingeType").Value = "Standard" -- that is a
    # DEFAULT, not an option, and belongs in uCfgDefaults. Not set by this file.
    ("CMBHINGETYPE", "Hinge Type", "Dropdown", "OVERVIEW",
     opts([("", ""), ("Standard", "Standard Hinge"),
           ("Quad Action", "Quad Action")])),
    ("CMBMOUNTINGTYPE", "Mounting Type", "Dropdown", "INSTALLATION",
     opts(MOUNTING)),
    ("CMBWALLCONSTRUCTION", "Wall Construction", "Dropdown", "INSTALLATION",
     opts(WALL)),

    ("CMBNUMLEVELS", "PVC Levels", "Dropdown", "PVC PANEL DETAILS",
     opts([("1", "1"), ("2", "2"), ("3", "3 (With Vision Band)")])),
    ("CMBTOPPVCCOLOUR", "Top PVC Colour", "Dropdown", "PVC PANEL DETAILS",
     opts(COLOURS)),
    ("CMBMIDPVCCOLOUR", "Mid PVC Colour", "Dropdown", "PVC PANEL DETAILS",
     opts(COLOURS)),
    ("CMBBOTTOMPVCCOLOUR", "Bottom PVC Colour", "Dropdown", "PVC PANEL DETAILS",
     opts(COLOURS)),
    # M1's own comment: "No Longer Used, only fill for historic reference".
    # Kept so an imported historic quote still has somewhere to land -- delete
    # this row if you would rather it never appeared on the form.
    ("CMBFULLPVCCOLOUR", "Full PVC Colour (historic)", "Dropdown",
     "PVC PANEL DETAILS", opts(COLOURS)),

    # numImpactBandQuantity is a NUM control, but M1 calls SetArray on it, so
    # it is a two-choice picklist rather than free entry -- Dropdown, not Number.
    ("NUMIMPACTBANDQUANTITY", "Impact Band Quantity", "Dropdown", "IMPACT BANDS",
     opts([("1", "1"), ("2", "2")])),
    ("CMBIMPACTBANDCOLOUR", "Impact Band Colour (Store)", "Dropdown",
     "IMPACT BANDS", opts(COLOURS)),
    ("CMBIMPACTBANDCOLOURBOH", "Impact Band Colour (BOH)", "Dropdown",
     "IMPACT BANDS", opts(COLOURS)),
    ("CMBIMPACTBANDCOLOUR2", "Impact Band 2 Colour (Store)", "Dropdown",
     "IMPACT BANDS", opts(COLOURS)),
    ("CMBIMPACTBANDCOLOUR2BOH", "Impact Band 2 Colour (BOH)", "Dropdown",
     "IMPACT BANDS", opts(COLOURS)),

    ("CMBSTORESIDESIGNS", "Store Side Sign", "Dropdown", "SIGNAGE", opts(SIGNS)),
    ("CMBDOCKSIDESIGNS", "Dock Side Sign", "Dropdown", "SIGNAGE", opts(SIGNS)),
]

OUT = r"C:\Users\GizemE\Documents\RemaxConfigurator\db\import_samples\swi_pvc_parameters.csv"
with open(OUT, "w", encoding="utf-8-sig", newline="\r\n") as fh:
    w = csv.writer(fh, lineterminator="\r\n")
    w.writerow(["Control Name", "Label", "Type", "Section", "Options"])
    for r in ROWS:
        w.writerow(list(r))

print("wrote", OUT)
print("rows:", len(ROWS))
