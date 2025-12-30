import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map, tap } from 'rxjs/operators';
import { RetirementAccount, RetirementHolding, calculateRetirementAccountValue } from '../models/retirement-account.model';
import { generateId } from '../models/portfolio.model';
import { ElectronStorageService } from './electron-storage.service';

@Injectable({
    providedIn: 'root'
})
export class RetirementService {
    private readonly API_URL = 'http://localhost:3000/retirementAccounts';

    private accountsSignal = signal<RetirementAccount[]>([]);

    readonly accounts = this.accountsSignal.asReadonly();

    readonly totalValue = computed(() =>
        this.accountsSignal().reduce((sum, a) => sum + calculateRetirementAccountValue(a), 0)
    );

    constructor(
        private http: HttpClient,
        private electronStorage: ElectronStorageService
    ) {
        this.loadData();
    }

    private loadData(): void {
        if (this.electronStorage.isElectron()) {
            this.loadFromElectron();
        } else {
            this.loadFromServer();
        }
    }

    private async loadFromElectron(): Promise<void> {
        try {
            const accounts = await this.electronStorage.readCollection<RetirementAccount>('retirementAccounts');
            const parsed = accounts.map(a => ({
                ...a,
                createdAt: new Date(a.createdAt),
                updatedAt: new Date(a.updatedAt)
            }));
            this.accountsSignal.set(parsed);
        } catch (err) {
            console.error('Error loading retirement accounts from Electron:', err);
        }
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

    private async saveToElectron(): Promise<void> {
        try {
            await this.electronStorage.writeCollection('retirementAccounts', this.accountsSignal());
        } catch (err) {
            console.error('Error saving retirement accounts to Electron:', err);
        }
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

        if (this.electronStorage.isElectron()) {
            this.accountsSignal.update(accounts => [...accounts, account]);
            this.saveToElectron();
        } else {
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
    }

    update(id: string, data: Partial<Omit<RetirementAccount, 'id' | 'createdAt'>>): void {
        const existing = this.getById(id);
        if (!existing) return;

        const updated = { ...existing, ...data, updatedAt: new Date() };

        if (this.electronStorage.isElectron()) {
            this.accountsSignal.update(accounts =>
                accounts.map(a => a.id === id ? updated : a)
            );
            this.saveToElectron();
        } else {
            this.http.put<RetirementAccount>(`${this.API_URL}/${id}`, updated).subscribe({
                next: () => {
                    this.accountsSignal.update(accounts =>
                        accounts.map(a => a.id === id ? updated : a)
                    );
                },
                error: (err) => console.error('Error updating account:', err)
            });
        }
    }

    delete(id: string): void {
        if (this.electronStorage.isElectron()) {
            this.accountsSignal.update(accounts =>
                accounts.filter(a => a.id !== id)
            );
            this.saveToElectron();
        } else {
            this.http.delete(`${this.API_URL}/${id}`).subscribe({
                next: () => {
                    this.accountsSignal.update(accounts =>
                        accounts.filter(a => a.id !== id)
                    );
                },
                error: (err) => console.error('Error deleting account:', err)
            });
        }
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

        if (this.electronStorage.isElectron()) {
            this.accountsSignal.update(accounts =>
                accounts.map(a => a.id === accountId ? updated : a)
            );
            this.saveToElectron();
        } else {
            this.http.put<RetirementAccount>(`${this.API_URL}/${accountId}`, updated).subscribe({
                next: () => {
                    this.accountsSignal.update(accounts =>
                        accounts.map(a => a.id === accountId ? updated : a)
                    );
                },
                error: (err) => console.error('Error adding holding:', err)
            });
        }
    }

    /**
     * Add multiple holdings at once (for CSV import)
     */
    addHoldings(accountId: string, holdings: Omit<RetirementHolding, 'id'>[]): void {
        const account = this.getById(accountId);
        if (!account || holdings.length === 0) return;

        const newHoldings: RetirementHolding[] = holdings.map(h => ({
            ...h,
            id: generateId()
        }));

        const updated = {
            ...account,
            holdings: [...account.holdings, ...newHoldings],
            updatedAt: new Date()
        };

        if (this.electronStorage.isElectron()) {
            this.accountsSignal.update(accounts =>
                accounts.map(a => a.id === accountId ? updated : a)
            );
            this.saveToElectron();
        } else {
            this.http.put<RetirementAccount>(`${this.API_URL}/${accountId}`, updated).subscribe({
                next: () => {
                    this.accountsSignal.update(accounts =>
                        accounts.map(a => a.id === accountId ? updated : a)
                    );
                },
                error: (err) => console.error('Error adding holdings:', err)
            });
        }
    }

    updateHoldingPrices(accountId: string, priceUpdates: Map<string, number>): Observable<void> {
        const account = this.getById(accountId);
        if (!account) return of(void 0);

        const updated = {
            ...account,
            holdings: account.holdings.map(h => {
                const newPrice = h.ticker ? priceUpdates.get(h.ticker.toUpperCase()) : undefined;
                if (newPrice !== undefined && h.shares) {
                    return { ...h, currentValue: h.shares * newPrice };
                }
                return h;
            }),
            updatedAt: new Date()
        };

        if (this.electronStorage.isElectron()) {
            this.accountsSignal.update(accounts =>
                accounts.map(a => a.id === accountId ? updated : a)
            );
            this.saveToElectron();
            return of(void 0);
        } else {
            return this.http.put<RetirementAccount>(`${this.API_URL}/${accountId}`, updated).pipe(
                tap(() => {
                    this.accountsSignal.update(accounts =>
                        accounts.map(a => a.id === accountId ? updated : a)
                    );
                }),
                map(() => void 0)
            );
        }
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

        if (this.electronStorage.isElectron()) {
            this.accountsSignal.update(accounts =>
                accounts.map(a => a.id === accountId ? updated : a)
            );
            this.saveToElectron();
        } else {
            this.http.put<RetirementAccount>(`${this.API_URL}/${accountId}`, updated).subscribe({
                next: () => {
                    this.accountsSignal.update(accounts =>
                        accounts.map(a => a.id === accountId ? updated : a)
                    );
                },
                error: (err) => console.error('Error updating holding:', err)
            });
        }
    }

    deleteHolding(accountId: string, holdingId: string): void {
        const account = this.getById(accountId);
        if (!account) return;

        const updated = {
            ...account,
            holdings: account.holdings.filter(h => h.id !== holdingId),
            updatedAt: new Date()
        };

        if (this.electronStorage.isElectron()) {
            this.accountsSignal.update(accounts =>
                accounts.map(a => a.id === accountId ? updated : a)
            );
            this.saveToElectron();
        } else {
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
}
