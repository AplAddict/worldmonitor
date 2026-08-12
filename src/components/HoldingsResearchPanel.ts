import { Panel } from './Panel';
import { escapeHtml, unsafeRawHtml } from '@/utils/sanitize';
import {
  buildHoldingsCoverage,
  buildHoldingsOverlapNotes,
  buildHoldingsResearchLanes,
  type HoldingsResearchLane,
} from '@/services/holdings-intelligence';
import type { InvestWatchlistMirror } from '@/services/market-watchlist';

function laneHtml(lane: HoldingsResearchLane): string {
  const symbols = lane.symbols.map((symbol) => `<span class="badge badge-neutral">${escapeHtml(symbol)}</span>`).join(' ');
  const sources = lane.dataSources.map(escapeHtml).join(' · ');
  return `<article style="padding:10px 0;border-bottom:1px solid var(--border-subtle)">
    <div style="display:flex;justify-content:space-between;gap:8px;align-items:baseline;flex-wrap:wrap">
      <strong style="font-size:12px">${escapeHtml(lane.title)}</strong>
      <span style="color:var(--text-muted);font-size:10px">${lane.symbols.length} mirrored symbol${lane.symbols.length === 1 ? '' : 's'}</span>
    </div>
    <div style="margin-top:4px;color:var(--text-secondary);font-size:11px">${escapeHtml(lane.subtitle)}</div>
    <div style="display:flex;gap:4px;flex-wrap:wrap;margin-top:7px">${symbols}</div>
    <div style="margin-top:7px;color:var(--text-muted);font-size:10px">Sources: ${sources}</div>
    <div style="margin-top:3px;color:var(--text-dim);font-size:10px">${escapeHtml(lane.review)}</div>
    ${lane.riskNote ? `<div style="margin-top:5px;color:var(--semantic-warning);font-size:10px">⚠ ${escapeHtml(lane.riskNote)}</div>` : ''}
  </article>`;
}

export class HoldingsResearchPanel extends Panel {
  constructor() {
    super({ id: 'holdings-research', title: 'Holdings Research Desk', infoTooltip: 'Read-only research lanes built from the symbol-only Invest mirror. No account values, quantities, cost basis, cash, orders, or brokerage access are used.', defaultRowSpan: 3 });
  }

  renderMirror(mirror: InvestWatchlistMirror): void {
    if (mirror.status !== 'ok') {
      this.setDataBadge('unavailable');
      this.showRetrying(mirror.status === 'stale'
        ? 'Invest watchlist mirror is stale and is excluded until refreshed.'
        : 'Holdings research is waiting for the read-only Invest symbol mirror.');
      return;
    }
    const lanes = buildHoldingsResearchLanes(mirror.symbols);
    const coverage = buildHoldingsCoverage(mirror.symbols);
    const overlapNotes = buildHoldingsOverlapNotes(mirror.symbols);
    this.setDataBadge('live', `${mirror.symbols.length} symbols · read-only`);
    if (lanes.length === 0) {
      this.showRetrying('The Invest mirror is healthy but has no eligible symbols.');
      return;
    }
    const updated = mirror.sourceUpdatedAt ? new Date(mirror.sourceUpdatedAt).toLocaleString() : 'unknown';
    const overlap = overlapNotes.length
      ? `<section style="margin:10px 0 4px;padding:8px;border:1px solid var(--border);background:var(--surface)">
          <strong style="font-size:10px;text-transform:uppercase;letter-spacing:.06em">Shared-driver review</strong>
          <ul style="margin:6px 0 0;padding-left:16px;color:var(--text-secondary);font-size:10px">${overlapNotes.map((note) => `<li>${escapeHtml(note)}</li>`).join('')}</ul>
        </section>`
      : '';
    const coverageNote = coverage.unmappedSymbols.length
      ? `<div style="margin:6px 0 10px;padding:7px 8px;border-left:2px solid var(--semantic-warning);color:var(--text-secondary);font-size:10px">${coverage.mappedSymbolCount} of ${coverage.mirroredSymbolCount} mirrored symbols are in a curated driver lane. ${coverage.unmappedSymbols.length} need general ticker research: ${escapeHtml(coverage.unmappedSymbols.join(', '))}.</div>`
      : `<div style="margin:6px 0 10px;color:var(--text-dim);font-size:10px">All ${coverage.mirroredSymbolCount} mirrored symbols have at least one curated driver lane.</div>`;
    this.setSafeContent(unsafeRawHtml(`<div style="padding:0 2px">
      <div style="color:var(--text-dim);font-size:10px;margin-bottom:6px">Invest mirror refreshed ${escapeHtml(updated)}. Symbol-level research coverage only—never allocation, cost basis, or a trade instruction.</div>
      ${coverageNote}
      ${overlap}
      ${lanes.map(laneHtml).join('')}
    </div>`, 'HoldingsResearchPanel renders escaped controlled lane templates'));
  }
}
