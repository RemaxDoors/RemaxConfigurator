"""Moved to api/app/pricing_rules/movidor_upgrade_rules.py.

This shim keeps the Streamlit app working while it is still in production.
The API is the canonical home now — previously the dependency ran the other
way, which meant the new app could not be deployed without the old one.

Do not add rules here. Edit the module in api/, or better, add the rule to
uCfgRules so it is editable from /configurator-setup without a deploy.
When Streamlit is retired, delete this file.
"""
from services._pricing_bridge import submodule

_impl = submodule("movidor_upgrade_rules")
build_upgrade_columns = _impl.build_upgrade_columns

__all__ = ["build_upgrade_columns"]
