import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildHoldingsCoverage,
  buildHoldingsOverlapNotes,
  buildHoldingsResearchLanes,
} from '../src/services/holdings-intelligence.ts';

describe('holdings research lanes', () => {
  it('builds only lanes backed by the read-only mirrored symbols', () => {
    const lanes = buildHoldingsResearchLanes(['tsla', 'ceg', 'unknown']);
    assert.deepEqual(lanes.map((lane) => [lane.id, lane.symbols]), [
      ['power-nuclear', ['CEG']],
      ['ev-autonomy', ['TSLA']],
      ['oil-shipping-geo', ['CEG']],
      ['portfolio-coverage', ['CEG', 'TSLA', 'UNKNOWN']],
    ]);
  });

  it('reports shared drivers without claiming portfolio allocations', () => {
    const notes = buildHoldingsOverlapNotes(['TSLA', 'TSLL', 'MSTR', 'WULF']);
    assert.equal(notes.length, 2);
    assert.ok(notes.every((note) => !/allocation|weight|percent/i.test(note)));
  });

  it('returns no research lanes for an empty or unknown mirror', () => {
    assert.deepEqual(buildHoldingsResearchLanes([]), []);
    assert.deepEqual(buildHoldingsResearchLanes(['UNKNOWN']).map((lane) => lane.id), ['portfolio-coverage']);
  });

  it('separates mapped and unmapped research coverage without treating symbols as positions', () => {
    const coverage = buildHoldingsCoverage(['TSLA', 'CEG', 'ZZZZ', 'tsla']);
    assert.deepEqual(coverage, {
      mirroredSymbolCount: 3,
      mappedSymbols: ['CEG', 'TSLA'],
      unmappedSymbols: ['ZZZZ'],
      mappedSymbolCount: 2,
    });
  });
});
