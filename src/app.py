import streamlit as st

from services.quote_state import init_estimate_state
from ui.configurator_section import render_configurator
from ui.customer_picker import render_customer_picker
from ui.estimate_header import render_estimate_header
from ui.estimate_lines import render_estimate_lines


st.set_page_config(page_title="Remax Configurator", layout="wide")

init_estimate_state()

if st.session_state["estimate_mode"] == "configurator":
    render_configurator()
else:
    render_estimate_header()
    render_customer_picker()
    render_estimate_lines()
