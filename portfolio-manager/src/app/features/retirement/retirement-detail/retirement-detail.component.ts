import { Component, inject, signal, computed } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RetirementService } from '../../../core/services/retirement.service';
import { RetirementHolding, getAccountTypeLabel } from '../../../core/models/retirement-account.model';

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
            <button class="btn btn-primary" (click)="showAddModal = true">+ Add Holding</button>
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
            <button class="btn btn-primary" (click)="showAddModal = true">Add Holding</button>
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
                    <input type="number" step="any" class="form-input" [(ngModel)]="holdingForm.shares" name="shares" placeholder="0">
                  </div>
                  <div class="form-group">
                    <label class="form-label">Current Value</label>
                    <input type="number" step="0.01" class="form-input" [(ngModel)]="holdingForm.currentValue" name="currentValue" placeholder="0.00" required>
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
    .actions { display: flex; gap: 4px; justify-content: flex-end; }
    .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
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

  showAddModal = false;
  editingHolding = signal<RetirementHolding | null>(null);
  deletingHolding = signal<RetirementHolding | null>(null);

  holdingForm = {
    name: '',
    ticker: '',
    type: 'target_date' as RetirementHolding['type'],
    shares: 0,
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
    this.holdingForm = { name: holding.name, ticker: holding.ticker || '', type: holding.type, shares: holding.shares, currentValue: holding.currentValue };
  }

  confirmDeleteHolding(holding: RetirementHolding): void {
    this.deletingHolding.set(holding);
  }

  closeModal(): void {
    this.showAddModal = false;
    this.editingHolding.set(null);
    this.holdingForm = { name: '', ticker: '', type: 'target_date', shares: 0, currentValue: 0 };
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
}
