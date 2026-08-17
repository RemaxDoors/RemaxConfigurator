"""Bridge from the Streamlit app to the pricing rules, which now live in api/.

Why not just add api/ to sys.path: the API package is called `app`, and
Streamlit's entry point is `src/app.py`. Whichever comes first on sys.path wins,
so either the bridge breaks or Streamlit's own `app` module does. Loading the
package straight off disk under its own name avoids the collision entirely.

Delete this file, and the shims that use it, when Streamlit is retired.
"""
import importlib.util
import os
import sys

_PKG_NAME = "remax_pricing_rules"
_PKG_DIR = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "..", "api", "app", "pricing_rules")
)


def load():
    """Import api/app/pricing_rules as a standalone top-level package."""
    if _PKG_NAME in sys.modules:
        return sys.modules[_PKG_NAME]
    init = os.path.join(_PKG_DIR, "__init__.py")
    if not os.path.isfile(init):
        raise ImportError(
            f"Pricing rules not found at {_PKG_DIR}. They moved from src/ to "
            "api/app/pricing_rules; check the api/ directory is present."
        )
    spec = importlib.util.spec_from_file_location(
        _PKG_NAME, init, submodule_search_locations=[_PKG_DIR]
    )
    module = importlib.util.module_from_spec(spec)
    # Registered before exec_module so the package's own relative imports
    # ("from . import installation_control_names") resolve.
    sys.modules[_PKG_NAME] = module
    spec.loader.exec_module(module)
    return module


def submodule(name: str):
    """Import one module out of that package, e.g. 'installation_control_names'."""
    load()
    return importlib.import_module(f"{_PKG_NAME}.{name}")
