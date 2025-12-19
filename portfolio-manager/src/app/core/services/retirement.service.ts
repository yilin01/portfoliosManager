import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { RetirementAccount, RetirementHolding, calculateRetirementAccountValue } from '../models/retirement-account.model';
import { generateId } from '../models/portfolio.model';

@Injectable({
    providedIn: 'root'
})
export class RetirementService {
    private readonly API_URL = '/api/retirementAccounts';

    private accountsSignal = signal<RetirementAccount[]>([]);

    readonly accounts = this.accountsSignal.asReadonly();

    readonly totalValue = computed(() =>
        this.accountsSignal().reduce((sum, a) => sum + calculateRetirementAccountValue(a), 0)
    );

    constructor(private http: HttpClient) {
        this.loadFromServer();
    }

    private loadFromServer(): void {
        this.http.get<RetirementAccount[]>(this.API_URL).subscribe({
            next: (accounts) => {
                const parsed = accounts.map(a => ({
                    ...a,
                    createdAt: new Date(a.createdAt),
                    updatedAt: new Date(a.updatedAt)
                }));
                this.accountsSignal.set(parsed);
            },
            error: (err) => console.error('Error loading retirement accounts:', err)
        });
    }

    getById(id: string): RetirementAccount | undefined {
        return this.accountsSignal().find(a => a.id === id);
    }

    create(data: Omit<RetirementAccount, 'id' | 'holdings' | 'createdAt' | 'updatedAt'>): void {
        const now = new Date();
        const account: RetirementAccount = {
            ...data,
            id: generateId(),
            holdings: [],
            createdAt: now,
            updatedAt: now
        };

        this.http.post<RetirementAccount>(this.API_URL, account).subscribe({
            next: (saved) => {
                this.accountsSignal.update(accounts => [...accounts, {
                    ...saved,
                    createdAt: new Date(saved.createdAt),
                    updatedAt: new Date(saved.updatedAt)
                }]);
            },
            error: (err) => console.error('Error creating account:', err)
        });
    }

    update(id: string, data: Partial<Omit<RetirementAccount, 'id' | 'createdAt'>>): void {
        const existing = this.getById(id);
        if (!existing) return;

        const updated = { ...existing, ...data, updatedAt: new Date() };

        this.http.put<RetirementAccount>(`${this.API_URL}/${id}`, updated).subscribe({
            next: () => {
                this.accountsSignal.update(accounts =>
                    accounts.map(a => a.id === id ? updated : a)
                );
            },
            error: (err) => console.error('Error updating account:', err)
        });
    }

    delete(id: string): void {
        this.http.delete(`${this.API_URL}/${id}`).subscribe({
            next: () => {
                this.accountsSignal.update(accounts =>
                    accounts.filter(a => a.id !== id)
                );
            },
            error: (err) => console.error('Error deleting account:', err)
        });
    }

    addHolding(accountId: string, data: Omit<RetirementHolding, 'id'>): void {
        const account = this.getById(accountId);
        if (!account) return;

        const holding: RetirementHolding = { ...data, id: generateId() };
        const updated = {
            ...account,
            holdings: [...account.holdings, holding],
            updatedAt: new Date()
        };

        this.http.put<RetirementAccount>(`${this.API_URL}/${accountId}`, updated).subscribe({
            next: () => {
                this.accountsSignal.update(accounts =>
                    accounts.map(a => a.id === accountId ? updated : a)
                );
            },
            error: (err) => console.error('Error adding holding:', err)
        });
    }

    updateHolding(accountId: string, holdingId: string, data: Partial<Omit<RetirementHolding, 'id'>>): void {
        const account = this.getById(accountId);
        if (!account) return;

        const updated = {
            ...account,
            holdings: account.holdings.map(h =>
                h.id === holdingId ? { ...h, ...data } : h
            ),
            updatedAt: new Date()
        };

        this.http.put<RetirementAccount>(`${this.API_URL}/${accountId}`, updated).subscribe({
            next: () => {
                this.accountsSignal.update(accounts =>
                    accounts.map(a => a.id === accountId ? updated : a)
                );
            },
            error: (err) => console.error('Error updating holding:', err)
        });
    }

    deleteHolding(accountId: string, holdingId: string): void {
        const account = this.getById(accountId);
        if (!account) return;

        const updated = {
            ...account,
            holdings: account.holdings.filter(h => h.id !== holdingId),
            updatedAt: new Date()
        };

        this.http.put<RetirementAccount>(`${this.API_URL}/${accountId}`, updated).subscribe({
            next: () => {
                this.accountsSignal.update(accounts =>
                    accounts.map(a => a.id === accountId ? updated : a)
                );
            },
            error: (err) => console.error('Error deleting holding:', err)
        });
    }
}
