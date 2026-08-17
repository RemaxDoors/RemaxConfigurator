"""Door pricing rules, moved here from the Streamlit app.

These are the hard-coded upgrade and installation rules the configurator has
always used. They live in the API now so `src/` (Streamlit) can be retired —
previously m1_pricing.py reached into the Streamlit tree via sys.path, which
meant the new app could not be deployed without the old one.

This is a lift-and-shift, deliberately unmodified: the move is verified by
comparing outputs against the pre-move behaviour, so any difference would be a
bug rather than an improvement.

They are still the *old* engine. The replacement is the data-driven rules in
uCfgRules, evaluated by validation_engine.rule_matches() + formula.evaluate().
Deleting this package is the goal; it needs a parity harness across every
configuration first, because a silent difference here is a wrong quote.
"""

from .installation_rules import build_installation_lines
from .movidor_upgrade_rules import build_upgrade_columns

__all__ = ["build_installation_lines", "build_upgrade_columns"]
