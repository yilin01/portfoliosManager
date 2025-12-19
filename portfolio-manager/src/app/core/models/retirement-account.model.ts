export type RetirementAccountType = '401k' | 'traditional_ira' | 'roth_ira' | '403b' | '457b' | 'sep_ira' | 'simple_ira';

export interface RetirementHolding {
    id: string;
    name: string;
    ticker?: string;
    shares: number;
    currentValue: number;
    type: 'stock' | 'bond' | 'target_date' | 'money_market' | 'balanced' | 'other';
}

export interface RetirementAccount {
    id: string;
    name: string;
    type: RetirementAccountType;
    provider: string;
    accountNumber?: string;
    employer?: string;
    holdings: RetirementHolding[];
    currentBalance?: number; // For rollover or accounts without individual holdings
    contributionYTD: number;
    employerMatchYTD?: number;
    vestingPercent?: number;
    createdAt: Date;
    updatedAt: Date;
}

export const CONTRIBUTION_LIMITS_2024 = {
    '401k': { under50: 23000, over50: 30500 },
    '403b': { under50: 23000, over50: 30500 },
    '457b': { under50: 23000, over50: 30500 },
    'traditional_ira': { under50: 7000, over50: 8000 },
    'roth_ira': { under50: 7000, over50: 8000 },
    'sep_ira': { under50: 69000, over50: 69000 },
    'simple_ira': { under50: 16000, over50: 19500 }
};

export function calculateRetirementAccountValue(account: RetirementAccount): number {
    const holdingsValue = account.holdings.reduce((sum, h) => sum + h.currentValue, 0);
    return holdingsValue + (account.currentBalance || 0);
}

export function getContributionLimit(type: RetirementAccountType, isOver50: boolean = false): number {
    const limits = CONTRIBUTION_LIMITS_2024[type];
    return isOver50 ? limits.over50 : limits.under50;
}

export function calculateContributionRemaining(account: RetirementAccount, isOver50: boolean = false): number {
    const limit = getContributionLimit(account.type, isOver50);
    return Math.max(0, limit - account.contributionYTD);
}

export function getAccountTypeLabel(type: RetirementAccountType): string {
    const labels: Record<RetirementAccountType, string> = {
        '401k': '401(k)',
        'traditional_ira': 'Traditional IRA',
        'roth_ira': 'Roth IRA',
        '403b': '403(b)',
        '457b': '457(b)',
        'sep_ira': 'SEP IRA',
        'simple_ira': 'SIMPLE IRA'
    };
    return labels[type];
}
