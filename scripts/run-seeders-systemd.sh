#!/bin/sh
# Run World Monitor seeders in the dedicated one-shot container. Provider values
# are read only by its startup wrapper from the private named volume; nothing is
# copied to the host process or printed here.
set -eu
cd /srv/appdata/worldmonitor
exec docker compose --profile seeders run --rm --no-deps seeders
