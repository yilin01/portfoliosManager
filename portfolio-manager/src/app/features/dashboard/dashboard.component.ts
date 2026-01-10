import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CommonModule, CurrencyPipe, PercentPipe } from '@angular/common';
import { PortfolioService } from '../../core/services/portfolio.service';
import { RetirementService } from '../../core/services/retirement.service';
import { BankService } from '../../core/services/bank.service';
import { StockPriceService } from '../../core/services/stock-price.service';
import { calculatePortfolioValue, calculatePortfolioCost } from '../../core/models/portfolio.model';
import { calculateRetirementAccountValue } from '../../core/models/retirement-account.model';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, CurrencyPipe, PercentPipe],
  template: `
    <div class="dashboard animate-fade-in">
      <header class="dashboard-header">
        <div>
          <h1>Dashboard</h1>
          <p class="text-muted">Your complete financial overview</p>
        </div>
        @if (totalHoldingsCount() > 0) {
          <button 
            class="btn btn-primary refresh-btn" 
            (click)="refreshAllPrices()" 
            [disabled]="isRefreshing()"
            title="Update all stock prices from Yahoo Finance">
            @if (isRefreshing()) {
              ⏳ Updating {{ refreshProgress() }}...
            } @else {
              🔄 Refresh All Prices
            }
          </button>
        }
      </header>

      <!-- Net Worth Card -->
      <div class="net-worth-card">
        <div class="net-worth-content">
          <span class="net-worth-label">Total Net Worth</span>
          <span class="net-worth-value">{{ totalNetWorth() | currency:'USD':'symbol':'1.0-0' }}</span>
          <div class="net-worth-breakdown">
            <span class="breakdown-item">
              <span class="breakdown-dot investments"></span>
              Investments: {{ portfolioService.totalValue() | currency:'USD':'symbol':'1.0-0' }}
            </span>
            <span class="breakdown-item">
              <span class="breakdown-dot retirement"></span>
              Retirement: {{ retirementService.totalValue() | currency:'USD':'symbol':'1.0-0' }}
            </span>
            <span class="breakdown-item">
              <span class="breakdown-dot cash"></span>
              Cash: {{ bankService.totalBalance() | currency:'USD':'symbol':'1.0-0' }}
            </span>
          </div>
        </div>
        <div class="allocation-chart">
          @for (segment of allocationSegments(); track segment.label) {
            <div 
              class="allocation-segment" 
              [style.width.%]="segment.percentage"
              [style.background]="segment.color"
              [title]="segment.label + ': ' + segment.percentage.toFixed(1) + '%'">
            </div>
          }
        </div>
      </div>

      <!-- Summary Cards -->
      <div class="summary-grid">
        <!-- Portfolios Summary -->
        <a routerLink="/portfolios" class="summary-card">
          <div class="summary-icon portfolios">💼</div>
          <div class="summary-content">
            <span class="summary-label">Investment Portfolios</span>
            <span class="summary-value">{{ portfolioService.totalValue() | currency:'USD':'symbol':'1.0-0' }}</span>
            <span class="summary-meta">{{ portfolioService.portfolios().length }} portfolios</span>
          </div>
          <div class="summary-arrow">→</div>
        </a>

        <!-- Retirement Summary -->
        <a routerLink="/retirement" class="summary-card">
          <div class="summary-icon retirement">🏦</div>
          <div class="summary-content">
            <span class="summary-label">Retirement Accounts</span>
            <span class="summary-value">{{ retirementService.totalValue() | currency:'USD':'symbol':'1.0-0' }}</span>
            <span class="summary-meta">{{ retirementService.accounts().length }} accounts</span>
          </div>
          <div class="summary-arrow">→</div>
        </a>

        <!-- Bank Accounts Summary -->
        <a routerLink="/bank-accounts" class="summary-card">
          <div class="summary-icon bank">💵</div>
          <div class="summary-content">
            <span class="summary-label">Bank Accounts</span>
            <span class="summary-value">{{ bankService.totalBalance() | currency:'USD':'symbol':'1.0-0' }}</span>
            <span class="summary-meta">{{ bankService.accounts().length }} accounts</span>
          </div>
          <div class="summary-arrow">→</div>
        </a>
      </div>

      <!-- Recent Portfolios -->
      <section class="section">
        <div class="section-header">
          <h2>Recent Portfolios</h2>
          <a routerLink="/portfolios" class="view-all">View All →</a>
        </div>
        
        @if (recentPortfolios().length === 0) {
          <div class="empty-state card">
            <div class="empty-icon">💼</div>
            <h3>No portfolios yet</h3>
            <p>Add your first brokerage portfolio to get started</p>
            <a routerLink="/portfolios" class="btn btn-primary">Add Portfolio</a>
          </div>
        } @else {
          <div class="portfolio-grid">
            @for (portfolio of recentPortfolios(); track portfolio.id) {
              <a [routerLink]="['/portfolios', portfolio.id]" class="portfolio-card card">
                <div class="portfolio-header">
                  <h3>{{ portfolio.name }}</h3>
                  <span class="portfolio-broker">{{ portfolio.broker }}</span>
                </div>
                <div class="portfolio-value">
                  {{ getPortfolioValue(portfolio) | currency:'USD':'symbol':'1.0-0' }}
                </div>
                <div class="portfolio-meta">
                  <span>{{ portfolio.holdings.length }} holdings</span>
                  <span [class]="getGainLossClass(portfolio)">
                    {{ getGainLossPercent(portfolio) | percent:'1.1-1' }}
                  </span>
                </div>
              </a>
            }
          </div>
        }
      </section>
    </div>
  `,
  styles: [`
    .dashboard-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      margin-bottom: 32px;

      h1 {
        font-size: 2rem;
        margin-bottom: 4px;
      }
    }

    .refresh-btn {
      white-space: nowrap;
    }

    .net-worth-card {
      background: linear-gradient(135deg, rgba(99, 102, 241, 0.15) 0%, rgba(168, 85, 247, 0.15) 100%);
      border: 1px solid rgba(99, 102, 241, 0.3);
      border-radius: 20px;
      padding: 32px;
      margin-bottom: 32px;
    }

    .net-worth-content {
      margin-bottom: 24px;
    }

    .net-worth-label {
      display: block;
      font-size: 0.9rem;
      color: #a0a0b0;
      margin-bottom: 8px;
      text-transform: uppercase;
      letter-spacing: 1px;
    }

    .net-worth-value {
      display: block;
      font-size: 3rem;
      font-weight: 700;
      background: linear-gradient(135deg, #ffffff 0%, #a0a0b0 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      margin-bottom: 16px;
    }

    .net-worth-breakdown {
      display: flex;
      gap: 24px;
      flex-wrap: wrap;
    }

    .breakdown-item {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 0.9rem;
      color: #a0a0b0;
    }

    .breakdown-dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;

      &.investments { background: #6366f1; }
      &.retirement { background: #22c55e; }
      &.cash { background: #f59e0b; }
    }

    .allocation-chart {
      display: flex;
      height: 8px;
      border-radius: 4px;
      overflow: hidden;
      background: rgba(255, 255, 255, 0.1);
    }

    .allocation-segment {
      transition: width 0.5s ease;
      min-width: 4px;
    }

    .summary-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 20px;
      margin-bottom: 40px;
    }

    @media (max-width: 1024px) {
      .summary-grid {
        grid-template-columns: 1fr;
      }
    }

    .summary-card {
      display: flex;
      align-items: center;
      gap: 16px;
      background: rgba(30, 30, 50, 0.8);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 16px;
      padding: 20px 24px;
      text-decoration: none;
      color: inherit;
      transition: all 0.25s;

      &:hover {
        border-color: rgba(99, 102, 241, 0.4);
        transform: translateY(-2px);
        box-shadow: 0 8px 30px rgba(0, 0, 0, 0.3);
      }
    }

    .summary-icon {
      font-size: 2rem;
      width: 56px;
      height: 56px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 14px;

      &.portfolios { background: rgba(99, 102, 241, 0.15); }
      &.retirement { background: rgba(34, 197, 94, 0.15); }
      &.bank { background: rgba(245, 158, 11, 0.15); }
    }

    .summary-content {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .summary-label {
      font-size: 0.85rem;
      color: #a0a0b0;
    }

    .summary-value {
      font-size: 1.4rem;
      font-weight: 600;
    }

    .summary-meta {
      font-size: 0.8rem;
      color: #6a6a7a;
    }

    .summary-arrow {
      font-size: 1.2rem;
      color: #6a6a7a;
      transition: transform 0.2s;

      .summary-card:hover & {
        transform: translateX(4px);
        color: #6366f1;
      }
    }

    .section {
      margin-bottom: 40px;
    }

    .section-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 20px;

      h2 {
        font-size: 1.3rem;
        margin: 0;
      }
    }

    .view-all {
      font-size: 0.9rem;
      color: #6366f1;
      text-decoration: none;

      &:hover {
        text-decoration: underline;
      }
    }

    .portfolio-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: 20px;
    }

    .portfolio-card {
      text-decoration: none;
      color: inherit;
      cursor: pointer;

      &:hover {
        border-color: rgba(99, 102, 241, 0.4);
      }
    }

    .portfolio-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 12px;

      h3 {
        font-size: 1.1rem;
        margin: 0;
      }
    }

    .portfolio-broker {
      font-size: 0.8rem;
      color: #6a6a7a;
      background: rgba(255, 255, 255, 0.05);
      padding: 4px 10px;
      border-radius: 20px;
    }

    .portfolio-value {
      font-size: 1.6rem;
      font-weight: 600;
      margin-bottom: 12px;
    }

    .portfolio-meta {
      display: flex;
      justify-content: space-between;
      font-size: 0.85rem;
      color: #a0a0b0;
    }

    .value-positive { color: #22c55e; }
    .value-negative { color: #ef4444; }
  `]
})
export class DashboardComponent {
  portfolioService = inject(PortfolioService);
  retirementService = inject(RetirementService);
  bankService = inject(BankService);
  private stockPriceService = inject(StockPriceService);

  isRefreshing = signal(false);
  refreshProgress = signal('');

  totalHoldingsCount = computed(() => {
    return this.portfolioService.portfolios().reduce((sum, p) => sum + p.holdings.length, 0);
  });

  totalNetWorth = computed(() =>
    this.portfolioService.totalValue() +
    this.retirementService.totalValue() +
    this.bankService.totalBalance()
  );

  allocationSegments = computed(() => {
    const total = this.totalNetWorth();
    if (total === 0) return [];

    return [
      { label: 'Investments', percentage: (this.portfolioService.totalValue() / total) * 100, color: '#6366f1' },
      { label: 'Retirement', percentage: (this.retirementService.totalValue() / total) * 100, color: '#22c55e' },
      { label: 'Cash', percentage: (this.bankService.totalBalance() / total) * 100, color: '#f59e0b' }
    ].filter(s => s.percentage > 0);
  });

  recentPortfolios = computed(() =>
    [...this.portfolioService.portfolios()]
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, 4)
  );

  getPortfolioValue(portfolio: any): number {
    return calculatePortfolioValue(portfolio);
  }

  getGainLossPercent(portfolio: any): number {
    const value = calculatePortfolioValue(portfolio);
    const cost = calculatePortfolioCost(portfolio);
    if (cost === 0) return 0;
    return (value - cost) / cost;
  }

  getGainLossClass(portfolio: any): string {
    const percent = this.getGainLossPercent(portfolio);
    return percent >= 0 ? 'value-positive' : 'value-negative';
  }

  refreshAllPrices(): void {
    const portfolios = this.portfolioService.portfolios();
    const retirementAccounts = this.retirementService.accounts();
    if (portfolios.length === 0 && retirementAccounts.length === 0) return;

    // Collect all unique symbols from all portfolios and retirement accounts
    const allSymbols = new Set<string>();

    portfolios.forEach(p => {
      p.holdings
        .filter(h => h.type !== 'cash')
        .forEach(h => allSymbols.add(h.symbol.toUpperCase()));
    });

    retirementAccounts.forEach(a => {
      a.holdings
        .filter(h => h.ticker)
        .forEach(h => allSymbols.add(h.ticker!.toUpperCase()));
    });

    if (allSymbols.size === 0) return;

    this.isRefreshing.set(true);
    this.refreshProgress.set(`0/${allSymbols.size}`);

    this.stockPriceService.getQuotes([...allSymbols]).subscribe({
      next: (quotes) => {
        // Build a single price map from all fetched quotes
        const priceUpdates = new Map<string, number>();
        quotes.forEach((quote, symbol) => priceUpdates.set(symbol, quote.price));

        // Update each portfolio and retirement account
        let completedCount = 0;
        const totalToUpdate = portfolios.length + retirementAccounts.length;
        let successCount = 0;

        const checkCompletion = () => {
          completedCount++;
          if (completedCount === totalToUpdate) {
            this.isRefreshing.set(false);
            this.refreshProgress.set(`${priceUpdates.size} prices updated`);

            // Re-fetch data to update UI totals immediately
            // Note: In a real app with signals, this might be automatic if using deeper signals,
            // but here we force a refresh to be safe since we just did a background update
          }
        };

        // Update portfolios
        portfolios.forEach(portfolio => {
          this.portfolioService.updateHoldingPrices(portfolio.id, priceUpdates).subscribe({
            next: () => {
              successCount++;
              checkCompletion();
            },
            error: (err) => {
              console.error(`Error updating portfolio ${portfolio.id}:`, err);
              checkCompletion();
            }
          });
        });

        // Update retirement accounts
        retirementAccounts.forEach(account => {
          this.retirementService.updateHoldingPrices(account.id, priceUpdates).subscribe({
            next: () => {
              successCount++;
              checkCompletion();
            },
            error: (err) => {
              console.error(`Error updating retirement account ${account.id}:`, err);
              checkCompletion();
            }
          });
        });
      },
      error: (err) => {
        console.error('Error refreshing prices:', err);
        this.isRefreshing.set(false);
        this.refreshProgress.set('Error');
      }
    });
  }
}
