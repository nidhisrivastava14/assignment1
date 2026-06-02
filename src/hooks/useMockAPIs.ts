import type { Holding, CapitalGains } from '../types';

// ==========================================
// Custom SVG Logos as Data URIs for Assets
// ==========================================
// These are hand-crafted SVG shapes matching the actual coin branding, encoded as clean base64 data URIs.
// This ensures that the logos load instantaneously and do not rely on third-party network connections.

const BTC_LOGO = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32"><circle cx="16" cy="16" r="16" fill="%23F7931A"/><path d="M10 8h7.5c2.3 0 4.1.8 4.1 3.2 0 1.6-1 2.6-2.3 3 1.7.4 2.8 1.6 2.8 3.5 0 2.6-2 3.7-4.6 3.7H10V8zm3 3v4h3.5c1 0 1.7-.3 1.7-2s-.7-2-1.7-2H13zm0 7v4.4h4.1c1.1 0 1.8-.4 1.8-2.2 0-1.8-.7-2.2-1.8-2.2H13z" fill="white"/></svg>';

const ETH_LOGO = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32"><circle cx="16" cy="16" r="16" fill="%23627EEA"/><path d="M16 3l.2 1.1v17.4l-.2.2-7.8-4.6z" fill="%23C0CBF7"/><path d="M16 3v18.7l7.8-4.6z" fill="white"/><path d="M16 23.2l.1.4V29l-.1-.4-7.8-11z" fill="%23C0CBF7"/><path d="M16 29.2v-6.4l7.8-4.6z" fill="white"/><path d="M16 21.7l-7.8-4.6 7.8-3.6z" fill="%23A1B0E8"/><path d="M16 21.7l7.8-4.6-7.8-3.6z" fill="%23FFFFFF"/></svg>';

const SOL_LOGO = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32"><circle cx="16" cy="16" r="16" fill="%2314F195"/><path d="M7 9.5l3-3h15l-3 3zm18 4l-3 3H7l3-3zm-15 8l-3 3h15l-3-3z" fill="%239945FF"/></svg>';

const ADA_LOGO = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32"><circle cx="16" cy="16" r="16" fill="%230033AD"/><path d="M16 7a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3zm-4.5 2a1.2 1.2 0 1 1 0 2.4 1.2 1.2 0 0 1 0-2.4zm9 0a1.2 1.2 0 1 1 0 2.4 1.2 1.2 0 0 1 0-2.4zm-11 4a1 1 0 1 1 0 2 1 1 0 0 1 0-2zm13 0a1 1 0 1 1 0 2 1 1 0 0 1 0-2zM6.5 18a1 1 0 1 1 0 2 1 1 0 0 1 0-2zm19 0a1 1 0 1 1 0 2 1 1 0 0 1 0-2zM9 22a1.2 1.2 0 1 1 0 2.4 1.2 1.2 0 0 1 0-2.4zm14 0a1.2 1.2 0 1 1 0 2.4 1.2 1.2 0 0 1 0-2.4zM16 23a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3z" fill="white"/></svg>';

const DOT_LOGO = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32"><circle cx="16" cy="16" r="16" fill="%23E6007A"/><circle cx="16" cy="8" r="2.5" fill="white"/><circle cx="10" cy="12" r="2.5" fill="white"/><circle cx="22" cy="12" r="2.5" fill="white"/><circle cx="10" cy="20" r="2.5" fill="white"/><circle cx="22" cy="20" r="2.5" fill="white"/><circle cx="16" cy="24" r="2.5" fill="white"/></svg>';

const XRP_LOGO = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32"><circle cx="16" cy="16" r="16" fill="%2323292F"/><path d="M9 7l7 9-7 9h4l5-6.5L20 25h4l-7-9 7-9h-4l-5 6.5L13 7H9z" fill="white"/></svg>';

const DOGE_LOGO = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32"><circle cx="16" cy="16" r="16" fill="%23BA9F33"/><path d="M9 9h5c3.2 0 5 1.8 5 4.5s-1.8 4.5-5 4.5H9V9zm3.5 2.5v4h1.5c1.4 0 2.2-.8 2.2-2s-.8-2-2.2-2h-1.5zm6.5 2h4V14h-4v1.5z" fill="white"/></svg>';

const AVAX_LOGO = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32"><circle cx="16" cy="16" r="16" fill="%23E84142"/><path d="M16 6l-9 15.5h18L16 6zm0 4.5l5.5 9.5H10.5L16 10.5z" fill="white"/></svg>';

const LINK_LOGO = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32"><circle cx="16" cy="16" r="16" fill="%23375BD2"/><path d="M16 7l6.5 3.8v7.5L16 22l-6.5-3.8v-7.5zm0 3.3L12.3 12.4v4.9L16 19.3l3.7-2.1v-4.9z" fill="white"/></svg>';

const MATIC_LOGO = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32"><circle cx="16" cy="16" r="16" fill="%238247E5"/><path d="M16 7.5l5.5 3.2v6.3L16 20.2l-5.5-3.2v-6.3L16 7.5zm0 3.5l-2.5 1.5v3l2.5 1.5 2.5-1.5v-3L16 11zm-5.5 8l2.5 1.5v3l-2.5-1.5v-3zm11 0l2.5 1.5v3l-2.5-1.5v-3z" fill="white"/></svg>';

const LTC_LOGO = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32"><circle cx="16" cy="16" r="16" fill="%23BEBEBE"/><path d="M12 7h3.5l-2.5 9.5H18v3.5H11V20l1-13zm4.5 5.5l1.5-1.5-6.5-1.5-1 1 6 2z" fill="white"/></svg>';

const UNI_LOGO = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32"><circle cx="16" cy="16" r="16" fill="%23FF007A"/><path d="M16 6.5C11.9 6.5 8.5 9.9 8.5 14c0 3 1.8 5.6 4.4 6.8-.3-1.6-.3-3.2.1-4.7L15 10l1.2 3.6c.5.2.9.5 1.3.8.4-.7 1-1.3 1.7-1.8L18 9l2.5 2.5c1.4.3 2.6 1.1 3.5 2.2.8-.7 1.5-1.5 2-2.4-.9 1.4-2.1 2.6-3.5 3.4.6 1 1 2.2 1.1 3.5.1.8-.1 1.7-.5 2.5.4-.4.8-1 1.1-1.6.2.7.2 1.5-.1 2.2-.2.5-.5 1-.9 1.4-.4.4-.9.7-1.5.9-.6.2-1.2.3-1.9.2-1.5-.2-2.9-.9-3.9-2.1-.9.7-2 1.2-3.2 1.4-1.2.2-2.4-.1-3.4-.7v.3c0 2 1.6 3.6 3.6 3.6h7.2c2 0 3.6-1.6 3.6-3.6V14c0-4.1-3.4-7.5-7.5-7.5z" fill="white"/></svg>';

// ==========================================
// Mock Dataset for Holdings
// ==========================================
// A robust set of 12 real cryptocurrency holdings.
// This data features a mix of profitable assets and loss-making assets
// so that students and users can test the Tax Loss Harvesting calculations effectively.

const MOCK_HOLDINGS: Holding[] = [
  {
    coin: 'BTC',
    coinName: 'Bitcoin',
    logo: BTC_LOGO,
    currentPrice: 5824000,
    totalHolding: 0.125,
    averageBuyPrice: 5412000,
    stcg: { balance: 0.045, gain: 18540 },
    ltcg: { balance: 0.080, gain: 32960 }
  },
  {
    coin: 'ETH',
    coinName: 'Ethereum',
    logo: ETH_LOGO,
    currentPrice: 312000,
    totalHolding: 1.85,
    averageBuyPrice: 338500,
    stcg: { balance: 0.65, gain: -17225 },
    ltcg: { balance: 1.20, gain: -31800 }
  },
  {
    coin: 'SOL',
    coinName: 'Solana',
    logo: SOL_LOGO,
    currentPrice: 14200,
    totalHolding: 35.0,
    averageBuyPrice: 15950,
    stcg: { balance: 15.0, gain: -26250 },
    ltcg: { balance: 20.0, gain: -35000 }
  },
  {
    coin: 'ADA',
    coinName: 'Cardano',
    logo: ADA_LOGO,
    currentPrice: 42.50,
    totalHolding: 2500,
    averageBuyPrice: 38.20,
    stcg: { balance: 1000, gain: 4300 },
    ltcg: { balance: 1500, gain: 6450 }
  },
  {
    coin: 'DOT',
    coinName: 'Polkadot',
    logo: DOT_LOGO,
    currentPrice: 590,
    totalHolding: 120,
    averageBuyPrice: 660,
    stcg: { balance: 40, gain: -2800 },
    ltcg: { balance: 80, gain: -5600 }
  },
  {
    coin: 'XRP',
    coinName: 'Ripple',
    logo: XRP_LOGO,
    currentPrice: 54.80,
    totalHolding: 3000,
    averageBuyPrice: 49.50,
    stcg: { balance: 1000, gain: 5300 },
    ltcg: { balance: 2000, gain: 10600 }
  },
  {
    coin: 'DOGE',
    coinName: 'Dogecoin',
    logo: DOGE_LOGO,
    currentPrice: 12.80,
    totalHolding: 8500,
    averageBuyPrice: 15.40,
    stcg: { balance: 3500, gain: -9100 },
    ltcg: { balance: 5000, gain: -13000 }
  },
  {
    coin: 'AVAX',
    coinName: 'Avalanche',
    logo: AVAX_LOGO,
    currentPrice: 2850,
    totalHolding: 22,
    averageBuyPrice: 2450,
    stcg: { balance: 8, gain: 3200 },
    ltcg: { balance: 14, gain: 5600 }
  },
  {
    coin: 'LINK',
    coinName: 'Chainlink',
    logo: LINK_LOGO,
    currentPrice: 1380,
    totalHolding: 65,
    averageBuyPrice: 1520,
    stcg: { balance: 25, gain: -3500 },
    ltcg: { balance: 40, gain: -5600 }
  },
  {
    coin: 'MATIC',
    coinName: 'Polygon',
    logo: MATIC_LOGO,
    currentPrice: 56.50,
    totalHolding: 4200,
    averageBuyPrice: 69.80,
    stcg: { balance: 1500, gain: -19950 },
    ltcg: { balance: 2700, gain: -35910 }
  },
  {
    coin: 'LTC',
    coinName: 'Litecoin',
    logo: LTC_LOGO,
    currentPrice: 6950,
    totalHolding: 12,
    averageBuyPrice: 6300,
    stcg: { balance: 4, gain: 2600 },
    ltcg: { balance: 8, gain: 5200 }
  },
  {
    coin: 'UNI',
    coinName: 'Uniswap',
    logo: UNI_LOGO,
    currentPrice: 670,
    totalHolding: 80,
    averageBuyPrice: 740,
    stcg: { balance: 30, gain: -2100 },
    ltcg: { balance: 50, gain: -3500 }
  }
];

// ==========================================
// Mock Dataset for Capital Gains
// ==========================================
// This represents the user's ALREADY realized transactions
// for the current tax year. The user can offset these gains.

const MOCK_CAPITAL_GAINS: CapitalGains = {
  stcg: {
    profits: 165000,    // Realized profits this year
    losses: 45000       // Realized losses this year
  },
  ltcg: {
    profits: 320000,    // Realized profits this year
    losses: 110000      // Realized losses this year
  }
};

// ==========================================
// Mock API Handlers
// ==========================================

/**
 * Simulates an API call fetching the user's holdings.
 * Returns a Promise that resolves after a 500ms delay.
 * Includes a small chance of failure to allow testing error states in the UI.
 * 
 * @param shouldFail - Force the API call to fail for testing error UI
 */
export const fetchHoldings = (shouldFail: boolean = false): Promise<Holding[]> => {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (shouldFail) {
        reject(new Error('Internal Server Error: Failed to fetch holdings list.'));
      } else {
        resolve(MOCK_HOLDINGS);
      }
    }, 500);
  });
};

/**
 * Simulates an API call fetching the user's current capital gains summary.
 * Returns a Promise that resolves after a 500ms delay.
 * 
 * @param shouldFail - Force the API call to fail for testing error UI
 */
export const fetchCapitalGains = (shouldFail: boolean = false): Promise<CapitalGains> => {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (shouldFail) {
        reject(new Error('Internal Server Error: Failed to load capital gains records.'));
      } else {
        resolve(MOCK_CAPITAL_GAINS);
      }
    }, 500);
  });
};
