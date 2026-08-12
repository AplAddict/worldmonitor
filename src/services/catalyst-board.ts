import type { NewsItem } from '@/types';
import { effectivePubDateMs } from './feed-date';

export type CatalystType = 'earnings' | 'guidance' | 'analyst' | 'corporate' | 'regulation' | 'supply-chain' | 'macro' | 'market';

export interface CatalystItem {
  title: string;
  source: string;
  link: string;
  publishedAt: Date;
  symbols: string[];
  catalystType: CatalystType;
}

export interface CatalystBoard {
  status: 'ok' | 'empty';
  watched: CatalystItem[];
  broad: CatalystItem[];
  excludedCount: number;
}

const MAX_AGE_MS = 24 * 60 * 60 * 1000;
const MAX_PER_LANE = 6;

// The mirror intentionally contains symbols only. These public company aliases
// improve headline matching without adding holdings/account metadata.
const PUBLIC_COMPANY_ALIASES: Record<string, string[]> = {
  AAPL: ['apple'], MSFT: ['microsoft'], NVDA: ['nvidia', 'nvidia corporation'],
  GOOGL: ['alphabet', 'google'], AMZN: ['amazon'], META: ['meta platforms'],
  TSLA: ['tesla'], AMD: ['advanced micro devices'], AVGO: ['broadcom'],
  NFLX: ['netflix'], ORCL: ['oracle'], CRM: ['salesforce'], QCOM: ['qualcomm'],
  LLY: ['eli lilly'], JPM: ['jpmorgan'], BAC: ['bank of america'],
  XOM: ['exxon', 'exxon mobil'], CVX: ['chevron'], WMT: ['walmart'],
};

const CATALYST_RULES: Array<[CatalystType, RegExp]> = [
  ['earnings', /\b(earnings?|results?|revenue|profit|eps|quarterly)\b/i],
  ['guidance', /\b(guidance|outlook|forecast|raises? (?:its )?view|cuts? (?:its )?view)\b/i],
  ['analyst', /\b(upgrade[ds]?|downgrade[ds]?|price target|rating|analyst)\b/i],
  ['corporate', /\b(acquire[sd]?|acquisition|merger|buyback|dividend|contract|lawsuit|ceo|layoffs?)\b/i],
  ['regulation', /\b(regulat(?:ion|or|ory)|antitrust|tariff|sanctions?|probe|approval)\b/i],
  ['supply-chain', /\b(supply chain|shortage|chip demand|factory|production|shipping)\b/i],
  ['macro', /\b(inflation|treasury|yields?|fed(?:eral reserve)?|jobs report|gdp|interest rates?)\b/i],
];

function escapedWord(value: string): RegExp {
  return new RegExp(`\\b${value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
}

function classify(title: string): CatalystType {
  return CATALYST_RULES.find(([, pattern]) => pattern.test(title))?.[0] ?? 'market';
}

function matchedSymbols(title: string, symbols: string[]): string[] {
  return symbols.filter((symbol) => {
    const normalized = symbol.toUpperCase();
    // Short ticker strings often occur as ordinary language (e.g. "meta analysis").
    // Treat them as a match only when prefixed with $, then rely on an explicit
    // public company alias for natural-language headline matching.
    if (normalized.length > 4 && escapedWord(normalized).test(title)) return true;
    if (new RegExp(`\\$${normalized.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(title)) return true;
    return (PUBLIC_COMPANY_ALIASES[normalized] ?? []).some((alias) => escapedWord(alias).test(title));
  });
}

export function buildCatalystBoard(items: NewsItem[], mirrorSymbols: string[], now = new Date()): CatalystBoard {
  const nowMs = now.getTime();
  const seenTitles = new Set<string>();
  const watched: CatalystItem[] = [];
  const broad: CatalystItem[] = [];
  let excludedCount = 0;

  const ordered = [...items].sort((a, b) => effectivePubDateMs(b) - effectivePubDateMs(a));
  for (const item of ordered) {
    const publishedMs = effectivePubDateMs(item);
    const key = item.title.trim().toLocaleLowerCase();
    if (!publishedMs || nowMs - publishedMs > MAX_AGE_MS || publishedMs > nowMs + 5 * 60 * 1000 || seenTitles.has(key)) {
      excludedCount++;
      continue;
    }
    seenTitles.add(key);
    const catalyst: CatalystItem = {
      title: item.title,
      source: item.source,
      link: item.link,
      publishedAt: item.pubDate,
      symbols: matchedSymbols(item.title, mirrorSymbols),
      catalystType: classify(item.title),
    };
    const lane = catalyst.symbols.length > 0 ? watched : broad;
    if (lane.length < MAX_PER_LANE) lane.push(catalyst);
  }

  return { status: watched.length || broad.length ? 'ok' : 'empty', watched, broad, excludedCount };
}
