import { Injectable } from '@angular/core';
import { Holding } from '../models/portfolio.model';

export interface CSVParseResult {
    holdings: Omit<Holding, 'id'>[];
    errors: string[];
    warnings: string[];
}

@Injectable({
    providedIn: 'root'
})
export class CSVImportService {

    /**
     * Parse CSV content into holdings
     * Expected columns: Symbol, Name, Type, Shares, AvgCost, CurrentPrice
     * Column names are case-insensitive and flexible (e.g., "avg cost", "average_cost", "avgcost" all work)
     */
    parseCSV(content: string): CSVParseResult {
        const result: CSVParseResult = {
            holdings: [],
            errors: [],
            warnings: []
        };

        const lines = content.trim().split(/\r?\n/);
        if (lines.length < 2) {
            result.errors.push('CSV file must have a header row and at least one data row');
            return result;
        }

        // Parse header
        const headerLine = lines[0];
        const headers = this.parseCSVLine(headerLine).map(h => h.toLowerCase().trim().replace(/[_\s-]/g, ''));

        // Map headers to expected columns
        const columnMap = this.mapColumns(headers);

        if (columnMap['symbol'] === null) {
            result.errors.push('Missing required column: Symbol');
            return result;
        }

        // Parse data rows
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue; // Skip empty lines

            try {
                const values = this.parseCSVLine(line);
                const holding = this.parseRow(values, columnMap, i + 1);

                if (holding) {
                    result.holdings.push(holding);
                }
            } catch (error: any) {
                result.errors.push(`Row ${i + 1}: ${error.message}`);
            }
        }

        if (result.holdings.length === 0 && result.errors.length === 0) {
            result.warnings.push('No valid holdings found in CSV');
        }

        return result;
    }

    /**
     * Parse a single CSV line handling quoted values
     */
    private parseCSVLine(line: string): string[] {
        const result: string[] = [];
        let current = '';
        let inQuotes = false;

        for (let i = 0; i < line.length; i++) {
            const char = line[i];

            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                result.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }
        result.push(current.trim());

        return result;
    }

    /**
     * Map CSV headers to expected column names
     */
    private mapColumns(headers: string[]): Record<string, number | null> {
        const findColumn = (patterns: string[]): number | null => {
            for (const pattern of patterns) {
                const index = headers.findIndex(h => h.includes(pattern));
                if (index !== -1) return index;
            }
            return null;
        };

        return {
            symbol: findColumn(['symbol', 'ticker', 'stock']),
            name: findColumn(['description', 'company', 'name']),
            type: findColumn(['type', 'assettype', 'securitytype']),
            shares: findColumn(['shares', 'quantity', 'qty', 'units']),
            avgCost: findColumn(['avgcost', 'averagecost', 'costbasis', 'cost', 'purchaseprice']),
            currentPrice: findColumn(['currentprice', 'price', 'lastprice', 'marketprice', 'close'])
        };
    }

    /**
     * Parse a data row into a Holding object
     */
    private parseRow(
        values: string[],
        columnMap: Record<string, number | null>,
        rowNum: number
    ): Omit<Holding, 'id'> | null {
        const getValue = (key: string): string => {
            const index = columnMap[key];
            return index !== null && values[index] ? values[index].trim() : '';
        };

        const symbol = getValue('symbol').toUpperCase().replace(/['"]/g, '');
        if (!symbol) {
            return null; // Skip rows without symbol
        }

        const name = getValue('name') || symbol;
        const typeStr = getValue('type').toLowerCase();
        const sharesStr = getValue('shares').replace(/[,$]/g, '');
        const avgCostStr = getValue('avgCost').replace(/[,$]/g, '');
        const currentPriceStr = getValue('currentPrice').replace(/[,$]/g, '');

        // Determine type
        let type: Holding['type'] = 'stock';
        if (typeStr.includes('etf')) type = 'etf';
        else if (typeStr.includes('bond')) type = 'bond';
        else if (typeStr.includes('mutual') || typeStr.includes('fund')) type = 'mutual_fund';
        else if (typeStr.includes('crypto')) type = 'crypto';
        else if (typeStr.includes('cash')) type = 'cash';
        else if (typeStr.includes('other')) type = 'other';

        // Parse numbers
        const shares = parseFloat(sharesStr) || 0;
        const avgCost = parseFloat(avgCostStr) || 0;
        const currentPrice = parseFloat(currentPriceStr) || avgCost; // Default to avgCost if no current price

        if (shares <= 0) {
            return null; // Skip rows with no shares
        }

        return {
            symbol,
            name,
            type,
            shares,
            avgCost,
            currentPrice
        };
    }

    /**
     * Generate a sample CSV template
     */
    generateTemplate(): string {
        return `Symbol,Name,Type,Shares,AvgCost,CurrentPrice
AAPL,Apple Inc,stock,10,150.00,175.00
MSFT,Microsoft,stock,5,300.00,380.00
VOO,Vanguard S&P 500 ETF,etf,20,400.00,450.00`;
    }
}
