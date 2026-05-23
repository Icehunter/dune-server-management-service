#!/usr/bin/env bash
set -euo pipefail

# Install the helper scripts shipped in the image into the host-mounted
# /home/dune/.dune/bin so cross-script references (which use absolute
# paths under /home/dune/.dune/bin) resolve. This runs on every container
# start so rebuilds keep the host copies in sync with the image.
if [[ -d /opt/server-management-service/scripts ]]; then
  bash /opt/server-management-service/scripts/install-script-deps.sh /home/dune/.dune/bin
fi

exec "$@"
