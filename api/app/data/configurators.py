"""The 7 configurators + rules, owned by the API.

This is the source of truth the Next app now reads (replacing its mock). Keys are
camelCase so the JSON matches the TypeScript types directly. The rules here mirror
the current catalogue; the real hard-coded rules (movidor_upgrade_rules.py, etc.)
are migrated into this structure incrementally.
"""

CONFIGURATORS: list[dict] = [
    {
        "id": "RRD-MOVIDOR-TEMPLATE",
        "name": "RRD Movidor",
        "doorTypeFilter": "RRD",
        "parameters": [
            {
                "controlName": "CMBDOORMODEL",
                "label": "Door model",
                "kind": "dropdown",
                "required": True,
                "options": [
                    {"value": "ES40", "label": "ES40"},
                    {"value": "HS50", "label": "HS50"},
                    {"value": "HS50-THERMIC", "label": "HS50 Thermic"},
                    {"value": "EX35", "label": "EX35"},
                ],
            },
            {"controlName": "NUMDOORHEIGHT", "label": "Door height (mm)", "kind": "number", "required": True, "min": 1000, "max": 10000, "step": 10},
            {"controlName": "NUMDOORWIDTH", "label": "Door width (mm)", "kind": "number", "required": True, "min": 1000, "max": 10000, "step": 10},
            {
                "controlName": "CMBUPS",
                "label": "UPS",
                "kind": "dropdown",
                "options": [
                    {"value": "", "label": "None"},
                    {"value": "1kVA", "label": "1 kVA"},
                    {"value": "3kVA", "label": "3 kVA"},
                ],
            },
            {"controlName": "CHKHYPERLIFT", "label": "Hyperlift", "kind": "checkbox", "defaultValue": False},
            {"controlName": "TXTSPECIALNOTES", "label": "Special notes", "kind": "text", "helpText": "Free-text notes passed to manufacturing."},
        ],
    },
    {
        "id": "SWI-PVC-TEMPLATE",
        "name": "PVC Swingdoor (2400/3000)",
        "doorTypeFilter": "SWI",
        "parameters": [
            {"controlName": "CMBDOORMODEL", "label": "Series", "kind": "dropdown", "required": True, "options": [{"value": "2400", "label": "2400 Series"}, {"value": "3000", "label": "3000 Series"}]},
            {"controlName": "NUMDOORHEIGHT", "label": "Door height (mm)", "kind": "number", "required": True, "min": 1000, "max": 6000, "step": 10},
            {"controlName": "NUMDOORWIDTH", "label": "Door width (mm)", "kind": "number", "required": True, "min": 600, "max": 4000, "step": 10},
            {"controlName": "CMBLEAF", "label": "Leaf configuration", "kind": "dropdown", "options": [{"value": "single", "label": "Single"}, {"value": "double", "label": "Double"}]},
            {"controlName": "CHKVISIONPANEL", "label": "Vision panel", "kind": "checkbox", "defaultValue": False},
        ],
    },
    {
        "id": "SWI-THERMAL-TEMPLATE",
        "name": "Thermal Swingdoor (4500/5000)",
        "doorTypeFilter": "SWI",
        "parameters": [
            {"controlName": "CMBDOORMODEL", "label": "Series", "kind": "dropdown", "required": True, "options": [{"value": "4500", "label": "4500 Series"}, {"value": "5000", "label": "5000 Series"}]},
            {"controlName": "NUMDOORHEIGHT", "label": "Door height (mm)", "kind": "number", "required": True, "min": 1000, "max": 6000, "step": 10},
            {"controlName": "NUMDOORWIDTH", "label": "Door width (mm)", "kind": "number", "required": True, "min": 600, "max": 4000, "step": 10},
            {"controlName": "CHKINSULATED", "label": "Insulated leaf", "kind": "checkbox", "defaultValue": True},
        ],
    },
    {
        "id": "RMX-ENTURI-TEMPLATE",
        "name": "Enturi",
        "doorTypeFilter": "ENT",
        "parameters": [
            {"controlName": "CMBDOORMODEL", "label": "Model", "kind": "dropdown", "required": True, "options": [{"value": "ENTURI", "label": "Enturi"}]},
            {"controlName": "NUMDOORHEIGHT", "label": "Door height (mm)", "kind": "number", "required": True, "min": 1000, "max": 8000, "step": 10},
            {"controlName": "NUMDOORWIDTH", "label": "Door width (mm)", "kind": "number", "required": True, "min": 1000, "max": 8000, "step": 10},
            {"controlName": "CMBFINISH", "label": "Finish", "kind": "dropdown", "options": [{"value": "MILL", "label": "Mill"}, {"value": "POWDERCOAT", "label": "Powdercoat"}]},
        ],
    },
    {
        "id": "STRIPDOOR-TEMPLATE",
        "name": "Stripdoor",
        "doorTypeFilter": "STRIP",
        "parameters": [
            {"controlName": "NUMDOORHEIGHT", "label": "Opening height (mm)", "kind": "number", "required": True, "min": 500, "max": 6000, "step": 10},
            {"controlName": "NUMDOORWIDTH", "label": "Opening width (mm)", "kind": "number", "required": True, "min": 500, "max": 6000, "step": 10},
            {"controlName": "CMBSTRIPTYPE", "label": "Strip type", "kind": "dropdown", "options": [{"value": "STANDARD", "label": "Standard PVC"}, {"value": "FREEZER", "label": "Freezer grade"}, {"value": "POLAR", "label": "Polar"}]},
            {"controlName": "NUMOVERLAP", "label": "Overlap (%)", "kind": "number", "min": 0, "max": 100, "step": 5},
        ],
    },
    {
        "id": "CURT-RRD",
        "name": "Curtain (RRD)",
        "parameters": [
            {"controlName": "CMBCURTAINCOLOUR", "label": "Curtain colour", "kind": "dropdown", "options": [{"value": "BLUE", "label": "Blue"}, {"value": "RED", "label": "Red"}, {"value": "YELLOW", "label": "Yellow"}, {"value": "CLEAR", "label": "Clear"}]},
            {"controlName": "NUMWINDOWSREQ", "label": "Windows required", "kind": "number", "min": 0, "max": 20, "step": 1},
            {"controlName": "CHKEMERGZIP", "label": "Emergency zip", "kind": "checkbox", "defaultValue": False},
            {"controlName": "CHKSLOPEREQUIRED", "label": "Floor slope", "kind": "checkbox", "defaultValue": False},
        ],
    },
    {
        "id": "INSTALLATION-TEMPLATE",
        "name": "Installation",
        "parameters": [
            {"controlName": "CMBJOBTYPE", "label": "Job type", "kind": "dropdown", "required": True, "options": [{"value": "SUPPLY_INSTALL", "label": "Supply & install"}, {"value": "SUPPLY_ONLY", "label": "Supply only"}]},
            {"controlName": "NUMPERSONINSTALL", "label": "Installers", "kind": "number", "min": 1, "max": 10, "step": 1},
            {"controlName": "NUMDRIVINGTIME", "label": "Driving time (hrs)", "kind": "number", "min": 0, "max": 24, "step": 0.5},
            {"controlName": "CHKINSAH", "label": "After-hours", "kind": "checkbox", "defaultValue": False},
            {"controlName": "CHKACCOM", "label": "Accommodation required", "kind": "checkbox", "defaultValue": False},
        ],
    },
]

RULES: list[dict] = [
    {"id": "r1", "configuratorId": "RRD-MOVIDOR-TEMPLATE", "name": "Hyperlift", "category": "ASSEMBLY_UPGRADE", "conditions": [{"controlName": "CHKHYPERLIFT", "operator": "is_checked", "value": ""}], "resultPartId": "RRD-HYPERLIFT-ASS", "quantity": "1", "isActive": True},
    {"id": "r2", "configuratorId": "RRD-MOVIDOR-TEMPLATE", "name": "1 kVA UPS", "category": "ASSEMBLY_UPGRADE", "conditions": [{"controlName": "CMBUPS", "operator": "equals", "value": "1kVA"}], "resultPartId": "EL-UPS-1KVAASS", "quantity": "1", "isActive": True},
    {"id": "r3", "configuratorId": "RRD-MOVIDOR-TEMPLATE", "name": "Wide-door wind track", "category": "MATERIAL_UPGRADE", "conditions": [{"controlName": "NUMDOORWIDTH", "operator": "greater_than", "value": "4000"}, {"controlName": "CMBWINDTRACK", "operator": "equals", "value": "Yes"}], "resultPartId": "RRD-WINDTRACK", "quantity": "1", "isActive": True},
    {"id": "r4", "configuratorId": "CURT-RRD", "name": "Emergency zip", "category": "MATERIAL_UPGRADE", "conditions": [{"controlName": "CHKEMERGZIP", "operator": "is_checked", "value": ""}], "resultPartId": "CURT-EMERG-ZIP", "quantity": "1", "isActive": True},
    {"id": "r5", "configuratorId": "INSTALLATION-TEMPLATE", "name": "After-hours labour", "category": "INSTALLATION", "conditions": [{"controlName": "CHKINSAH", "operator": "is_checked", "value": ""}], "resultPartId": "INS-AH-LABOUR", "quantity": "1", "isActive": False},
]
