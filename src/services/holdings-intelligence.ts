/**
 * Holdings-aware research lanes.
 *
 * IMPORTANT: This module receives the symbol-only Invest mirror. It deliberately
 * has no account, quantity, cost-basis, cash, order, or brokerage-session data.
 * It therefore describes research coverage, never allocation or a trade signal.
 */

export interface HoldingsResearchLane {
  id: string;
  title: string;
  subtitle: string;
  symbols: string[];
  dataSources: string[];
  review: string;
  riskNote?: string;
}

interface LaneDefinition extends Omit<HoldingsResearchLane, 'symbols'> {
  symbols: readonly string[];
}

export const HOLDINGS_RESEARCH_LANES: readonly LaneDefinition[] = [
  {
    id: 'defense-aerospace', title: 'Defense & aerospace command',
    subtitle: 'Contracts, appropriations, backlog and regional-demand read-throughs.',
    symbols: ['HON', 'HONA', 'LMT', 'LHX', 'ESLT', 'POWW', 'SPCX'],
    dataSources: ['Defense patents', 'Sanctions pressure', 'Government / Middle East news'],
    review: 'Review around awards, NDAA/appropriations milestones and earnings.',
  },
  {
    id: 'power-nuclear', title: 'Nuclear & power demand',
    subtitle: 'Power demand, uranium/fuel policy, grid constraints and data-center transmission.',
    symbols: ['CEG', 'NLR'],
    dataSources: ['Energy complex', 'Energy disruptions', 'Trade policy'],
    review: 'Review power-market, reactor-policy and hyperscaler-demand changes.',
  },
  {
    id: 'ai-infrastructure', title: 'AI infrastructure & software',
    subtitle: 'AI capex, semis, enterprise demand and digital-infrastructure exposure.',
    symbols: ['AAPL', 'QCOM', 'ADBE', 'INTU', 'NBIS', 'WULF', 'AMT', 'ADP'],
    dataSources: ['Technology news', 'AI/ML news', 'Stock analysis'],
    review: 'Review at earnings, capex guidance and material product / funding changes.',
  },
  {
    id: 'ev-autonomy', title: 'EV, batteries & autonomy',
    subtitle: 'Delivery, pricing, policy, certification and cash-runway catalysts.',
    symbols: ['TSLA', 'TSLL', 'RIVN', 'ENVX', 'ACHR'],
    dataSources: ['Trade policy', 'Technology news', 'Earnings calendar'],
    review: 'Review before deliveries, earnings, certification and capital-markets events.',
    riskNote: 'TSLL is a daily-reset leveraged product: track it separately from TSLA.',
  },
  {
    id: 'digital-assets', title: 'Crypto-proxy risk',
    subtitle: 'Bitcoin / digital-asset transmission, miner economics and financing sensitivity.',
    symbols: ['MSTR', 'WULF', 'SOLS', 'QNT'],
    dataSources: ['Crypto', 'BTC ETF tracker', 'Trade policy'],
    review: 'Review underlying-asset moves, issuance/financing and regulatory events.',
    riskNote: 'These may share crypto-beta; they are not independent diversification.',
  },
  {
    id: 'compounders', title: 'Quality compounders',
    subtitle: 'Operating trends, revisions, margins, cash returns and peer read-throughs.',
    symbols: ['CPRT', 'LKQ', 'ULTA', 'TD', 'UNH', 'VZ'],
    dataSources: ['Stock analysis', 'Financial news', 'Earnings calendar'],
    review: 'Review after earnings, material filings and sector-specific policy changes.',
  },
  {
    id: 'financials-platforms', title: 'Financial platforms & consumer internet',
    subtitle: 'Credit conditions, consumer activity, transaction trends and regulatory read-throughs.',
    symbols: ['SOFI', 'TD', 'EBAY'],
    dataSources: ['Financial news', 'Financial stress', 'Stock analysis'],
    review: 'Review credit trends, consumer data, earnings and material regulatory changes.',
  },
  {
    id: 'industrial-materials', title: 'Industrial & materials cycle',
    subtitle: 'Manufacturing, infrastructure, trade policy and commodity-demand transmission.',
    symbols: ['NUE', 'ESI', 'HON'],
    dataSources: ['Trade policy', 'Supply chain', 'Metals & materials'],
    review: 'Review industrial data, trade-policy changes and earnings guidance.',
  },
  {
    id: 'core-funds', title: 'Core funds & diversified sleeves',
    subtitle: 'Index, factor and allocation products monitored for macro/factor overlap—not holdings weights.',
    symbols: ['VTI', 'MDY', 'FSTA', 'PGJ', 'BPTRX', 'CGSD', 'BND', 'SCHD', 'JEPQ'],
    dataSources: ['Market regime', 'Sector heatmap', 'Yield curve'],
    review: 'Review regime, factor leadership, rates and distribution-calendar changes.',
  },
  {
    id: 'income-real-assets', title: 'Income & real-asset sensitivity',
    subtitle: 'Rates, credit, payout durability and infrastructure/REIT transmission.',
    symbols: ['SCHD', 'JEPQ', 'BIP', 'AMT', 'ARI', 'SBRA', 'BND'],
    dataSources: ['Yield curve', 'Financial stress', 'Macro indicators'],
    review: 'Review around rate decisions, credit stress and distribution announcements.',
  },
  {
    id: 'special-situations', title: 'Special situations & capital-markets watch',
    subtitle: 'Corporate actions, dilution, liquidity and binary-catalyst surveillance.',
    symbols: ['GME', 'GME.WS', 'HONA', 'POWW', 'ACHR', 'ENVX', 'RIVN', 'NBIS', 'SOLS'],
    dataSources: ['SEC / filing news', 'Stock analysis', 'Earnings calendar'],
    review: 'Review filings, shelves, converts, ATM programs and corporate-action notices.',
    riskNote: 'This is an evidence queue, not an automatic buy/sell queue.',
  },
  {
    id: 'oil-shipping-geo', title: 'Oil, shipping & geopolitical transmission',
    subtitle: 'Chokepoints, sanctions and conflict pathways relevant to energy and defense exposure.',
    symbols: ['USO', 'CEG', 'LMT', 'LHX', 'ESLT', 'HON'],
    dataSources: ['Hormuz tracker', 'Energy crisis', 'Sanctions pressure', 'Market implications'],
    review: 'Review when chokepoint, sanctions or conflict conditions materially change.',
  },
  {
    id: 'portfolio-coverage', title: 'Earnings & catalyst coverage',
    subtitle: 'A research checklist for every mirrored symbol, without exposing brokerage data.',
    symbols: [],
    dataSources: ['Earnings calendar', 'Stock analysis', 'Daily market brief'],
    review: 'Use the watchlist and calendar panels to schedule evidence reviews before known events.',
  },
];

export function buildHoldingsResearchLanes(mirroredSymbols: readonly string[]): HoldingsResearchLane[] {
  const held = new Set(mirroredSymbols.map((symbol) => symbol.trim().toUpperCase()));
  return HOLDINGS_RESEARCH_LANES.map((lane) => {
    const symbols = lane.id === 'portfolio-coverage'
      ? [...held].sort()
      : lane.symbols.filter((symbol) => held.has(symbol));
    return { ...lane, symbols: [...symbols], dataSources: [...lane.dataSources] };
  }).filter((lane) => lane.symbols.length > 0);
}

export function buildHoldingsOverlapNotes(mirroredSymbols: readonly string[]): string[] {
  const held = new Set(mirroredSymbols.map((symbol) => symbol.trim().toUpperCase()));
  const notes: string[] = [];
  if (held.has('TSLA') && held.has('TSLL')) notes.push('TSLA + TSLL: direct equity and daily-reset leveraged exposure share a driver.');
  if (['MSTR', 'WULF', 'SOLS', 'QNT'].filter((symbol) => held.has(symbol)).length >= 2) notes.push('Crypto proxies: multiple symbols may transmit the same digital-asset / financing risk.');
  if (held.has('HON') && held.has('HONA')) notes.push('HON + HONA: verify corporate-action and parent/child treatment with primary documents.');
  if (held.has('CEG') && held.has('NLR')) notes.push('CEG + NLR: both have nuclear / power-demand sensitivity.');
  if (held.has('CPRT') && held.has('LKQ')) notes.push('CPRT + LKQ: both connect to auto repair / salvage-cycle conditions.');
  if (['BIP', 'AMT', 'ARI', 'SBRA', 'BND'].filter((symbol) => held.has(symbol)).length >= 2) notes.push('Income / real assets: rates, credit and refinancing conditions can be a shared driver.');
  return notes;
}
