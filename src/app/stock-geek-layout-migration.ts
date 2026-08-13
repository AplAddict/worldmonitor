import type { PanelConfig } from '@/types';

export type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

type MigrationArgs = {
  storage: StorageLike;
  panelOrderKey: string;
  panelSettings: Record<string, PanelConfig>;
  resolvePanel: (key: string) => PanelConfig | undefined;
  savePanelSettings: () => void;
};

const STOCK_GEEK_MISSION_ID = 'macro-market-watch';
const FRONT_SURFACES = ['live-news', 'markets-news'] as const;
const REQUIRED_PANELS = [...FRONT_SURFACES, 'catalyst-board'] as const;

function readStringList(storage: StorageLike, key: string): string[] {
  try {
    const raw = storage.getItem(key);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === 'string') : [];
  } catch {
    return [];
  }
}

function writeIfChanged(storage: StorageLike, key: string, next: string[], current: string[]): boolean {
  if (next.length === current.length && next.every((value, index) => value === current[index])) return false;
  storage.setItem(key, JSON.stringify(next));
  return true;
}

/**
 * Repairs legacy saved Stock Geek layouts additively. It intentionally applies
 * only when Stock Geek is the active mission, so unrelated desks retain their
 * saved panel order and placement.
 */
export function applyStockGeekLiveSurfacesMigration({
  storage,
  panelOrderKey,
  panelSettings,
  resolvePanel,
  savePanelSettings,
}: MigrationArgs): boolean {
  if (storage.getItem('worldmonitor-mission-preset-v1') !== STOCK_GEEK_MISSION_ID) return false;

  let changed = false;
  for (const key of REQUIRED_PANELS) {
    const resolved = resolvePanel(key);
    if (!resolved) continue;
    if (!panelSettings[key]?.enabled) {
      panelSettings[key] = { ...resolved, enabled: true };
      changed = true;
    }
  }
  if (changed) savePanelSettings();

  const currentOrder = readStringList(storage, panelOrderKey);
  const remainder = currentOrder.filter((key) => !REQUIRED_PANELS.includes(key as typeof REQUIRED_PANELS[number]));
  const holdingsIndex = remainder.indexOf('holdings-research');
  const catalystIndex = holdingsIndex >= 0 ? holdingsIndex + 1 : Math.min(4, remainder.length);
  remainder.splice(catalystIndex, 0, 'catalyst-board');
  const nextOrder = [...FRONT_SURFACES, ...remainder];
  changed = writeIfChanged(storage, panelOrderKey, nextOrder, currentOrder) || changed;

  const bottomSetKey = `${panelOrderKey}-bottom-set`;
  const currentBottomSet = readStringList(storage, bottomSetKey);
  const nextBottomSet = currentBottomSet.filter((key) => !REQUIRED_PANELS.includes(key as typeof REQUIRED_PANELS[number]));
  changed = writeIfChanged(storage, bottomSetKey, nextBottomSet, currentBottomSet) || changed;

  return changed;
}
