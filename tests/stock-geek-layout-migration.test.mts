import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { applyStockGeekLiveSurfacesMigration } from '../src/app/stock-geek-layout-migration.ts';

type Stored = Map<string, string>;

function makeStorage(seed: Record<string, unknown> = {}) {
  const stored: Stored = new Map(Object.entries(seed).map(([key, value]) => [key, JSON.stringify(value)]));
  return {
    getItem(key: string) { return stored.get(key) ?? null; },
    setItem(key: string, value: string) { stored.set(key, value); },
    values: stored,
  };
}

describe('Stock Geek live-surfaces layout migration', () => {
  it('restores the evidence-first desk order after a legacy reset and preserves unrelated panel order', () => {
    const storage = makeStorage({
      'worldmonitor-mission-preset-v1': 'macro-market-watch',
      'panel-order': ['markets', 'holdings-research', 'stock-analysis', 'daily-market-brief'],
      'panel-order-bottom-set': ['live-news', 'markets-news', 'catalyst-board'],
    });
    storage.setItem('worldmonitor-mission-preset-v1', 'macro-market-watch');
    const panelSettings = {
      'live-news': { name: 'Live Market TV', enabled: false },
      'markets-news': { name: 'Markets News', enabled: false },
      'markets': { name: 'Markets', enabled: true },
      'holdings-research': { name: 'Holdings Research', enabled: true },
      'catalyst-board': { name: 'Catalyst Board', enabled: false },
      'stock-analysis': { name: 'Stock Analysis', enabled: true },
      'daily-market-brief': { name: 'Daily Market Brief', enabled: true },
    };

    const changed = applyStockGeekLiveSurfacesMigration({
      storage,
      panelOrderKey: 'panel-order',
      panelSettings,
      resolvePanel: (key) => panelSettings[key as keyof typeof panelSettings],
      savePanelSettings: () => undefined,
    });

    assert.equal(changed, true);
    assert.equal(panelSettings['live-news'].enabled, true);
    assert.equal(panelSettings['markets-news'].enabled, true);
    assert.equal(panelSettings['catalyst-board'].enabled, true);
    assert.deepEqual(JSON.parse(storage.getItem('panel-order') ?? '[]'), [
      'live-news', 'markets-news', 'markets', 'holdings-research',
      'catalyst-board', 'stock-analysis', 'daily-market-brief',
    ]);
    assert.deepEqual(JSON.parse(storage.getItem('panel-order-bottom-set') ?? '[]'), []);
  });

  it('does nothing outside the active Stock Geek mission', () => {
    const storage = makeStorage({ 'worldmonitor-mission-preset-v1': 'crisis-desk', 'panel-order': ['markets'] });
    const panelSettings = { markets: { name: 'Markets', enabled: true } };

    assert.equal(applyStockGeekLiveSurfacesMigration({
      storage,
      panelOrderKey: 'panel-order',
      panelSettings,
      resolvePanel: (key) => panelSettings[key as keyof typeof panelSettings],
      savePanelSettings: () => undefined,
    }), false);
    assert.deepEqual(JSON.parse(storage.getItem('panel-order') ?? '[]'), ['markets']);
  });
});
