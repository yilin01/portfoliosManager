import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BankAccount } from '../models/bank-account.model';
import { generateId } from '../models/portfolio.model';
import { ElectronStorageService } from './electron-storage.service';

@Injectable({
    providedIn: 'root'
})
export class BankService {
    private readonly API_URL = 'http://localhost:3000/bankAccounts';

    private accountsSignal = signal<BankAccount[]>([]);

    readonly accounts = this.accountsSignal.asReadonly();

    readonly totalBalance = computed(() =>
        this.accountsSignal().reduce((sum, a) => sum + a.balance, 0)
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
            const accounts = await this.electronStorage.readCollection<BankAccount>('bankAccounts');
            const parsed = accounts.map(a => ({
                ...a,
                createdAt: new Date(a.createdAt),
                updatedAt: new Date(a.updatedAt)
            }));
            this.accountsSignal.set(parsed);
        } catch (err) {
            console.error('Error loading bank accounts from Electron:', err);
        }
    }

    private loadFromServer(): void {
        this.http.get<BankAccount[]>(this.API_URL).subscribe({
            next: (accounts) => {
                const parsed = accounts.map(a => ({
                    ...a,
                    createdAt: new Date(a.createdAt),
                    updatedAt: new Date(a.updatedAt)
                }));
                this.accountsSignal.set(parsed);
            },
            error: (err) => console.error('Error loading bank accounts:', err)
        });
    }

    private async saveToElectron(): Promise<void> {
        try {
            await this.electronStorage.writeCollection('bankAccounts', this.accountsSignal());
        } catch (err) {
            console.error('Error saving bank accounts to Electron:', err);
        }
    }

    getById(id: string): BankAccount | undefined {
        return this.accountsSignal().find(a => a.id === id);
    }

    create(data: Omit<BankAccount, 'id' | 'createdAt' | 'updatedAt'>): void {
        const now = new Date();
        const account: BankAccount = {
            ...data,
            id: generateId(),
            createdAt: now,
            updatedAt: now
        };

        if (this.electronStorage.isElectron()) {
            this.accountsSignal.update(accounts => [...accounts, account]);
            this.saveToElectron();
        } else {
            this.http.post<BankAccount>(this.API_URL, account).subscribe({
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

    update(id: string, data: Partial<Omit<BankAccount, 'id' | 'createdAt'>>): void {
        const existing = this.getById(id);
        if (!existing) return;

        const updated = { ...existing, ...data, updatedAt: new Date() };

        if (this.electronStorage.isElectron()) {
            this.accountsSignal.update(accounts =>
                accounts.map(a => a.id === id ? updated : a)
            );
            this.saveToElectron();
        } else {
            this.http.put<BankAccount>(`${this.API_URL}/${id}`, updated).subscribe({
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
}
