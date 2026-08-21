from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from . import settings
from .routers import configurators, customers, mapping, pricing, status, validation
from .version import __version__

app = FastAPI(title="Remax ConfigHub API", version=__version__)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"status": "ok", "db_configured": settings.db_configured()}


app.include_router(configurators.router)
app.include_router(customers.router)
app.include_router(mapping.router)
app.include_router(pricing.router)
app.include_router(status.router)
app.include_router(validation.router)
