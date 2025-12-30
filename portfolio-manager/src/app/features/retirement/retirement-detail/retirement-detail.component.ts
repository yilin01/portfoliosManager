import { Component, inject, signal, computed } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RetirementService } from '../../../core/services/retirement.service';
import { RetirementHolding, getAccountTypeLabel } from '../../../core/models/retirement-account.model';
import { CSVImportService, CSVParseResult } from '../../../core/services/csv-import.service';
import { StockPriceService } from '../../../core/services/stock-price.service';

@Component({
  selector: 'app-retirement-detail',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule, CurrencyPipe],
  template: `
    <div class="page animate-fade-in">
      @if (account()) {
        <header class="page-header">
          <div class="breadcrumb">
            <a routerLink="/retirement">← Retirement Accounts</a>
          </div>
          <div class="header-content">
            <div>
              <h1>{{ account()!.name }}</h1>
              <p class="text-muted">{{ getTypeLabel(account()!.type) }} • {{ account()!.provider }}</p>
            </div>
            <div class="header-actions">
              <button 
                class="btn btn-secondary" 
                (click)="refreshPrices()" 
                [disabled]="isRefreshing()"
                title="Update prices from Yahoo Finance">
                @if (isRefreshing()) {
                  ⏳ {{ refreshProgress() }}
                } @else {
                  🔄 Refresh Prices
                }
              </button>
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
            <span class="stat-label">YTD Contributions</span>
            <span class="stat-value">{{ account()!.contributionYTD | currency:'USD':'symbol':'1.0-0' }}</span>
          </div>
          @if (account()!.employerMatchYTD) {
            <div class="stat">
              <span class="stat-label">Employer Match YTD</span>
              <span class="stat-value">{{ account()!.employerMatchYTD | currency:'USD':'symbol':'1.0-0' }}</span>
            </div>
          }
          @if (account()!.vestingPercent !== undefined) {
            <div class="stat">
              <span class="stat-label">Vesting</span>
              <span class="stat-value">{{ account()!.vestingPercent }}%</span>
            </div>
          }
        </div>

        <!-- Current Balance (Rollover) Info -->
        @if (account()!.currentBalance) {
          <div class="current-balance-info card">
            <div class="balance-header">
              <span class="balance-icon">💰</span>
              <span class="balance-label">Rollover / Account Balance</span>
            </div>
            <div class="balance-value">{{ account()!.currentBalance | currency:'USD':'symbol':'1.0-0' }}</div>
            <p class="balance-hint">This amount is included in your total value. You can also add individual holdings below.</p>
          </div>
        }

        <!-- Holdings Table -->
        @if (account()!.holdings.length === 0 && !account()!.currentBalance) {
          <div class="empty-state card">
            <div class="empty-icon">📊</div>
            <h3>No holdings yet</h3>
            <p>Add funds and investments in this retirement account</p>
            <div class="empty-actions">
              <button class="btn btn-primary" (click)="showAddModal = true">Add Holding</button>
              <button class="btn btn-secondary" (click)="showImportModal = true">📂 Import CSV</button>
            </div>
          </div>
        } @else if (account()!.holdings.length > 0) {
          <div class="card">
            <div class="table-container">
              <table class="table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Ticker</th>
                    <th>Type</th>
                    <th class="text-right">Shares</th>
                    <th class="text-right">Price</th>
                    <th class="text-right">Value</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  @for (holding of account()!.holdings; track holding.id) {
                    <tr>
                      <td><strong>{{ holding.name }}</strong></td>
                      <td>{{ holding.ticker || '-' }}</td>
                      <td><span class="badge badge-info">{{ holding.type }}</span></td>
                      <td class="text-right">{{ holding.shares | number:'1.0-4' }}</td>
                      <td class="text-right">{{ (holding.shares ? (holding.currentValue / holding.shares) : 0) | currency:'USD':'symbol':'1.2-2' }}</td>
                      <td class="text-right"><strong>{{ holding.currentValue | currency:'USD':'symbol':'1.0-0' }}</strong></td>
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
                <div class="form-group">
                  <label class="form-label">Fund/Investment Name</label>
                  <input type="text" class="form-input" [(ngModel)]="holdingForm.name" name="name" placeholder="e.g., Target Date 2050 Fund" required>
                </div>
                <div class="form-row">
                  <div class="form-group">
                    <label class="form-label">Ticker (Optional)</label>
                    <input type="text" class="form-input" [(ngModel)]="holdingForm.ticker" name="ticker" placeholder="e.g., VFIFX">
                  </div>
                  <div class="form-group">
                    <label class="form-label">Type</label>
                    <select class="form-select" [(ngModel)]="holdingForm.type" name="type">
                      <option value="target_date">Target Date Fund</option>
                      <option value="stock">Stock Fund</option>
                      <option value="bond">Bond Fund</option>
                      <option value="balanced">Balanced Fund</option>
                      <option value="money_market">Money Market</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                </div>
                <div class="form-row">
                  <div class="form-group">
                    <label class="form-label">Shares</label>
                    <input type="number" step="any" class="form-input" [(ngModel)]="holdingForm.shares" (ngModelChange)="onSharesChange()" name="shares" placeholder="0">
                  </div>
                  <div class="form-group">
                    <label class="form-label">Price</label>
                    <input type="number" step="0.01" class="form-input" [(ngModel)]="holdingForm.price" (ngModelChange)="onPriceChange()" name="price" placeholder="0.00">
                  </div>
                  <div class="form-group">
                    <label class="form-label">Current Value</label>
                    <input type="number" step="0.01" class="form-input" [(ngModel)]="holdingForm.currentValue" (ngModelChange)="onValueChange()" name="currentValue" placeholder="0.00" required>
                  </div>
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
              <p>Are you sure you want to delete <strong>{{ deletingHolding()?.name }}</strong>?</p>
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
                      <li><strong>Name</strong> (required) - Investment name</li>
                      <li><strong>Ticker</strong> - Ticker symbol</li>
                      <li><strong>Type</strong> - stock, bond, mutual benefit, target_date...</li>
                      <li><strong>Shares</strong> - Number of shares</li>
                      <li><strong>Price</strong> - Unit price (optional, used to calc value)</li>
                      <li><strong>CurrentValue</strong> - Total value (optional)</li>
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
                                <th>Name</th>
                                <th>Ticker</th>
                                <th>Type</th>
                                <th class="text-right">Shares</th>
                                <th class="text-right">Price</th>
                                <th class="text-right">Value</th>
                              </tr>
                            </thead>
                            <tbody>
                              @for (h of csvResult()!.holdings; track h.symbol + h.name) {
                                <tr>
                                  <td><strong>{{ h.name }}</strong></td>
                                  <td>{{ h.symbol || '-' }}</td>
                                  <td><span class="badge badge-info">{{ mapToRetirementType(h.type) }}</span></td>
                                  <td class="text-right">{{ h.shares }}</td>
                                  <td class="text-right">{{ ($any(h).currentPrice || ($any(h).currentValue / h.shares) || 0) | currency:'USD':'symbol':'1.2-2' }}</td>
                                  <td class="text-right">{{ ($any(h).currentValue || (h.shares * h.currentPrice)) | currency }}</td>
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
          <h3>Account not found</h3>
          <a routerLink="/retirement" class="btn btn-primary">Back to Retirement Accounts</a>
        </div>
      }
    </div>
  `,
  styles: [`
    .page-header { margin-bottom: 24px; }
    .breadcrumb { margin-bottom: 12px; a { font-size: 0.9rem; color: #6366f1; } }
    .header-content { display: flex; align-items: flex-start; justify-content: space-between; h1 { font-size: 1.8rem; margin-bottom: 4px; } }
    .stats-bar { display: flex; gap: 40px; padding: 20px 24px; background: rgba(30, 30, 50, 0.6); border: 1px solid rgba(255, 255, 255, 0.06); border-radius: 12px; margin-bottom: 24px; }
    .stat { display: flex; flex-direction: column; gap: 4px; }
    .stat-label { font-size: 0.8rem; color: #6a6a7a; text-transform: uppercase; letter-spacing: 0.5px; }
    .stat-value { font-size: 1.3rem; font-weight: 600; }
    .stat-label { font-size: 0.8rem; color: #6a6a7a; text-transform: uppercase; letter-spacing: 0.5px; }
    .stat-value { font-size: 1.3rem; font-weight: 600; }
    .header-actions { display: flex; gap: 12px; }
    .actions { display: flex; gap: 4px; justify-content: flex-end; }
    .empty-actions { display: flex; gap: 12px; justify-content: center; margin-top: 8px; }
    .modal-lg { max-width: 700px; }
    .import-instructions ul { margin: 16px 0; padding-left: 20px; li { margin: 8px 0; color: #a0a0b0; } }
    .file-input-wrapper { margin: 20px 0; }
    .file-input { display: none; }
    .file-label { cursor: pointer; }
    .import-errors { background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 8px; padding: 12px 16px; margin-bottom: 16px; h4 { color: #ef4444; margin: 0 0 8px 0; font-size: 0.95rem; } ul { margin: 0; padding-left: 20px; } li { color: #fca5a5; font-size: 0.85rem; } }
    .import-warnings { background: rgba(245, 158, 11, 0.1); border: 1px solid rgba(245, 158, 11, 0.3); border-radius: 8px; padding: 12px 16px; margin-bottom: 16px; h4 { color: #f59e0b; margin: 0 0 8px 0; font-size: 0.95rem; } ul { margin: 0; padding-left: 20px; } li { color: #fcd34d; font-size: 0.85rem; } }
    .import-preview { h4 { color: #22c55e; margin: 0 0 12px 0; font-size: 0.95rem; } .table th { white-space: nowrap; } }
    .modal-body { padding: 20px 24px; max-height: 60vh; overflow-y: auto; }

    .form-row { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; }
    .current-balance-info { margin-bottom: 24px; background: linear-gradient(135deg, rgba(34, 197, 94, 0.1), rgba(22, 163, 74, 0.1)); border-color: rgba(34, 197, 94, 0.3); }
    .balance-header { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
    .balance-icon { font-size: 1.5rem; }
    .balance-label { font-size: 0.9rem; color: #a0a0b0; text-transform: uppercase; letter-spacing: 0.5px; }
    .balance-value { font-size: 2rem; font-weight: 700; color: #22c55e; margin-bottom: 8px; }
    .balance-hint { font-size: 0.85rem; color: #6a6a7a; margin: 0; }
    @media (max-width: 768px) { .stats-bar { flex-wrap: wrap; gap: 20px; } .form-row { grid-template-columns: 1fr; } }
  `]
})
export class RetirementDetailComponent {
  private route = inject(ActivatedRoute);
  private retirementService = inject(RetirementService);
  private csvImportService = inject(CSVImportService);
  private stockPriceService = inject(StockPriceService);

  showAddModal = false;
  showImportModal = false;
  isRefreshing = signal(false);
  refreshProgress = signal('');

  editingHolding = signal<RetirementHolding | null>(null);
  deletingHolding = signal<RetirementHolding | null>(null);
  csvResult = signal<CSVParseResult | null>(null);

  holdingForm = {
    name: '',
    ticker: '',
    type: 'target_date' as RetirementHolding['type'],
    shares: 0,
    price: 0,
    currentValue: 0
  };

  account = computed(() => {
    const id = this.route.snapshot.paramMap.get('id');
    return id ? this.retirementService.getById(id) : undefined;
  });

  totalValue = computed(() => {
    const a = this.account();
    if (!a) return 0;
    const holdingsValue = a.holdings.reduce((sum, h) => sum + h.currentValue, 0);
    return holdingsValue + (a.currentBalance || 0);
  });

  getTypeLabel = getAccountTypeLabel;

  editHolding(holding: RetirementHolding): void {
    this.editingHolding.set(holding);
    const shares = holding.shares || 0;
    const price = shares > 0 ? holding.currentValue / shares : 0;
    this.holdingForm = {
      name: holding.name,
      ticker: holding.ticker || '',
      type: holding.type,
      shares: shares,
      price: price, // Calculated price
      currentValue: holding.currentValue
    };
  }

  confirmDeleteHolding(holding: RetirementHolding): void {
    this.deletingHolding.set(holding);
  }

  closeModal(): void {
    this.showAddModal = false;
    this.editingHolding.set(null);
    this.holdingForm = { name: '', ticker: '', type: 'target_date', shares: 0, price: 0, currentValue: 0 };
  }

  // Sync logic
  onSharesChange(): void {
    this.holdingForm.currentValue = this.holdingForm.shares * this.holdingForm.price;
  }

  onPriceChange(): void {
    this.holdingForm.currentValue = this.holdingForm.shares * this.holdingForm.price;
  }

  onValueChange(): void {
    if (this.holdingForm.shares > 0) {
      this.holdingForm.price = this.holdingForm.currentValue / this.holdingForm.shares;
    }
  }

  saveHolding(): void {
    const a = this.account();
    if (!a || !this.holdingForm.name) return;

    if (this.editingHolding()) {
      this.retirementService.updateHolding(a.id, this.editingHolding()!.id, {
        name: this.holdingForm.name,
        ticker: this.holdingForm.ticker || undefined,
        type: this.holdingForm.type,
        shares: Number(this.holdingForm.shares),
        currentValue: Number(this.holdingForm.currentValue)
      });
    } else {
      this.retirementService.addHolding(a.id, {
        name: this.holdingForm.name,
        ticker: this.holdingForm.ticker || undefined,
        type: this.holdingForm.type,
        shares: Number(this.holdingForm.shares),
        currentValue: Number(this.holdingForm.currentValue)
      });
    }
    this.closeModal();
  }

  deleteHolding(): void {
    const a = this.account();
    if (a && this.deletingHolding()) {
      this.retirementService.deleteHolding(a.id, this.deletingHolding()!.id);
      this.deletingHolding.set(null);
    }
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
    // Generate a simple template suitable for retirement
    const template = `Name,Ticker,Type,Shares,Price,CurrentValue\nTarget Date 2050,VFIFX,target_date,100,50,5000\nS&P 500 Index,VOO,stock,10,400,4000\nBond Fund,BND,bond,50,,3500`;
    const blob = new Blob([template], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'retirement_holdings_template.csv';
    link.click();
    URL.revokeObjectURL(url);
  }

  mapToRetirementType(csvType: string): RetirementHolding['type'] {
    // Map standard portfolio types to retirement types
    const type = csvType.toLowerCase();
    if (type.includes('target') || type.includes('date')) return 'target_date';
    if (type.includes('stock') || type.includes('etf') || type.includes('equity')) return 'stock';
    if (type.includes('bond') || type.includes('fixed')) return 'bond';
    if (type.includes('money') || type.includes('cash')) return 'money_market';
    if (type.includes('balanced') || type.includes('mix')) return 'balanced';
    return 'other';
  }

  importHoldings(): void {
    const a = this.account();
    const result = this.csvResult();
    if (!a || !result || result.holdings.length === 0) return;

    const retirementHoldings: Omit<RetirementHolding, 'id'>[] = result.holdings.map((h: any) => ({
      name: h.name,
      ticker: h.symbol || undefined,
      type: this.mapToRetirementType(h.type),
      shares: h.shares,
      currentValue: h.currentValue || (h.shares * h.currentPrice) || 0
    }));

    this.retirementService.addHoldings(a.id, retirementHoldings);
    this.closeImportModal();
  }

  refreshPrices(): void {
    const a = this.account();
    if (!a || a.holdings.length === 0) return;

    // Collect tickers
    const symbols = a.holdings
      .filter(h => h.ticker)
      .map(h => h.ticker!); // Non-null assertion safe due to filter

    if (symbols.length === 0) return;

    this.isRefreshing.set(true);
    this.refreshProgress.set('');

    this.stockPriceService.getQuotes(symbols).subscribe({
      next: (quotes) => {
        // Build map
        const priceUpdates = new Map<string, number>();
        quotes.forEach((quote, symbol) => priceUpdates.set(symbol, quote.price));

        this.retirementService.updateHoldingPrices(a.id, priceUpdates).subscribe({
          next: () => {
            this.isRefreshing.set(false);
            this.refreshProgress.set(`Updated ${priceUpdates.size} prices`);
            // Clear message after 3s
            setTimeout(() => this.refreshProgress.set(''), 3000);
          },
          error: (err) => {
            console.error('Error updating prices:', err);
            this.isRefreshing.set(false);
            this.refreshProgress.set('Error saving');
          }
        });
      },
      error: (err) => {
        console.error('Error fetching quotes:', err);
        this.isRefreshing.set(false);
        this.refreshProgress.set('Error fetching');
      }
    });
  }
}
