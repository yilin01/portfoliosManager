import { Injectable } from '@angular/core';

// Type declaration for the Electron API exposed via preload
declare global {
    interface Window {
        electronAPI?: {
            isElectron: boolean;
            readData: () => Promise<DatabaseSchema>;
            writeData: (data: DatabaseSchema) => Promise<{ success: boolean; error?: string }>;
        };
    }
}

export interface DatabaseSchema {
    portfolios: any[];
    retirementAccounts: any[];
    bankAccounts: any[];
}

@Injectable({
    providedIn: 'root'
})
export class ElectronStorageService {

    /**
     * Check if running in Electron environment
     */
    isElectron(): boolean {
        return !!(window.electronAPI?.isElectron);
    }

    /**
     * Read entire database
     */
    async readData(): Promise<DatabaseSchema> {
        if (!this.isElectron()) {
            throw new Error('Not running in Electron');
        }
        return window.electronAPI!.readData();
    }

    /**
     * Write entire database
     */
    async writeData(data: DatabaseSchema): Promise<void> {
        if (!this.isElectron()) {
            throw new Error('Not running in Electron');
        }
        const result = await window.electronAPI!.writeData(data);
        if (!result.success) {
            throw new Error(result.error || 'Failed to write data');
        }
    }

    /**
     * Read a specific collection
     */
    async readCollection<T>(collection: keyof DatabaseSchema): Promise<T[]> {
        const data = await this.readData();
        return data[collection] as T[];
    }

    /**
     * Write a specific collection
     */
    async writeCollection<T>(collection: keyof DatabaseSchema, items: T[]): Promise<void> {
        const data = await this.readData();
        data[collection] = items as any;
        await this.writeData(data);
    }
}
