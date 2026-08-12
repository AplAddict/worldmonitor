import { createServer } from 'node:http';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { PROVIDERS, PROVIDER_KEYS, publicProvider } from './provider-catalog.mjs';

const PORT = Number(process.env.PORT || 8090);
const CONFIG_DIR = process.env.CREDENTIAL_CONFIG_DIR || '/config';
const CONFIG_FILE = `${CONFIG_DIR}/providers.json`;
const CONTROL_DIR = process.env.CREDENTIAL_CONTROL_DIR || '/control';
const TOKEN_FILE = `${CONTROL_DIR}/sync-token`;
const SYNC_HEADER = 'x-worldmonitor-credential-sync';
const KEYS = PROVIDER_KEYS;
const SYNC_URL = process.env.CREDENTIAL_SYNC_URL || 'http://worldmonitor:8080/api/self-hosted/credential-sync';
const MAX_BODY_BYTES = 256 * 1024;
const MAX_SECRET_LENGTH = 4096;

async function loadOrCreateSyncToken() {
  try {
    const existing = (await readFile(TOKEN_FILE, 'utf8')).trim();
    if (existing.length >= 32) return existing;
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
  await mkdir(CONTROL_DIR, { recursive: true, mode: 0o755 });
  const generated = randomBytes(32).toString('base64url');
  const temporary = `${TOKEN_FILE}.tmp-${process.pid}`;
  // The token stays in an internal named volume, available only to the service
  // and the unprivileged World Monitor sidecar (read-only there).
  await writeFile(temporary, `${generated}\n`, { mode: 0o644 });
  await rename(temporary, TOKEN_FILE);
  return generated;
}
const token = await loadOrCreateSyncToken();

function secureEqual(left, right) {
  const a = Buffer.from(String(left || ''));
  const b = Buffer.from(String(right || ''));
  return a.length === b.length && timingSafeEqual(a, b);
}
function reply(res, status, payload) {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
  });
  res.end(JSON.stringify(payload));
}
async function readBody(req) {
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    total += chunk.length;
    if (total > MAX_BODY_BYTES) throw new Error('Request too large');
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
}
function normalizeUpdates(body) {
  if (!body || typeof body !== 'object' || !Array.isArray(body.entries)) throw new Error('Expected entries');
  const updates = {};
  for (const entry of body.entries) {
    const key = entry?.key;
    const value = entry?.value;
    if (!KEYS.has(key) || typeof value !== 'string') throw new Error('Unsupported provider');
    const trimmed = value.trim();
    if (!trimmed || trimmed.length > MAX_SECRET_LENGTH || /[\u0000-\u001f\u007f]/.test(trimmed)) throw new Error('Invalid credential value');
    updates[key] = trimmed;
  }
  if (Object.keys(updates).length === 0) throw new Error('No credentials supplied');
  return updates;
}
async function currentConfig() {
  try {
    const parsed = JSON.parse(await readFile(CONFIG_FILE, 'utf8'));
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (error) {
    if (error?.code === 'ENOENT') return {};
    throw error;
  }
}
async function persistConfig(updates) {
  const existing = await currentConfig();
  const next = {};
  for (const key of KEYS) {
    const value = updates[key] ?? existing[key];
    if (typeof value === 'string' && value.length) next[key] = value;
  }
  await mkdir(CONFIG_DIR, { recursive: true, mode: 0o700 });
  const temporary = `${CONFIG_FILE}.tmp-${process.pid}`;
  // The volume is mounted only into this service and World Monitor, whose mount
  // is read-only. Values never transit the browser again or appear in responses.
  await writeFile(temporary, `${JSON.stringify(next)}\n`, { mode: 0o644 });
  await rename(temporary, CONFIG_FILE);
}
async function syncRuntime(updates) {
  const response = await fetch(SYNC_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json', [SYNC_HEADER]: token },
    body: JSON.stringify({ entries: Object.entries(updates).map(([key, value]) => ({ key, value })) }),
    signal: AbortSignal.timeout(5000),
  });
  return response.ok;
}
function hasAuthenticatedUser(req) {
  const user = req.headers['x-worldmonitor-authenticated-user'];
  return typeof user === 'string' && user.length > 0 && user.length <= 512;
}
function hasExpectedOrigin(req) {
  return req.headers.origin === 'https://world.isaaczipperstein.com';
}

createServer(async (req, res) => {
  if (!hasAuthenticatedUser(req)) return reply(res, 403, { error: 'Forbidden' });
  if (req.method === 'GET' && req.url === '/credentials/status') {
    const config = await currentConfig();
    return reply(res, 200, {
      providers: Object.fromEntries(PROVIDERS.map(({ id, key }) => [id, { configured: typeof config[key] === 'string' && config[key].length > 0 }])),
      catalog: PROVIDERS.map(publicProvider),
    });
  }
  if (req.method !== 'POST' || req.url !== '/credentials') return reply(res, 404, { error: 'Not found' });
  if (!hasExpectedOrigin(req)) return reply(res, 403, { error: 'Forbidden' });
  try {
    const updates = normalizeUpdates(await readBody(req));
    await persistConfig(updates);
    const runtimeSynced = await syncRuntime(updates).catch(() => false);
    return reply(res, 200, { ok: true, updated: Object.keys(updates), runtimeSynced });
  } catch {
    return reply(res, 400, { error: 'Credential update was not accepted' });
  }
}).listen(PORT, '0.0.0.0');
