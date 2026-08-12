import { readFile } from 'node:fs/promises';
import { PROVIDER_KEYS } from './provider-catalog.mjs';

const allowed = PROVIDER_KEYS;
const credentialsPath = '/run/worldmonitor-credentials/providers.json';
try {
  const credentials = JSON.parse(await readFile(credentialsPath, 'utf8'));
  for (const [key, value] of Object.entries(credentials)) {
    if (allowed.has(key) && typeof value === 'string' && value.length > 0) process.env[key] = value;
  }
} catch (error) {
  if (error?.code !== 'ENOENT') throw error;
}
process.execve('/usr/bin/supervisord', ['/usr/bin/supervisord', '-c', '/etc/supervisor/conf.d/worldmonitor.conf'], process.env);
