# 🚪 Remax Configurator — Rapid Door Estimator

A **Streamlit-based** door configurator and estimator built for the REMAX sales team.  
It replaces manual M1 configurator screens with a fast, rules-driven web interface that produces accurate, consistent pricing from live M1 SQL data.

---

## 🚀 Key Features

### 🔹 1. Multi-Line Estimate Builder
- Create and manage a full estimate with multiple door lines
- Each line stores its own configuration, pricing, and notes
- Edit, duplicate, or delete lines at any time
- Live **Estimate Total** across all lines
- Reseller discount applied per line

---

### 🔹 2. Door Configurator (RRD — Movidor)
Mirrors the M1 `PART-RRD-MOVIDOR-TEMPLATE` configurator with a modern tabbed layout:

| Tab | Controls |
|---|---|
| **Overview** | GPO/Isolator, Hand Crank, Track Config, Wind Track, Electrical Spec, Power Supply |
| **Upgrades** | Controller Enclosure, Motor Shroud, Brake/VSD, Brush Seal, Traffic Light, PE Beam, UPS, Custom Steel, Conduit, Powdercoat, Interlock, Hyperlift, Stainless, and more |
| **Activations** | Pedestrian Buttons, Radars, Activations 1–4 (with remote qty), Floor Loop |
| **Freight** | State-based freight rate calculator |

- **Inline metrics bar** shows Base Door Price, Model, and Dimensions instantly after selection
- **Model-specific sections** (ES40, Thermic/Movichill) only appear when relevant
- Live validation with field-level error and warning messages

---

### 🔹 3. Curtain Configurator
Mirrors `PART-CURT-RRD` logic with full Python port of M1 VBScript rules:

- Curtain colour, floor slope, finished height (left/right) and width — auto-calculated from door dimensions + correction factors
- **ES40 / BUGSTOP / CONCERTINA**: panel count calculated automatically (`ceil((height − 230) / 830)` for ES40; panel height formula for CONCERTINA)
- Window rows (up to 14), window types per model (Clear PVC, Mesh, Coloured Panel, Vision Clear/Mesh for panel doors)
- Add-ons: slope edge, drip edge, Como wear strip, custom bottom edge, emergency zip, screen printing, EX BV seal
- Curtain dimensions recalculate automatically when slope, track config, or wind track changes

---

### 🔹 4. Installation Configurator
Mirrors `PART-INSTALLATION-TEMPLATE` with a full quantity rule engine:

- Job Type, People, Total Doors in Project, Projects on Run, Driving Time, Accommodation
- **Auto-selects** correct installation checkbox on job type change:
  - `CHKINSRRD4X4` if width ≤ 4000 and height ≤ 4000
  - `CHKINSRRD6X6` otherwise
- Generic `calc_qty_per_assembly()` engine handles all unit types:
  - Per Door, Per Project, Per Leaf, Per Hour, Per Night
  - SWI-pair doubling and After-Hours (`CHKINSAH`) factor applied per part rule
- Part quantity rules table (`_PART_QTY_RULES`) — add new parts in one line

---

### 🔹 5. Live Pricing Engine
All prices fetched from live M1 SQL tables — no hardcoded price lists:

| Component | Source table |
|---|---|
| Base door sell price / cost | `uSellPriceMatrixs` |
| Curtain price (standard) | `uCurtainPrices` |
| ES40 / CONCERTINA panels | `uCurtainPrices` (per component) |
| Upgrade sell price / cost | `PartUnitSalePrices` |
| Installation part price / cost | `PartUnitSalePrices` |
| Curtain correction factors | `uRapidFormulas` |

**Price breakdown** per estimate line:

| Field | Description |
|---|---|
| Base Door Sell / Cost | From size matrix |
| Material Upgrades | Assembly + material options |
| Material Discount | Applicable discount lines |
| Installation / Site | Per-part × calculated quantity |
| Misc Extra | Free-form price + cost per door |
| Reseller Discount | % off door + upgrades subtotal |
| **Unit Sell / Cost / Margin** | Final rolled-up figures |
| **Total Sell** | Unit × Qty |

A **sticky sidebar** shows Unit Sell, Unit Cost, Margin, Qty, and Total Sell while scrolling through configuration.

---

### 🔹 6. Search & Reload Historical Configurations
Search across both **Quotes** and **Sales Orders** from M1:

- Search by customer name, quote/order ID, part ID, or description
- Results grid shows source, date, model, dimensions, sell price, cost, margin
- Double-click any row to **reload all M1 configurator values** into a new estimate line
- Works via `uTraining_SalesPricingView` — a unified view across `QuoteLines` and `SalesOrderLines`

---

### 🔹 7. Export to M1 Format
Generates an **Excel file** compatible with M1 parameter import structure:

- Sheet name: `M1ParameterList`
- Filters and exports only set controls (`CMB*`, `CHK*`, `NUM*`)
- Cell `G1` contains the parameter count for M1 import validation

---

## 🏗️ Architecture

```
src/
├── app.py                          # Entry point — routes estimate vs configurator mode
├── config.py                       # DB + API config from .env
├── repositories/
│   ├── sql_service.py              # SQLAlchemy engine
│   ├── pricing_lookup.py           # All price lookups + dimension calculations
│   ├── quote_repository.py         # Search quotes & sales orders; load historical controls
│   └── customer_repository.py
├── services/
│   ├── quote_state.py              # Estimate line state management
│   ├── export_service.py           # Excel export
│   ├── data_mapping.py             # mapped_select, get_value, money, percent helpers
│   ├── configuration_loader.py     # Reload saved M1 config into session
│   ├── movidor_door_config/        # Door options, defaults, upgrade rules, validation
│   ├── curtain_config/             # Curtain options, defaults, panel calc, upgrade rules
│   └── installation_config/        # Installation options, defaults, quantity rule engine
└── ui/
    ├── configurator_section.py     # Main configurator page (stepper, save, pricing summary)
    ├── door_section.py             # Door config tabs
    ├── curtain_section.py          # Curtain config + panel auto-calc
    ├── installation_section.py     # Installation config
    ├── estimate_lines.py           # Estimate line grid
    ├── estimate_header.py          # Quote/customer header
    ├── customer_picker.py          # Customer search
    └── configured_part_search.py   # Search & reload historical configs
```

---

## ⚙️ Setup

### Prerequisites
- Python 3.11+
- M1 SQL Server database access
- ODBC Driver 17 for SQL Server

### Environment variables (`.env`)
```env
DB_SERVER=your_server
DB_NAME=your_database
DB_USER=your_user
DB_PASSWORD=your_password
DB_DRIVER=ODBC Driver 17 for SQL Server

APP_NAME=Rapid Door Estimator
ENVIRONMENT=development

API_ID=your_api_id
API_KEY=your_api_key
API_URL=your_api_url
```

### Run
```bash
pip install -r requirements.txt
streamlit run src/app.py
```

---

## 🚪 Supported Door Types

| Code | Description | Status |
|---|---|---|
| `RRD` | Rapid Rolling Door (Movidor range) | ✅ Full configurator |
| `SWI` | Swing Door | 🔲 Configurator pending |
| `ENTURI` | Enturi Door | 🔲 Configurator pending |
| `STRIPDOOR` | Strip Door | 🔲 Configurator pending |

### RRD Models

`ES40` · `HS25` · `HS35` · `HS35-THERMIC` · `HS50` · `HS50-THERMIC` · `HS65` · `EX35` · `EX45` · `MOVICHILL` · `MOVICHILL-XL` · `MOVIFOLD` · `CONCERTINA` · `BUGSTOP` · `MS40-THERMIC`
