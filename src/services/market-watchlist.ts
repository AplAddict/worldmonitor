/**
 * User-customizable market watchlist (additive).
 *
 * Stores a list of extra tickers the user wants to track beyond the defaults.
 * Optional friendly label is supported (used as the displayed name).
 */

export interface MarketWatchlistEntry {
  symbol: string;
  /** Friendly label shown in the UI (maps to MarketData.name). */
  name?: string;
  /** Optional short display code (maps to MarketData.display). Defaults to symbol. */
  display?: string;
}

const STORAGE_KEY = 'wm-market-watchlist-v1';
export const MARKET_WATCHLIST_EVENT = 'wm-market-watchlist-changed';

export interface InvestWatchlistMirror {
  source: 'invest-dashboard';
  mode: 'read_only_holdings_mirror';
  status: 'ok' | 'stale' | 'unavailable';
  sourceUpdatedAt: string | null;
  publishedAt?: string | null;
  maxAgeSeconds?: number;
  symbols: string[];
  error?: string;
}

function isMirrorSymbol(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Z0-9.^=-]{1,16}$/.test(value);
}

/** Fetch the explicitly provisioned, symbol-only holdings mirror. It never
 * writes user preferences or exposes holdings, quantities, prices, or accounts. */
export async function fetchInvestWatchlistMirror(): Promise<InvestWatchlistMirror> {
  try {
    const response = await fetch('/api/invest-watchlist', { headers: { Accept: 'application/json' } });
    const raw = await response.json() as Partial<InvestWatchlistMirror>;
    const symbols = Array.isArray(raw.symbols) ? [...new Set(raw.symbols.filter(isMirrorSymbol))].slice(0, 50) : [];
    if (!response.ok || raw.source !== 'invest-dashboard' || raw.mode !== 'read_only_holdings_mirror' || raw.status !== 'ok') {
      return {
        source: 'invest-dashboard',
        mode: 'read_only_holdings_mirror',
        status: raw.status === 'stale' ? 'stale' : 'unavailable',
        sourceUpdatedAt: typeof raw.sourceUpdatedAt === 'string' ? raw.sourceUpdatedAt : null,
        symbols: [],
        error: typeof raw.error === 'string' ? raw.error : 'mirror_unavailable',
      };
    }
    return {
      source: 'invest-dashboard',
      mode: 'read_only_holdings_mirror',
      status: 'ok',
      sourceUpdatedAt: typeof raw.sourceUpdatedAt === 'string' ? raw.sourceUpdatedAt : null,
      publishedAt: typeof raw.publishedAt === 'string' ? raw.publishedAt : null,
      maxAgeSeconds: typeof raw.maxAgeSeconds === 'number' ? raw.maxAgeSeconds : undefined,
      symbols,
    };
  } catch {
    return {
      source: 'invest-dashboard',
      mode: 'read_only_holdings_mirror',
      status: 'unavailable',
      sourceUpdatedAt: null,
      symbols: [],
      error: 'mirror_request_failed',
    };
  }
}

export function mergeMarketWatchlistEntries(
  manualEntries: MarketWatchlistEntry[],
  mirroredSymbols: string[],
): MarketWatchlistEntry[] {
  const merged: MarketWatchlistEntry[] = [];
  const seen = new Set<string>();
  const mirroredEntries: MarketWatchlistEntry[] = mirroredSymbols.map((symbol) => ({ symbol }));
  for (const entry of [...manualEntries, ...mirroredEntries]) {
    const symbol = normalizeSymbol(entry.symbol || '');
    if (!symbol || seen.has(symbol)) continue;
    seen.add(symbol);
    merged.push({ symbol, ...(entry.name ? { name: entry.name } : {}), ...(entry.display ? { display: entry.display } : {}) });
    if (merged.length >= 50) break;
  }
  return merged;
}

export function formatInvestMirrorStatus(mirror: InvestWatchlistMirror): string {
  if (mirror.status === 'ok') return `Invest mirror active · ${mirror.symbols.length} symbols · read-only`;
  if (mirror.status === 'stale') return 'Invest mirror is stale · excluded until refreshed';
  return 'Invest mirror unavailable · manual watchlist remains active';
}

function safeParseJson<T>(raw: string | null): T | null {
  if (!raw) return null;
  try { return JSON.parse(raw) as T; } catch { return null; }
}

function normalizeSymbol(raw: string): string {
  // Allow common finnhub/yahoo formats: ^GSPC, BRK-B, GC=F, BTCUSD, etc.
  // Only trim whitespace and remove internal spaces.
  return raw.trim().replace(/\s+/g, '');
}

function normalizeName(raw: string | undefined): string | undefined {
  const v = (raw || '').trim();
  return v ? v : undefined;
}

function coerceEntry(v: unknown): MarketWatchlistEntry | null {
  if (typeof v === 'string') {
    const sym = normalizeSymbol(v);
    if (!sym) return null;
    return { symbol: sym };
  }
  if (v && typeof v === 'object') {
    const obj = v as any;
    const sym = normalizeSymbol(String(obj.symbol || ''));
    if (!sym) return null;
    const name = normalizeName(typeof obj.name === 'string' ? obj.name : undefined);
    const display = normalizeName(typeof obj.display === 'string' ? obj.display : undefined);
    return { symbol: sym, ...(name ? { name } : {}), ...(display ? { display } : {}) };
  }
  return null;
}

export function getMarketWatchlistEntries(): MarketWatchlistEntry[] {
  try {
    const parsed = safeParseJson<unknown>(localStorage.getItem(STORAGE_KEY));
    if (Array.isArray(parsed)) {
      const entries: MarketWatchlistEntry[] = [];
      for (const item of parsed) {
        const e = coerceEntry(item);
        if (e) entries.push(e);
      }
      return entries;
    }
  } catch {
    // ignore
  }
  return [];
}

export function setMarketWatchlistEntries(entries: MarketWatchlistEntry[]): void {
  // Clean, de-dupe by symbol but keep order.
  const seen = new Set<string>();
  const out: MarketWatchlistEntry[] = [];

  for (const raw of entries || []) {
    const sym = normalizeSymbol(raw.symbol || '');
    if (!sym || seen.has(sym)) continue;
    seen.add(sym);

    const name = normalizeName(raw.name);
    const display = normalizeName(raw.display);

    out.push({ symbol: sym, ...(name ? { name } : {}), ...(display ? { display } : {}) });
    if (out.length >= 50) break;
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(out));
  } catch {
    // ignore
  }

  window.dispatchEvent(new CustomEvent(MARKET_WATCHLIST_EVENT, { detail: { entries: out } }));
}

export function resetMarketWatchlist(): void {
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
  window.dispatchEvent(new CustomEvent(MARKET_WATCHLIST_EVENT, { detail: { entries: [] } }));
}

export function subscribeMarketWatchlistChange(cb: (entries: MarketWatchlistEntry[]) => void): () => void {
  const handler = (e: Event) => {
    const detail = (e as CustomEvent).detail as { entries?: unknown } | undefined;
    if (Array.isArray(detail?.entries)) {
      const coerced: MarketWatchlistEntry[] = [];
      for (const it of detail!.entries!) {
        const ce = coerceEntry(it);
        if (ce) coerced.push(ce);
      }
      cb(coerced);
      return;
    }
    cb(getMarketWatchlistEntries());
  };
  window.addEventListener(MARKET_WATCHLIST_EVENT, handler);
  return () => window.removeEventListener(MARKET_WATCHLIST_EVENT, handler);
}
