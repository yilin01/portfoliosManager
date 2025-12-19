export type BankAccountType = 'checking' | 'savings' | 'money_market' | 'cd' | 'other';

export interface BankAccount {
    id: string;
    name: string;
    type: BankAccountType;
    bankName: string;
    accountNumber?: string;
    balance: number;
    interestRate?: number;
    createdAt: Date;
    updatedAt: Date;
}

export function getAccountTypeLabel(type: BankAccountType): string {
    const labels: Record<BankAccountType, string> = {
        'checking': 'Checking',
        'savings': 'Savings',
        'money_market': 'Money Market',
        'cd': 'Certificate of Deposit',
        'other': 'Other'
    };
    return labels[type];
}
