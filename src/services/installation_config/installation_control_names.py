"""Moved to api/app/pricing_rules/installation_control_names.py.

Shim for the Streamlit app. Re-exports the control-name constants so
`from services.installation_config import installation_control_names as control`
keeps resolving. Delete with Streamlit.
"""
from services._pricing_bridge import submodule

_impl = submodule("installation_control_names")

# Re-export the public constants (CMBJOBTYPE, CHKINSSTRIPSM, ...).
for _name in dir(_impl):
    if not _name.startswith("_"):
        globals()[_name] = getattr(_impl, _name)
del _name, _impl
