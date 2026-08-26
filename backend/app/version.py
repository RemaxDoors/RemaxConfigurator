"""Single source of the API version.

Kept in its own module so main.py and /status cannot drift apart, and so
bumping a release is a one-line edit. /status reports it, which is how you
confirm which build Azure is actually running — the deploy pins the image to a
commit SHA, but the SHA is not visible from the app itself.

Keep it in step with frontend/package.json.
"""

__version__ = "0.7.0"
