import { Panel } from './Panel';
import { escapeHtml, sanitizeUrl, unsafeRawHtml } from '@/utils/sanitize';
import type { CatalystBoard, CatalystItem, CatalystType } from '@/services/catalyst-board';

const TYPE_LABEL: Record<CatalystType, string> = {
  earnings: 'Earnings',
  guidance: 'Guidance',
  analyst: 'Analyst action',
  corporate: 'Corporate',
  regulation: 'Policy / regulation',
  'supply-chain': 'Supply chain',
  macro: 'Macro',
  market: 'Market',
};

function itemHtml(item: CatalystItem): string {
  const matched = item.symbols.length
    ? `<span style="color:var(--semantic-info);font-size:10px">${escapeHtml(item.symbols.join(' · '))}</span>`
    : '';
  const time = item.publishedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const href = sanitizeUrl(item.link);
  const title = escapeHtml(item.title);
  const headline = href
    ? `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer" style="color:var(--text-primary);text-decoration:none">${title}</a>`
    : `<span style="color:var(--text-primary)">${title}</span>`;
  return `<article style="padding:8px 0;border-bottom:1px solid var(--border-subtle)">
    <div style="display:flex;gap:6px;justify-content:space-between;align-items:baseline">
      <span style="font-size:10px;color:var(--text-muted)">${escapeHtml(TYPE_LABEL[item.catalystType])}</span>
      <span style="font-size:10px;color:var(--text-dim)">${escapeHtml(time)}</span>
    </div>
    <div style="margin-top:3px;font-size:11px;line-height:1.35">${headline}</div>
    <div style="display:flex;gap:6px;justify-content:space-between;margin-top:5px;font-size:10px;color:var(--text-dim)">
      <span>${escapeHtml(item.source)}</span>${matched}
    </div>
  </article>`;
}

export class CatalystBoardPanel extends Panel {
  constructor() {
    super({
      id: 'catalyst-board',
      title: 'Catalyst Board',
      infoTooltip: 'Fresh, attributable market headlines separated into symbol-only mirror matches and broader market catalysts. A match means headline relevance only—not a position, allocation, or trade instruction.',
      defaultRowSpan: 3,
    });
  }

  renderBoard(board: CatalystBoard, mirrorStatus: 'ok' | 'stale' | 'unavailable', mirrorSymbolCount: number): void {
    if (board.status === 'empty') {
      this.setDataBadge('unavailable');
      this.showRetrying('No attributable market catalysts with verifiable timestamps are available in the selected time window.');
      return;
    }
    const watchedTitle = mirrorStatus === 'ok'
      ? `Watched-symbol catalysts · ${mirrorSymbolCount} symbol mirror`
      : mirrorStatus === 'stale'
        ? 'Watched-symbol catalysts unavailable · mirror stale'
        : 'Watched-symbol catalysts unavailable · mirror unavailable';
    const watched = mirrorStatus === 'ok' && board.watched.length
      ? board.watched.map(itemHtml).join('')
      : `<div style="padding:7px 0;color:var(--text-dim);font-size:10px">${mirrorStatus === 'ok' ? 'No current headline matched the symbol-only mirror.' : 'The symbol-only mirror is excluded until it is healthy.'}</div>`;
    const broad = board.broad.length
      ? board.broad.map(itemHtml).join('')
      : '<div style="padding:7px 0;color:var(--text-dim);font-size:10px">No additional broad market catalysts in this window.</div>';
    this.setDataBadge('live', `${board.watched.length + board.broad.length} fresh catalysts`);
    this.setSafeContent(unsafeRawHtml(`<div style="padding:0 2px">
      <div style="font-size:10px;color:var(--text-dim);margin-bottom:7px">Current, attributed catalyst scan. Headline matching is research triage only; verify the linked source before acting.</div>
      <section><strong style="font-size:10px;text-transform:uppercase;letter-spacing:.06em">${escapeHtml(watchedTitle)}</strong>${watched}</section>
      <section style="margin-top:10px"><strong style="font-size:10px;text-transform:uppercase;letter-spacing:.06em">Broader market catalysts</strong>${broad}</section>
    </div>`, 'CatalystBoardPanel only interpolates escaped source-backed fields'));
  }
}
