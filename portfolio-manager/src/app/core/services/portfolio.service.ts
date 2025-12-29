import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, tap, map, from } from 'rxjs';
import { Portfolio, Holding, generateId, calculatePortfolioValue } from '../models/portfolio.model';
import { ElectronStorageService } from './electron-storage.service';

@Injectable({
    providedIn: 'root'
})
export class PortfolioService {
    private readonly API_URL = 'http://localhost:3000/portfolios';

    private portfoliosSignal = signal<Portfolio[]>([]);

    readonly portfolios = this.portfoliosSignal.asReadonly();

    readonly totalValue = computed(() =>
        this.portfoliosSignal().reduce((sum, p) => sum + calculatePortfolioValue(p), 0)
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
            const portfolios = await this.electronStorage.readCollection<Portfolio>('portfolios');
            const parsed = portfolios.map(p => ({
                ...p,
                createdAt: new Date(p.createdAt),
                updatedAt: new Date(p.updatedAt)
            }));
            this.portfoliosSignal.set(parsed);
        } catch (err) {
            console.error('Error loading portfolios from Electron:', err);
        }
    }

    private loadFromServer(): void {
        this.http.get<Portfolio[]>(this.API_URL).subscribe({
            next: (portfolios) => {
                const parsed = portfolios.map(p => ({
                    ...p,
                    createdAt: new Date(p.createdAt),
                    updatedAt: new Date(p.updatedAt)
                }));
                this.portfoliosSignal.set(parsed);
            },
            error: (err) => console.error('Error loading portfolios:', err)
        });
    }

    private async saveToElectron(): Promise<void> {
        try {
            await this.electronStorage.writeCollection('portfolios', this.portfoliosSignal());
        } catch (err) {
            console.error('Error saving portfolios to Electron:', err);
        }
    }

    getById(id: string): Portfolio | undefined {
        return this.portfoliosSignal().find(p => p.id === id);
    }

    create(data: Omit<Portfolio, 'id' | 'holdings' | 'createdAt' | 'updatedAt'>): void {
        const now = new Date();
        const portfolio: Portfolio = {
            ...data,
            id: generateId(),
            holdings: [],
            createdAt: now,
            updatedAt: now
        };

        if (this.electronStorage.isElectron()) {
            this.portfoliosSignal.update(portfolios => [...portfolios, portfolio]);
            this.saveToElectron();
        } else {
            this.http.post<Portfolio>(this.API_URL, portfolio).subscribe({
                next: (saved) => {
                    this.portfoliosSignal.update(portfolios => [...portfolios, {
                        ...saved,
                        createdAt: new Date(saved.createdAt),
                        updatedAt: new Date(saved.updatedAt)
                    }]);
                },
                error: (err) => console.error('Error creating portfolio:', err)
            });
        }
    }

    update(id: string, data: Partial<Omit<Portfolio, 'id' | 'createdAt'>>): void {
        const existing = this.getById(id);
        if (!existing) return;

        const updated = { ...existing, ...data, updatedAt: new Date() };

        if (this.electronStorage.isElectron()) {
            this.portfoliosSignal.update(portfolios =>
                portfolios.map(p => p.id === id ? updated : p)
            );
            this.saveToElectron();
        } else {
            this.http.put<Portfolio>(`${this.API_URL}/${id}`, updated).subscribe({
                next: () => {
                    this.portfoliosSignal.update(portfolios =>
                        portfolios.map(p => p.id === id ? updated : p)
                    );
                },
                error: (err) => console.error('Error updating portfolio:', err)
            });
        }
    }

    delete(id: string): void {
        if (this.electronStorage.isElectron()) {
            this.portfoliosSignal.update(portfolios =>
                portfolios.filter(p => p.id !== id)
            );
            this.saveToElectron();
        } else {
            this.http.delete(`${this.API_URL}/${id}`).subscribe({
                next: () => {
                    this.portfoliosSignal.update(portfolios =>
                        portfolios.filter(p => p.id !== id)
                    );
                },
                error: (err) => console.error('Error deleting portfolio:', err)
            });
        }
    }

    addHolding(portfolioId: string, data: Omit<Holding, 'id'>): void {
        const portfolio = this.getById(portfolioId);
        if (!portfolio) return;

        const holding: Holding = { ...data, id: generateId() };
        const updated = {
            ...portfolio,
            holdings: [...portfolio.holdings, holding],
            updatedAt: new Date()
        };

        if (this.electronStorage.isElectron()) {
            this.portfoliosSignal.update(portfolios =>
                portfolios.map(p => p.id === portfolioId ? updated : p)
            );
            this.saveToElectron();
        } else {
            this.http.put<Portfolio>(`${this.API_URL}/${portfolioId}`, updated).subscribe({
                next: () => {
                    this.portfoliosSignal.update(portfolios =>
                        portfolios.map(p => p.id === portfolioId ? updated : p)
                    );
                },
                error: (err) => console.error('Error adding holding:', err)
            });
        }
    }

    /**
     * Add multiple holdings at once (for CSV import)
     */
    addHoldings(portfolioId: string, holdings: Omit<Holding, 'id'>[]): void {
        const portfolio = this.getById(portfolioId);
        if (!portfolio || holdings.length === 0) return;

        const newHoldings: Holding[] = holdings.map(h => ({
            ...h,
            id: generateId()
        }));

        const updated = {
            ...portfolio,
            holdings: [...portfolio.holdings, ...newHoldings],
            updatedAt: new Date()
        };

        if (this.electronStorage.isElectron()) {
            this.portfoliosSignal.update(portfolios =>
                portfolios.map(p => p.id === portfolioId ? updated : p)
            );
            this.saveToElectron();
        } else {
            this.http.put<Portfolio>(`${this.API_URL}/${portfolioId}`, updated).subscribe({
                next: () => {
                    this.portfoliosSignal.update(portfolios =>
                        portfolios.map(p => p.id === portfolioId ? updated : p)
                    );
                },
                error: (err) => console.error('Error adding holdings:', err)
            });
        }
    }

    updateHolding(portfolioId: string, holdingId: string, data: Partial<Omit<Holding, 'id'>>): void {
        const portfolio = this.getById(portfolioId);
        if (!portfolio) return;

        const updated = {
            ...portfolio,
            holdings: portfolio.holdings.map(h =>
                h.id === holdingId ? { ...h, ...data } : h
            ),
            updatedAt: new Date()
        };

        if (this.electronStorage.isElectron()) {
            this.portfoliosSignal.update(portfolios =>
                portfolios.map(p => p.id === portfolioId ? updated : p)
            );
            this.saveToElectron();
        } else {
            this.http.put<Portfolio>(`${this.API_URL}/${portfolioId}`, updated).subscribe({
                next: () => {
                    this.portfoliosSignal.update(portfolios =>
                        portfolios.map(p => p.id === portfolioId ? updated : p)
                    );
                },
                error: (err) => console.error('Error updating holding:', err)
            });
        }
    }

    deleteHolding(portfolioId: string, holdingId: string): void {
        const portfolio = this.getById(portfolioId);
        if (!portfolio) return;

        const updated = {
            ...portfolio,
            holdings: portfolio.holdings.filter(h => h.id !== holdingId),
            updatedAt: new Date()
        };

        if (this.electronStorage.isElectron()) {
            this.portfoliosSignal.update(portfolios =>
                portfolios.map(p => p.id === portfolioId ? updated : p)
            );
            this.saveToElectron();
        } else {
            this.http.put<Portfolio>(`${this.API_URL}/${portfolioId}`, updated).subscribe({
                next: () => {
                    this.portfoliosSignal.update(portfolios =>
                        portfolios.map(p => p.id === portfolioId ? updated : p)
                    );
                },
                error: (err) => console.error('Error deleting holding:', err)
            });
        }
    }

    /**
     * Batch update holding prices (for price refresh feature)
     * Updates all prices in a single HTTP request to avoid race conditions
     */
    updateHoldingPrices(portfolioId: string, priceUpdates: Map<string, number>): Observable<void> {
        const portfolio = this.getById(portfolioId);
        if (!portfolio) return of(void 0);

        const updated = {
            ...portfolio,
            holdings: portfolio.holdings.map(h => {
                const newPrice = priceUpdates.get(h.symbol.toUpperCase());
                return newPrice !== undefined ? { ...h, currentPrice: newPrice } : h;
            }),
            updatedAt: new Date()
        };

        if (this.electronStorage.isElectron()) {
            this.portfoliosSignal.update(portfolios =>
                portfolios.map(p => p.id === portfolioId ? updated : p)
            );
            return from(this.saveToElectron());
        } else {
            return this.http.put<Portfolio>(`${this.API_URL}/${portfolioId}`, updated).pipe(
                tap(() => {
                    this.portfoliosSignal.update(portfolios =>
                        portfolios.map(p => p.id === portfolioId ? updated : p)
                    );
                }),
                map(() => void 0)
            );
        }
    }
}
