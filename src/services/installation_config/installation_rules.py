"""Moved to api/app/pricing_rules/installation_rules.py.

Shim for the Streamlit app while it is still in production. See the note in
services/movidor_door_config/movidor_upgrade_rules.py. Delete with Streamlit.
"""
from services._pricing_bridge import submodule

_impl = submodule("installation_rules")
build_installation_lines = _impl.build_installation_lines

__all__ = ["build_installation_lines"]
