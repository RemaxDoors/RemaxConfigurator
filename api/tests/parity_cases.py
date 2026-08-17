"""Shared fixtures for the pricing-move parity check.

The move must be behaviour-preserving, so the same inputs are fed to the old
location and the new one and the outputs compared exactly.
"""

# A stand-in price book — the rules only read price/cost/label, so fixed
# numbers make any behavioural difference show up as a structural diff.
PART_PRICES = {
    p: {"label": p, "price": 100.0, "cost": 60.0}
    for p in [
        "RRD-IXIO-LONGASS", "RRD-IXIO-SHASS", "SENS-IXIODT1", "RRD-COND-LONGASS",
        "RRD-COND-SHASS", "SENS-COND", "RRD-FALC-LONGASS", "RRD-FALC-SHASS",
        "SENS-FALC", "PCSW", "SENS-MAGSW-IW", "SENS-MAGSW-IP65",
        "RRD-ELREM2C-PC", "RRD-ELREM1C-PC", "RRD-ELREM1C", "RRD-ELREM2C",
        "RRD-ELREM4C", "RRD-ELREM8C", "RRD-GFA-BRAKEPUPG-IP66",
        "OPTION-RRD-MOTUPG-AGGRESSIVE", "OPTION-RRD-ENC-CONT403015-ABS",
        "OPTION-RRD-ENC-CONT403015-SS", "OPTION-RRD-ENC-CONT403015-RSS",
        "EL-UPS-1KVAASS", "EL-UPS-2KVAASS", "EL-UPS-3KVAASS", "RRD-PEBASS-D",
        "OPTION-SENS-FLASS", "OPTION-SENS-FLASS-EXISTING", "OPTION-RRD-HWTRK",
        "OPTION-RRD-FREEZERPACK", "OPTION-BBSUPG", "OPTION-POWDERCOAT",
        "OPTION-RRD-TLS-4PC", "OPTION-INDDR-TLS-2PCRM", "RRD-FASASS-ES40-3",
        "RRD-FASASS-ES40-4", "FLOOR LOOP CUTTING",
    ]
}

UPGRADE_CASES = [
    ("bare EX40", {
        "CMBDOORMODEL": "EX40", "NUMDOORWIDTH": 4000, "NUMDOORHEIGHT": 3000,
    }),
    ("EX40 + new floor loops + remotes", {
        "CMBDOORMODEL": "EX40", "NUMDOORWIDTH": 4000, "NUMDOORHEIGHT": 3000,
        "CMBACT1": "Induction Loop - Single", "NUMREMOTEQTY1": 0,
        "CMBACT2": "Elsema Remote - 4 Button", "NUMREMOTEQTY2": 3,
        "CMBACT3": "Magic Switch - In Wall", "NUMREMOTEQTY3": 2,
        "CMBACT4": "Pentacode - 2 Button", "NUMREMOTEQTY4": 6,
        "CMBRADAR1": "IXIO Sensor - Long Stalk",
        "CMBRADAR2": "Falcon Radar - No Stalk",
        "CMBCONTROLLERENCLOSURE": "Remax S/S IP66",
    }),
    ("existing loops, aggressive motor", {
        "CMBDOORMODEL": "MOVICHILL", "NUMDOORWIDTH": 5523, "NUMDOORHEIGHT": 4200,
        "CMBACT1": "Existing Induction Loop",
        "CHKMOTORCLEARCOAT": True, "CMBBRAKEIPBASIC": "IP66 Brake Cover",
        "CMBUPS": "2kVA Online", "CMBPEBEAMS": "2 Level PE",
        "CMBWINDTRACK": "Yes", "CMBHEATTRACEHOOD": "Yes",
    }),
    ("concertina, traffic lights, brush seal", {
        "CMBDOORMODEL": "CONCERTINA", "NUMDOORWIDTH": 6000, "NUMDOORHEIGHT": 5000,
        "CMBTRAFFICLIGHT": "Yes", "CMBBRUSHSEAL": "Nylon Brush",
        "CMBCOLOURFINISHTYPE": "Powdercoat", "CMBUPS": "3kVA Online",
    }),
    ("ES40 fascia, hyperlift", {
        "CMBDOORMODEL": "ES40", "NUMDOORWIDTH": 2800, "NUMDOORHEIGHT": 3000,
        "CMBES40FASCIA": "Yes", "CHKHYPERLIFT": True, "CHKHOLDOPEN": True,
        "CMBCONTROLLERENCLOSURE": "ABS Hi-Box IP66",
    }),
    ("empty configuration", {}),
]

INSTALL_CASES = [
    ("install job, movidor ES40 4x4", {
        "CMBJOBTYPE": "Install", "CMBDOORMODEL": "ES40",
        "NUMDOORWIDTH": 4000, "NUMDOORHEIGHT": 4000,
        "NUMDRIVINGTIME": 6, "NUMTOTALDOORSPROJ": 1, "NUMESTPROJECTSONRUN": 1,
        "TXTCONFIGID": "RRD-MOVIDOR-TEMPLATE",
    }),
    ("service job, strip seals", {
        "CMBJOBTYPE": "Service", "CMBDOORMODEL": "EX40",
        "NUMDOORWIDTH": 3000, "NUMDOORHEIGHT": 3000,
        "CHKINSSTRIPSM": True, "NUMDRIVINGTIME": 2,
        "NUMTOTALDOORSPROJ": 2, "NUMESTPROJECTSONRUN": 1,
    }),
    ("SWI pair, after hours", {
        "CMBJOBTYPE": "Install", "TXTCONFIGID": "SWI-THERMAL-TEMPLATE",
        "CHKISPAIR": True, "CHKINSAH": True,
        "NUMDOORWIDTH": 4000, "NUMDOORHEIGHT": 3500,
        "NUMDRIVINGTIME": 8, "NUMTOTALDOORSPROJ": 4, "NUMESTPROJECTSONRUN": 2,
    }),
    ("empty configuration", {}),
]
