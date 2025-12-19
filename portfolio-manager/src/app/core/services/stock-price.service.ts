import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, forkJoin, of, map, catchError } from 'rxjs';

export interface StockQuote {
    symbol: string;
    price: number;
    change: number;
    changePercent: number;
    name?: string;
}

@Injectable({
    providedIn: 'root'
})
export class StockPriceService {
    // Using a CORS proxy for Yahoo Finance API
    private readonly CORS_PROXY = 'https://corsproxy.io/?';
    private readonly YAHOO_API = 'https://query1.finance.yahoo.com/v8/finance/chart/';

    constructor(private http: HttpClient) { }

    /**
     * Fetch current price for a single stock symbol
     */
    getQuote(symbol: string): Observable<StockQuote | null> {
        const url = `${this.CORS_PROXY}${encodeURIComponent(this.YAHOO_API + symbol.toUpperCase())}`;

        return this.http.get<any>(url).pipe(
            map(response => {
                const result = response?.chart?.result?.[0];
                if (!result) return null;

                const meta = result.meta;
                const price = meta.regularMarketPrice;
                const previousClose = meta.previousClose || meta.chartPreviousClose;
                const change = price - previousClose;
                const changePercent = (change / previousClose) * 100;

                return {
                    symbol: meta.symbol,
                    price: price,
                    change: change,
                    changePercent: changePercent,
                    name: meta.shortName || meta.longName
                };
            }),
            catchError(error => {
                console.error(`Error fetching quote for ${symbol}:`, error);
                return of(null);
            })
        );
    }

    /**
     * Fetch current prices for multiple stock symbols
     */
    getQuotes(symbols: string[]): Observable<Map<string, StockQuote>> {
        if (symbols.length === 0) {
            return of(new Map());
        }

        const requests = symbols.map(symbol =>
            this.getQuote(symbol).pipe(
                map(quote => ({ symbol: symbol.toUpperCase(), quote }))
            )
        );

        return forkJoin(requests).pipe(
            map(results => {
                const quotesMap = new Map<string, StockQuote>();
                results.forEach(({ symbol, quote }) => {
                    if (quote) {
                        quotesMap.set(symbol, quote);
                    }
                });
                return quotesMap;
            })
        );
    }
}
