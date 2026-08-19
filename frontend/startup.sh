#!/bin/sh
# Startup command for the Azure Web App: Configuration > General settings >
# Startup Command:
#
#     sh startup.sh
#
# Why a script rather than just "node server.js": App Service sets HOSTNAME to
# the container's machine name, and Next's standalone server binds to whatever
# HOSTNAME says. The app then starts, reports Running, listens on an address
# nothing can reach, and every request times out — with no error anywhere to
# explain it. Forcing 0.0.0.0 here means that cannot happen, and it is versioned
# with the code rather than depending on someone remembering an app setting.
set -e

export HOSTNAME=0.0.0.0
export PORT="${PORT:-8080}"

echo "starting Next.js on ${HOSTNAME}:${PORT}"
exec node server.js
