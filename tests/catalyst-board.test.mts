import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { NewsItem } from '../src/types/index.ts';
import { buildCatalystBoard } from '../src/services/catalyst-board.ts';

function item(title: string, publishedAt = '2026-08-12T17:45:00.000Z', source = 'Reuters Markets'): NewsItem {
  return {
    source,
    title,
    link: 'https://example.com/article',
    pubDate: new Date(publishedAt),
    isAlert: false,
  };
}

describe('Catalyst Board', () => {
  it('places fresh watched-symbol earnings catalyst ahead of broad market items', () => {
    const board = buildCatalystBoard([
      item('Apple earnings beat estimates as iPhone revenue accelerates'),
      item('Treasury yields rise ahead of inflation data', '2026-08-12T17:44:00.000Z'),
    ], ['AAPL'], new Date('2026-08-12T18:00:00.000Z'));

    assert.equal(board.status, 'ok');
    assert.equal(board.watched.length, 1);
    assert.deepEqual(board.watched[0]?.symbols, ['AAPL']);
    assert.equal(board.watched[0]?.catalystType, 'earnings');
    assert.equal(board.broad.length, 1);
    assert.equal(board.broad[0]?.catalystType, 'macro');
  });

  it('does not claim symbol relevance from a substring match', () => {
    const board = buildCatalystBoard([
      item('Meta analysis points to broader advertising recovery'),
    ], ['META'], new Date('2026-08-12T18:00:00.000Z'));

    assert.equal(board.watched.length, 0);
    assert.equal(board.broad.length, 1);
  });

  it('excludes missing or stale timestamps instead of presenting false live catalysts', () => {
    const stale = item('NVIDIA guidance lifts chip stocks', '2026-08-10T12:00:00.000Z');
    const missing = item('Apple announces a new product');
    missing.pubDateMissing = true;
    const board = buildCatalystBoard([stale, missing], ['NVDA', 'AAPL'], new Date('2026-08-12T18:00:00.000Z'));

    assert.equal(board.status, 'empty');
    assert.equal(board.watched.length, 0);
    assert.equal(board.broad.length, 0);
  });

  it('keeps only the newest duplicate headline and bounds both lanes', () => {
    const items = [
      item('Microsoft wins cloud contract', '2026-08-12T17:55:00.000Z'),
      item('Microsoft wins cloud contract', '2026-08-12T17:30:00.000Z'),
      ...Array.from({ length: 10 }, (_, index) => item(`Markets update ${index}`, `2026-08-12T${String(17 - Math.floor(index / 2)).padStart(2, '0')}:${index % 2 ? '30' : '00'}:00.000Z`)),
    ];
    const board = buildCatalystBoard(items, ['MSFT'], new Date('2026-08-12T18:00:00.000Z'));

    assert.equal(board.watched.length, 1);
    assert.ok(board.broad.length <= 6);
  });
});
