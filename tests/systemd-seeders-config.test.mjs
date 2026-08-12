import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const root = resolve(import.meta.dirname, '..');

function readProjectFile(path) {
  return readFileSync(resolve(root, path), 'utf8');
}

test('tracked systemd seeder service preserves the constrained one-shot execution boundary', () => {
  const service = readProjectFile('systemd/worldmonitor-seeders.service');

  for (const directive of [
    'Type=oneshot',
    'TimeoutStartSec=25min',
    'ExecStart=/srv/appdata/worldmonitor/scripts/run-seeders-systemd.sh',
    'NoNewPrivileges=true',
    'PrivateTmp=true',
    'ProtectSystem=full',
    'ProtectHome=true',
    'ReadOnlyPaths=/srv/appdata/worldmonitor',
  ]) {
    assert.match(service, new RegExp(`^${directive.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'm'));
  }
});

test('tracked systemd seeder timer runs every fifteen minutes with bounded jitter and persists missed runs', () => {
  const timer = readProjectFile('systemd/worldmonitor-seeders.timer');

  for (const directive of [
    'OnCalendar=*:0/15',
    'Persistent=true',
    'RandomizedDelaySec=2m',
    'Unit=worldmonitor-seeders.service',
  ]) {
    assert.match(timer, new RegExp(`^${directive.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'm'));
  }
  assert.doesNotMatch(timer, /00\/6:10:00|OnCalendar=hourly/, 'self-hosted cadence must not drift back to an insufficient schedule');
});

test('systemd deployment instructions keep the live unit sourced from this repository', () => {
  const readme = readProjectFile('systemd/README.md');

  assert.match(readme, /install -m 0644 systemd\/worldmonitor-seeders\.service \/etc\/systemd\/system\/worldmonitor-seeders\.service/);
  assert.match(readme, /install -m 0644 systemd\/worldmonitor-seeders\.timer \/etc\/systemd\/system\/worldmonitor-seeders\.timer/);
  assert.match(readme, /systemctl daemon-reload/);
  assert.match(readme, /systemctl enable --now worldmonitor-seeders\.timer/);
});
