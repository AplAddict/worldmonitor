import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildHoldingsOverlapNotes, buildHoldingsResearchLanes } from '../src/services/holdings-intelligence.ts';

describe('holdings research lanes', () => {
  it('builds only lanes backed by the read-only mirrored symbols', () => {
    const lanes = buildHoldingsResearchLanes(['TSLA', 'TSLL', 'MSTR', 'CEG', 'NLR', 'LMT']);
    assert.deepEqual(lanes.map((lane) => lane.id), [
      'defense-aerospace', 'power-nuclear', 'ev-autonomy', 'digital-assets', 'oil-shipping-geo', 'portfolio-coverage',
    ]);
    assert.deepEqual(lanes.find((lane) => lane.id === 'ev-autonomy')?.symbols, ['TSLA', 'TSLL']);
    assert.deepEqual(lanes.find((lane) => lane.id === 'portfolio-coverage')?.symbols, ['CEG', 'LMT', 'MSTR', 'NLR', 'TSLA', 'TSLL']);
  });

  it('reports shared drivers without claiming portfolio allocations', () => {
    const notes = buildHoldingsOverlapNotes(['TSLA', 'TSLL', 'MSTR', 'WULF', 'HON', 'HONA', 'CEG', 'NLR']);
    assert.ok(notes.some((note) => note.startsWith('TSLA + TSLL')));
    assert.ok(notes.some((note) => note.startsWith('Crypto proxies')));
    assert.ok(notes.some((note) => note.startsWith('HON + HONA')));
    assert.ok(notes.some((note) => note.startsWith('CEG + NLR')));
    assert.ok(notes.every((note) => !/quantity|cost basis|allocation/i.test(note)));
  });

  it('returns no research lanes for an empty or unknown mirror', () => {
    assert.deepEqual(buildHoldingsResearchLanes([]), []);
    assert.deepEqual(buildHoldingsResearchLanes(['UNKNOWN']), [
      {
        id: 'portfolio-coverage',
        title: 'Earnings & catalyst coverage',
        subtitle: 'A research checklist for every mirrored symbol, without exposing brokerage data.',
        symbols: ['UNKNOWN'],
        dataSources: ['Earnings calendar', 'Stock analysis', 'Daily market brief'],
        review: 'Use the watchlist and calendar panels to schedule evidence reviews before known events.',
      },
    ]);
  });
});
