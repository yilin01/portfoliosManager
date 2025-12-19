import { Injectable } from '@angular/core';

@Injectable({
    providedIn: 'root'
})
export class StorageService {
    private readonly PREFIX = 'portfolio_manager_';

    save<T>(key: string, data: T): void {
        try {
            const serialized = JSON.stringify(data);
            localStorage.setItem(this.PREFIX + key, serialized);
        } catch (error) {
            console.error('Error saving to localStorage:', error);
        }
    }

    load<T>(key: string, defaultValue: T): T {
        try {
            const item = localStorage.getItem(this.PREFIX + key);
            if (item === null) {
                return defaultValue;
            }
            return JSON.parse(item) as T;
        } catch (error) {
            console.error('Error loading from localStorage:', error);
            return defaultValue;
        }
    }

    remove(key: string): void {
        localStorage.removeItem(this.PREFIX + key);
    }

    clear(): void {
        const keysToRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key?.startsWith(this.PREFIX)) {
                keysToRemove.push(key);
            }
        }
        keysToRemove.forEach(key => localStorage.removeItem(key));
    }
}
