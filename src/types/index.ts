/**
 * Represents a cryptocurrency holding in the user's portfolio.
 * This is used to display the user's assets and calculate potential harvesting gains.
 */
export interface Holding {
  coin: string;               // Symbol of the coin (e.g., 'BTC', 'ETH')
  coinName: string;           // Full name of the coin (e.g., 'Bitcoin', 'Ethereum')
  logo: string;               // Data URI or path to the coin logo image
  currentPrice: number;       // Current market price of the coin in INR (₹)
  totalHolding: number;       // Total amount of the coin owned by the user
  averageBuyPrice: number;    // Average price at which the user bought the coin (cost basis)
  
  // Short Term Capital Gains details (assets held for less than the threshold period, e.g., 12 months)
  stcg: {
    balance: number;          // Quantity of holdings qualifying for short-term gains
    gain: number;             // Total unrealized short-term gains/losses in INR (₹)
  };
  
  // Long Term Capital Gains details (assets held for longer than the threshold period)
  ltcg: {
    balance: number;          // Quantity of holdings qualifying for long-term gains
    gain: number;             // Total unrealized long-term gains/losses in INR (₹)
  };
}

/**
 * Represents the realized capital gains of the user before tax loss harvesting.
 * This is fetched from the user's historical transactions.
 */
export interface CapitalGains {
  stcg: {
    profits: number;          // Realized short-term profits in INR (₹)
    losses: number;           // Realized short-term losses in INR (₹)
  };
  ltcg: {
    profits: number;          // Realized long-term profits in INR (₹)
    losses: number;           // Realized long-term losses in INR (₹)
  };
}
