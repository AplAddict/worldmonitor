# World Monitor systemd units

The self-hosted cache refresh is deliberately managed by a host `systemd` timer, not by the web container. Keeping the units in this repository makes the deployed cadence auditable and prevents host configuration from silently drifting from the fork.

## Install or update

```sh
cd /srv/appdata/worldmonitor
install -m 0644 systemd/worldmonitor-seeders.service /etc/systemd/system/worldmonitor-seeders.service
install -m 0644 systemd/worldmonitor-seeders.timer /etc/systemd/system/worldmonitor-seeders.timer
systemctl daemon-reload
systemctl enable --now worldmonitor-seeders.timer
systemctl list-timers worldmonitor-seeders.timer
```

The timer runs every fifteen minutes with up to two minutes of jitter. The seeder container has per-source locks and per-bundle interval gates, so infrequent sources remain gated while sources whose health contract requires sub-hour freshness can refresh.

## Verify a run

```sh
systemctl start worldmonitor-seeders.service
journalctl -u worldmonitor-seeders.service -n 200 --no-pager
```

A partial producer run exits nonzero and must be investigated. Do not treat a container healthcheck as proof that every optional provider is configured or that every cache is fresh.
