import { readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { PROVIDER_KEYS } from '/app/docker/provider-catalog.mjs';

const credentialsPath = '/run/worldmonitor-credentials/providers.json';
try {
  const credentials = JSON.parse(await readFile(credentialsPath, 'utf8'));
  for (const [key, value] of Object.entries(credentials)) {
    if (PROVIDER_KEYS.has(key) && typeof value === 'string' && value.length > 0) process.env[key] = value;
  }
} catch (error) {
  if (error?.code !== 'ENOENT') throw error;
}

const scripts = [
  'seed-portwatch.mjs',
  'seed-portwatch-disruptions.mjs',
  'seed-portwatch-chokepoints-ref.mjs',
  'seed-earthquakes.mjs',
  'seed-weather-alerts.mjs',
  'seed-natural-events.mjs',
  'seed-cyber-threats.mjs',
  'seed-economy.mjs',
  'seed-fred-rates.mjs',
  'seed-eia-petroleum.mjs',
  'seed-market-quotes.mjs',
  'seed-earnings-calendar.mjs',
  'seed-fire-detections.mjs',
];

let ok = 0;
let degraded = 0;
for (const script of scripts) {
  process.stdout.write(`${script}: `);
  const result = await new Promise((resolve) => {
    const child = spawn('timeout', ['-k', '20', '300', 'node', `scripts/${script}`], {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: process.env,
    });
    let output = '';
    child.stdout.on('data', (chunk) => { output += chunk; process.stdout.write(chunk); });
    child.stderr.on('data', (chunk) => { output += chunk; process.stderr.write(chunk); });
    child.on('close', (code, signal) => resolve({ code, signal, output }));
  });
  if (result.code === 0) {
    ok += 1;
    console.log('OK');
  } else {
    degraded += 1;
    console.error(`DEGRADED (exit=${result.code ?? 'signal'})`);
  }
}
console.log(JSON.stringify({ event: 'worldmonitor_seeders_complete', ok, degraded, timestamp: new Date().toISOString() }));
process.exit(ok > 0 ? 0 : 1);
