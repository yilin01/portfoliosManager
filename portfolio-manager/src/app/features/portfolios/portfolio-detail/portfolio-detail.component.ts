import { Component, inject, signal, computed } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CommonModule, CurrencyPipe, PercentPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PortfolioService } from '../../../core/services/portfolio.service';
import { StockPriceService } from '../../../core/services/stock-price.service';
import { CSVImportService, CSVParseResult } from '../../../core/services/csv-import.service';
import { Holding, calculateHoldingValue, calculateHoldingCost, calculateHoldingGainLoss, calculateHoldingGainLossPercent } from '../../../core/models/portfolio.model';

@Component({
  selector: 'app-portfolio-detail',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule, CurrencyPipe, PercentPipe],
  template: `
    <div class="page animate-fade-in">
      @if (portfolio()) {
        <header class="page-header">
          <div class="breadcrumb">
            <a routerLink="/portfolios">← Portfolios</a>
          </div>
          <div class="header-content">
            <div>
              <h1>{{ portfolio()!.name }}</h1>
              <p class="text-muted">{{ portfolio()!.broker }}</p>
            </div>
            <div class="header-actions">
              @if (portfolio()!.holdings.length > 0) {
                <button 
                  class="btn btn-secondary" 
                  (click)="refreshPrices()" 
                  [disabled]="isRefreshing()"
                  title="Fetch latest prices from Yahoo Finance">
                  @if (isRefreshing()) {
                    ⏳ Updating...
                  } @else {
                    🔄 Refresh Prices
                  }
                </button>
              }
              <button class="btn btn-secondary" (click)="showImportModal = true" title="Import holdings from CSV file">
                📂 Import CSV
              </button>
              <button class="btn btn-primary" (click)="showAddModal = true">+ Add Holding</button>
            </div>
          </div>
        </header>

        <!-- Stats -->
        <div class="stats-bar">
          <div class="stat">
            <span class="stat-label">Total Value</span>
            <span class="stat-value">{{ totalValue() | currency:'USD':'symbol':'1.0-0' }}</span>
          </div>
          <div class="stat">
            <span class="stat-label">Total Cost</span>
            <span class="stat-value">{{ totalCost() | currency:'USD':'symbol':'1.0-0' }}</span>
          </div>
          <div class="stat">
            <span class="stat-label">Gain/Loss</span>
            <span class="stat-value" [class]="totalGainLoss() >= 0 ? 'value-positive' : 'value-negative'">
              {{ totalGainLoss() | currency:'USD':'symbol':'1.0-0' }}
              ({{ totalGainLossPercent() | percent:'1.1-1' }})
            </span>
          </div>
        </div>

        <!-- Holdings Table -->
        @if (portfolio()!.holdings.length === 0) {
          <div class="empty-state card">
            <div class="empty-icon">📈</div>
            <h3>No holdings yet</h3>
            <p>Add stocks, ETFs, or other investments to this portfolio</p>
            <div class="empty-actions">
              <button class="btn btn-primary" (click)="showAddModal = true">Add Holding</button>
              <button class="btn btn-secondary" (click)="showImportModal = true">📂 Import CSV</button>
            </div>
          </div>
        } @else {
          <div class="card">
            <div class="table-container">
              <table class="table">
                <thead>
                  <tr>
                    <th>Symbol</th>
                    <th>Name</th>
                    <th>Type</th>
                    <th class="text-right">Shares</th>
                    <th class="text-right">Avg Cost</th>
                    <th class="text-right">Price</th>
                    <th class="text-right">Value</th>
                    <th class="text-right">Gain/Loss</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  @for (holding of portfolio()!.holdings; track holding.id) {
                    <tr>
                      <td><strong>{{ holding.symbol }}</strong></td>
                      <td>{{ holding.name }}</td>
                      <td><span class="badge badge-info">{{ holding.type }}</span></td>
                      <td class="text-right">{{ holding.shares | number:'1.0-4' }}</td>
                      <td class="text-right">{{ holding.avgCost | currency:'USD':'symbol':'1.2-2' }}</td>
                      <td class="text-right">{{ holding.currentPrice | currency:'USD':'symbol':'1.2-2' }}</td>
                      <td class="text-right"><strong>{{ getHoldingValue(holding) | currency:'USD':'symbol':'1.0-0' }}</strong></td>
                      <td class="text-right" [class]="getGainLossClass(holding)">
                        {{ getHoldingGainLoss(holding) | currency:'USD':'symbol':'1.0-0' }}
                        ({{ getHoldingGainLossPercent(holding) | percent:'1.1-1' }})
                      </td>
                      <td class="actions">
                        <button class="btn btn-icon btn-secondary" (click)="editHolding(holding)" title="Edit">✏️</button>
                        <button class="btn btn-icon btn-secondary" (click)="confirmDeleteHolding(holding)" title="Delete">🗑️</button>
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </div>
        }

        <!-- Add/Edit Holding Modal -->
        @if (showAddModal || editingHolding()) {
          <div class="modal-overlay" (click)="closeModal()">
            <div class="modal" (click)="$event.stopPropagation()">
              <div class="modal-header">
                <h2 class="modal-title">{{ editingHolding() ? 'Edit Holding' : 'Add Holding' }}</h2>
                <button class="modal-close" (click)="closeModal()">×</button>
              </div>
              <form (ngSubmit)="saveHolding()">
                <div class="form-row">
                  <div class="form-group">
                    <label class="form-label">Symbol</label>
                    <input type="text" class="form-input" [(ngModel)]="holdingForm.symbol" name="symbol" placeholder="e.g., AAPL" required>
                  </div>
                  <div class="form-group">
                    <label class="form-label">Type</label>
                    <select class="form-select" [(ngModel)]="holdingForm.type" name="type" (change)="onTypeChange()">
                      <option value="stock">Stock</option>
                      <option value="etf">ETF</option>
                      <option value="bond">Bond</option>
                      <option value="mutual_fund">Mutual Fund</option>
                      <option value="crypto">Crypto</option>
                      <option value="cash">Cash</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                </div>

                <div class="form-group">
                  <label class="form-label">Name</label>
                  <input type="text" class="form-input" [(ngModel)]="holdingForm.name" name="name" placeholder="e.g., Apple Inc." required>
                </div>
                <div class="form-row">
                  <div class="form-group">
                    <label class="form-label">{{ holdingForm.type === 'cash' ? 'Amount ($)' : 'Shares' }}</label>
                    <input type="number" step="any" class="form-input" [(ngModel)]="holdingForm.shares" name="shares" placeholder="0" required>
                  </div>
                  <div class="form-group">
                    <label class="form-label">Average Cost</label>
                    <input type="number" step="0.01" class="form-input" [(ngModel)]="holdingForm.avgCost" name="avgCost" placeholder="0.00" [disabled]="holdingForm.type === 'cash'" required>
                  </div>
                </div>
                <div class="form-group">
                  <label class="form-label">Current Price</label>
                  <input type="number" step="0.01" class="form-input" [(ngModel)]="holdingForm.currentPrice" name="currentPrice" placeholder="0.00" [disabled]="holdingForm.type === 'cash'" required>
                </div>
                <div class="modal-footer">
                  <button type="button" class="btn btn-secondary" (click)="closeModal()">Cancel</button>
                  <button type="submit" class="btn btn-primary">{{ editingHolding() ? 'Save Changes' : 'Add Holding' }}</button>
                </div>
              </form>
            </div>
          </div>
        }

        <!-- Delete Confirmation Modal -->
        @if (deletingHolding()) {
          <div class="modal-overlay" (click)="deletingHolding.set(null)">
            <div class="modal" (click)="$event.stopPropagation()">
              <div class="modal-header">
                <h2 class="modal-title">Delete Holding</h2>
                <button class="modal-close" (click)="deletingHolding.set(null)">×</button>
              </div>
              <p>Are you sure you want to delete <strong>{{ deletingHolding()?.symbol }}</strong>?</p>
              <div class="modal-footer">
                <button class="btn btn-secondary" (click)="deletingHolding.set(null)">Cancel</button>
                <button class="btn btn-danger" (click)="deleteHolding()">Delete</button>
              </div>
            </div>
          </div>
        }

        <!-- CSV Import Modal -->
        @if (showImportModal) {
          <div class="modal-overlay" (click)="closeImportModal()">
            <div class="modal modal-lg" (click)="$event.stopPropagation()">
              <div class="modal-header">
                <h2 class="modal-title">📂 Import Holdings from CSV</h2>
                <button class="modal-close" (click)="closeImportModal()">×</button>
              </div>
              <div class="modal-body">
                @if (!csvResult()) {
                  <div class="import-instructions">
                    <p>Upload a CSV file with your holdings. Expected columns:</p>
                    <ul>
                      <li><strong>Symbol</strong> (required) - Stock ticker symbol</li>
                      <li><strong>Name</strong> - Company name</li>
                      <li><strong>Type</strong> - stock, etf, bond, mutual_fund, crypto</li>
                      <li><strong>Shares</strong> - Number of shares</li>
                      <li><strong>AvgCost</strong> - Average cost per share</li>
                      <li><strong>CurrentPrice</strong> - Current price per share</li>
                    </ul>
                    <div class="file-input-wrapper">
                      <input 
                        type="file" 
                        accept=".csv" 
                        (change)="onFileSelected($event)"
                        id="csvFileInput"
                        class="file-input">
                      <label for="csvFileInput" class="btn btn-primary file-label">
                        Choose CSV File
                      </label>
                    </div>
                    <button class="btn btn-link" (click)="downloadTemplate()">⬇️ Download sample template</button>
                  </div>
                } @else {
                  <div class="import-results">
                    @if (csvResult()!.errors.length > 0) {
                      <div class="import-errors">
                        <h4>❌ Errors</h4>
                        <ul>
                          @for (error of csvResult()!.errors; track error) {
                            <li>{{ error }}</li>
                          }
                        </ul>
                      </div>
                    }
                    @if (csvResult()!.warnings.length > 0) {
                      <div class="import-warnings">
                        <h4>⚠️ Warnings</h4>
                        <ul>
                          @for (warning of csvResult()!.warnings; track warning) {
                            <li>{{ warning }}</li>
                          }
                        </ul>
                      </div>
                    }
                    @if (csvResult()!.holdings.length > 0) {
                      <div class="import-preview">
                        <h4>✅ Preview ({{ csvResult()!.holdings.length }} holdings found)</h4>
                        <div class="table-container">
                          <table class="table">
                            <thead>
                              <tr>
                                <th>Symbol</th>
                                <th>Name</th>
                                <th>Type</th>
                                <th class="text-right">Shares</th>
                                <th class="text-right">Avg Cost</th>
                                <th class="text-right">Price</th>
                              </tr>
                            </thead>
                            <tbody>
                              @for (h of csvResult()!.holdings; track h.symbol) {
                                <tr>
                                  <td><strong>{{ h.symbol }}</strong></td>
                                  <td>{{ h.name }}</td>
                                  <td><span class="badge badge-info">{{ h.type }}</span></td>
                                  <td class="text-right">{{ h.shares }}</td>
                                  <td class="text-right">{{ h.avgCost | currency }}</td>
                                  <td class="text-right">{{ h.currentPrice | currency }}</td>
                                </tr>
                              }
                            </tbody>
                          </table>
                        </div>
                      </div>
                    }
                  </div>
                }
              </div>
              <div class="modal-footer">
                @if (csvResult()) {
                  <button class="btn btn-secondary" (click)="csvResult.set(null)">Choose Different File</button>
                  @if (csvResult()!.holdings.length > 0) {
                    <button class="btn btn-primary" (click)="importHoldings()">Import {{ csvResult()!.holdings.length }} Holdings</button>
                  }
                } @else {
                  <button class="btn btn-secondary" (click)="closeImportModal()">Cancel</button>
                }
              </div>
            </div>
          </div>
        }
      } @else {
        <div class="empty-state">
          <h3>Portfolio not found</h3>
          <a routerLink="/portfolios" class="btn btn-primary">Back to Portfolios</a>
        </div>
      }
    </div>
  `,
  styles: [`
    .page-header {
      margin-bottom: 24px;
    }

    .breadcrumb {
      margin-bottom: 12px;

      a {
        font-size: 0.9rem;
        color: #6366f1;
      }
    }

    .header-content {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;

      h1 {
        font-size: 1.8rem;
        margin-bottom: 4px;
      }
    }

    .header-actions {
      display: flex;
      gap: 12px;
    }

    .stats-bar {
      display: flex;
      gap: 40px;
      padding: 20px 24px;
      background: rgba(30, 30, 50, 0.6);
      border: 1px solid rgba(255, 255, 255, 0.06);
      border-radius: 12px;
      margin-bottom: 24px;
    }

    .stat {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .stat-label {
      font-size: 0.8rem;
      color: #6a6a7a;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .stat-value {
      font-size: 1.3rem;
      font-weight: 600;
    }

    .table th {
      white-space: nowrap;
    }

    .actions {
      display: flex;
      gap: 4px;
      justify-content: flex-end;
    }

    .form-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
    }

    .value-positive { color: #22c55e; }
    .value-negative { color: #ef4444; }

    .empty-actions {
      display: flex;
      gap: 12px;
      justify-content: center;
      margin-top: 8px;
    }

    .modal-lg {
      max-width: 700px;
    }

    .import-instructions {
      ul {
        margin: 16px 0;
        padding-left: 20px;
        li { margin: 8px 0; color: #a0a0b0; }
      }
    }

    .file-input-wrapper {
      margin: 20px 0;
    }

    .file-input {
      display: none;
    }

    .file-label {
      cursor: pointer;
    }

    .import-errors {
      background: rgba(239, 68, 68, 0.1);
      border: 1px solid rgba(239, 68, 68, 0.3);
      border-radius: 8px;
      padding: 12px 16px;
      margin-bottom: 16px;
      h4 { color: #ef4444; margin: 0 0 8px 0; font-size: 0.95rem; }
      ul { margin: 0; padding-left: 20px; }
      li { color: #fca5a5; font-size: 0.85rem; }
    }

    .import-warnings {
      background: rgba(245, 158, 11, 0.1);
      border: 1px solid rgba(245, 158, 11, 0.3);
      border-radius: 8px;
      padding: 12px 16px;
      margin-bottom: 16px;
      h4 { color: #f59e0b; margin: 0 0 8px 0; font-size: 0.95rem; }
      ul { margin: 0; padding-left: 20px; }
      li { color: #fcd34d; font-size: 0.85rem; }
    }

    .import-preview {
      h4 { color: #22c55e; margin: 0 0 12px 0; font-size: 0.95rem; }
    }

    .modal-body {
      padding: 20px 24px;
      max-height: 60vh;
      overflow-y: auto;
    }

    @media (max-width: 768px) {
      .stats-bar {
        flex-wrap: wrap;
        gap: 20px;
      }

      .form-row {
        grid-template-columns: 1fr;
      }
    }
  `]
})
export class PortfolioDetailComponent {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private portfolioService = inject(PortfolioService);
  private stockPriceService = inject(StockPriceService);
  private csvImportService = inject(CSVImportService);

  showAddModal = false;
  showImportModal = false;
  editingHolding = signal<Holding | null>(null);
  deletingHolding = signal<Holding | null>(null);
  isRefreshing = signal(false);
  lastRefreshMessage = signal('');
  csvResult = signal<CSVParseResult | null>(null);
  holdingForm = {
    symbol: '',
    name: '',
    type: 'stock' as Holding['type'],
    shares: 0,
    avgCost: 0,
    currentPrice: 0
  };

  portfolio = computed(() => {
    const id = this.route.snapshot.paramMap.get('id');
    return id ? this.portfolioService.getById(id) : undefined;
  });

  totalValue = computed(() => {
    const p = this.portfolio();
    return p ? p.holdings.reduce((sum, h) => sum + calculateHoldingValue(h), 0) : 0;
  });

  totalCost = computed(() => {
    const p = this.portfolio();
    return p ? p.holdings.reduce((sum, h) => sum + calculateHoldingCost(h), 0) : 0;
  });

  totalGainLoss = computed(() => this.totalValue() - this.totalCost());

  totalGainLossPercent = computed(() => {
    const cost = this.totalCost();
    return cost === 0 ? 0 : this.totalGainLoss() / cost;
  });

  getHoldingValue(h: Holding): number { return calculateHoldingValue(h); }
  getHoldingGainLoss(h: Holding): number { return calculateHoldingGainLoss(h); }
  getHoldingGainLossPercent(h: Holding): number { return calculateHoldingGainLossPercent(h) / 100; }
  getGainLossClass(h: Holding): string { return calculateHoldingGainLoss(h) >= 0 ? 'value-positive' : 'value-negative'; }

  editHolding(holding: Holding): void {
    this.editingHolding.set(holding);
    this.holdingForm = { ...holding };
  }

  confirmDeleteHolding(holding: Holding): void {
    this.deletingHolding.set(holding);
  }

  closeModal(): void {
    this.showAddModal = false;
    this.editingHolding.set(null);
    this.holdingForm = { symbol: '', name: '', type: 'stock', shares: 0, avgCost: 0, currentPrice: 0 };
  }

  onTypeChange(): void {
    if (this.holdingForm.type === 'cash') {
      this.holdingForm.symbol = 'USD';
      this.holdingForm.name = this.holdingForm.name || 'Cash';
      this.holdingForm.avgCost = 1;
      this.holdingForm.currentPrice = 1;
    }
  }

  saveHolding(): void {
    const p = this.portfolio();
    if (!p || !this.holdingForm.symbol || !this.holdingForm.name) return;

    if (this.editingHolding()) {
      this.portfolioService.updateHolding(p.id, this.editingHolding()!.id, {
        symbol: this.holdingForm.symbol.toUpperCase(),
        name: this.holdingForm.name,
        type: this.holdingForm.type,
        shares: Number(this.holdingForm.shares),
        avgCost: Number(this.holdingForm.avgCost),
        currentPrice: Number(this.holdingForm.currentPrice)
      });
    } else {
      this.portfolioService.addHolding(p.id, {
        symbol: this.holdingForm.symbol.toUpperCase(),
        name: this.holdingForm.name,
        type: this.holdingForm.type,
        shares: Number(this.holdingForm.shares),
        avgCost: Number(this.holdingForm.avgCost),
        currentPrice: Number(this.holdingForm.currentPrice)
      });
    }
    this.closeModal();
  }

  deleteHolding(): void {
    const p = this.portfolio();
    if (p && this.deletingHolding()) {
      this.portfolioService.deleteHolding(p.id, this.deletingHolding()!.id);
      this.deletingHolding.set(null);
    }
  }

  refreshPrices(): void {
    const p = this.portfolio();
    if (!p || p.holdings.length === 0) return;

    this.isRefreshing.set(true);
    this.lastRefreshMessage.set('');

    const symbols = p.holdings
      .filter(h => h.type !== 'cash')
      .map(h => h.symbol);

    this.stockPriceService.getQuotes(symbols).subscribe({
      next: (quotes) => {
        let updatedCount = 0;
        p.holdings.forEach(holding => {
          const quote = quotes.get(holding.symbol.toUpperCase());
          if (quote) {
            this.portfolioService.updateHolding(p.id, holding.id, {
              currentPrice: quote.price
            });
            updatedCount++;
          }
        });
        this.isRefreshing.set(false);
        this.lastRefreshMessage.set(`Updated ${updatedCount} of ${symbols.length} holdings`);
      },
      error: (err) => {
        console.error('Error refreshing prices:', err);
        this.isRefreshing.set(false);
        this.lastRefreshMessage.set('Error fetching prices. Please try again.');
      }
    });
  }

  // CSV Import methods
  closeImportModal(): void {
    this.showImportModal = false;
    this.csvResult.set(null);
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const file = input.files[0];
    const reader = new FileReader();

    reader.onload = (e) => {
      const content = e.target?.result as string;
      if (content) {
        const result = this.csvImportService.parseCSV(content);
        this.csvResult.set(result);
      }
    };

    reader.readAsText(file);
    input.value = ''; // Reset input for re-upload
  }

  downloadTemplate(): void {
    const template = this.csvImportService.generateTemplate();
    const blob = new Blob([template], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'holdings_template.csv';
    link.click();
    URL.revokeObjectURL(url);
  }

  importHoldings(): void {
    const p = this.portfolio();
    const result = this.csvResult();
    if (!p || !result || result.holdings.length === 0) return;

    this.portfolioService.addHoldings(p.id, result.holdings);

    this.closeImportModal();
  }
}
