import { readFile } from 'node:fs/promises';
import { PROVIDER_KEYS } from './provider-catalog.mjs';

// Operator-managed values live on a private named volume shared read-only with
// consumers. This wrapper imports only the catalog allowlist and never logs them.
try {
  const credentials = JSON.parse(await readFile('/run/worldmonitor-credentials/providers.json', 'utf8'));
  for (const [key, value] of Object.entries(credentials)) {
    if (PROVIDER_KEYS.has(key) && typeof value === 'string' && value.length > 0) process.env[key] = value;
  }
} catch (error) {
  if (error?.code !== 'ENOENT') throw error;
}
process.execve(process.execPath, [process.execPath, 'scripts/ais-relay.cjs'], process.env);
