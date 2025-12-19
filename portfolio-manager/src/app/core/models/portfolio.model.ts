export interface Holding {
    id: string;
    symbol: string;
    name: string;
    shares: number;
    avgCost: number;
    currentPrice: number;
    type: 'stock' | 'etf' | 'bond' | 'mutual_fund' | 'crypto' | 'cash' | 'other';
}

export interface Portfolio {
    id: string;
    name: string;
    broker: string;
    accountNumber?: string;
    holdings: Holding[];
    createdAt: Date;
    updatedAt: Date;
}

export function calculateHoldingValue(holding: Holding): number {
    return holding.shares * holding.currentPrice;
}

export function calculateHoldingCost(holding: Holding): number {
    return holding.shares * holding.avgCost;
}

export function calculateHoldingGainLoss(holding: Holding): number {
    return calculateHoldingValue(holding) - calculateHoldingCost(holding);
}

export function calculateHoldingGainLossPercent(holding: Holding): number {
    const cost = calculateHoldingCost(holding);
    if (cost === 0) return 0;
    return ((calculateHoldingValue(holding) - cost) / cost) * 100;
}

export function calculatePortfolioValue(portfolio: Portfolio): number {
    return portfolio.holdings.reduce((sum, h) => sum + calculateHoldingValue(h), 0);
}

export function calculatePortfolioCost(portfolio: Portfolio): number {
    return portfolio.holdings.reduce((sum, h) => sum + calculateHoldingCost(h), 0);
}

export function generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}
