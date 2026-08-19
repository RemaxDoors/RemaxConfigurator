# Remax Configurator API (FastAPI)

The Python backend for the new app. Owns **M1 access** and the **configurator rules**.
The Next.js app calls it (via its own `/api/*` proxy routes).

## Endpoints
| Method | Path | Description |
|---|---|---|
| GET | `/health` | Liveness + whether M1 is configured |
| GET | `/configurators` | The 7 configurators + their parameters |
| GET | `/rules?configuratorId=` | Configurator rules (optionally filtered) |
| GET | `/customers?q=` | Search M1 customers (needs DB configured) |

Interactive docs at `http://localhost:8000/docs`.

## Run (dev)
```bash
cd api
python -m venv .venv
.venv\Scripts\activate            # Windows  (source .venv/bin/activate on macOS/Linux)
pip install -r requirements.txt
copy .env.example .env            # then fill in DB_* to enable M1 (rules work without it)
uvicorn app.main:app --reload --port 8000
```

The **rules/configurators endpoints work without a database**. The `/customers`
endpoint returns 503 until `DB_*` are set in `backend/.env` (same values as
`src/.env`, plus the ODBC driver).

## Wiring to the Next app
Set `API_URL=http://localhost:8000` in `frontend/.env` (or `.env.local`) and restart the
Next dev server. The Next app then reads configurators/rules from here (falling back
to its bundled mock if the API is unreachable).
