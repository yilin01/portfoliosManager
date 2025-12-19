import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CommonModule, CurrencyPipe, PercentPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RetirementService } from '../../../core/services/retirement.service';
import { RetirementAccount, RetirementAccountType, getAccountTypeLabel, calculateRetirementAccountValue, getContributionLimit, calculateContributionRemaining } from '../../../core/models/retirement-account.model';

@Component({
  selector: 'app-retirement-list',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule, CurrencyPipe, PercentPipe],
  template: `
    <div class="page animate-fade-in">
      <header class="page-header">
        <div>
          <h1>Retirement Accounts</h1>
          <p class="text-muted">Track your 401(k), IRA, and other retirement accounts</p>
        </div>
        <button class="btn btn-primary" (click)="showAddModal = true">+ Add Account</button>
      </header>

      <!-- Summary Stats -->
      <div class="stats-bar">
        <div class="stat">
          <span class="stat-label">Total Value</span>
          <span class="stat-value">{{ retirementService.totalValue() | currency:'USD':'symbol':'1.0-0' }}</span>
        </div>
        <div class="stat">
          <span class="stat-label">Accounts</span>
          <span class="stat-value">{{ retirementService.accounts().length }}</span>
        </div>
        <div class="stat">
          <span class="stat-label">YTD Contributions</span>
          <span class="stat-value">{{ totalContributionsYTD() | currency:'USD':'symbol':'1.0-0' }}</span>
        </div>
      </div>

      <!-- Account List -->
      @if (retirementService.accounts().length === 0) {
        <div class="empty-state card">
          <div class="empty-icon">🏦</div>
          <h3>No retirement accounts yet</h3>
          <p>Add your 401(k), IRA, or other retirement accounts</p>
          <button class="btn btn-primary" (click)="showAddModal = true">Add Account</button>
        </div>
      } @else {
        <div class="account-grid">
          @for (account of retirementService.accounts(); track account.id) {
            <div class="account-card card">
              <div class="account-header">
                <a [routerLink]="['/retirement', account.id]" class="account-name">{{ account.name }}</a>
                <div class="account-actions">
                  <button class="btn btn-icon btn-secondary" (click)="editAccount(account)" title="Edit">✏️</button>
                  <button class="btn btn-icon btn-secondary" (click)="confirmDelete(account)" title="Delete">🗑️</button>
                </div>
              </div>
              <div class="account-type">
                <span class="badge badge-info">{{ getTypeLabel(account.type) }}</span>
                <span class="account-provider">{{ account.provider }}</span>
              </div>
              @if (account.employer) {
                <div class="account-employer">{{ account.employer }}</div>
              }
              <div class="account-value">{{ getAccountValue(account) | currency:'USD':'symbol':'1.0-0' }}</div>
              
              <!-- Contribution Progress -->
              <div class="contribution-section">
                <div class="contribution-header">
                  <span>YTD Contributions</span>
                  <span>{{ account.contributionYTD | currency:'USD':'symbol':'1.0-0' }} / {{ getContributionLimit(account.type) | currency:'USD':'symbol':'1.0-0' }}</span>
                </div>
                <div class="contribution-bar">
                  <div class="contribution-fill" [style.width.%]="getContributionProgress(account)"></div>
                </div>
                <div class="contribution-remaining">
                  {{ getContributionRemaining(account) | currency:'USD':'symbol':'1.0-0' }} remaining
                </div>
              </div>

              @if (account.vestingPercent !== undefined && account.vestingPercent < 100) {
                <div class="vesting-info">
                  <span>Vesting:</span>
                  <span class="vesting-value">{{ account.vestingPercent }}%</span>
                </div>
              }
              
              <a [routerLink]="['/retirement', account.id]" class="account-link">View Holdings →</a>
            </div>
          }
        </div>
      }

      <!-- Add/Edit Modal -->
      @if (showAddModal || editingAccount()) {
        <div class="modal-overlay" (click)="closeModal()">
          <div class="modal" (click)="$event.stopPropagation()">
            <div class="modal-header">
              <h2 class="modal-title">{{ editingAccount() ? 'Edit Account' : 'Add Retirement Account' }}</h2>
              <button class="modal-close" (click)="closeModal()">×</button>
            </div>
            <form (ngSubmit)="saveAccount()">
              <div class="form-group">
                <label class="form-label">Account Name</label>
                <input type="text" class="form-input" [(ngModel)]="formData.name" name="name" placeholder="e.g., Fidelity 401(k)" required>
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">Account Type</label>
                  <select class="form-select" [(ngModel)]="formData.type" name="type">
                    <option value="401k">401(k)</option>
                    <option value="traditional_ira">Traditional IRA</option>
                    <option value="roth_ira">Roth IRA</option>
                    <option value="403b">403(b)</option>
                    <option value="457b">457(b)</option>
                    <option value="sep_ira">SEP IRA</option>
                    <option value="simple_ira">SIMPLE IRA</option>
                  </select>
                </div>
                <div class="form-group">
                  <label class="form-label">Provider</label>
                  <input type="text" class="form-input" [(ngModel)]="formData.provider" name="provider" placeholder="e.g., Fidelity" required>
                </div>
              </div>
              <div class="form-group">
                <label class="form-label">Employer (Optional)</label>
                <input type="text" class="form-input" [(ngModel)]="formData.employer" name="employer" placeholder="e.g., Company Name">
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">YTD Contributions</label>
                  <input type="number" step="0.01" class="form-input" [(ngModel)]="formData.contributionYTD" name="contributionYTD" placeholder="0.00">
                </div>
                <div class="form-group">
                  <label class="form-label">Employer Match YTD</label>
                  <input type="number" step="0.01" class="form-input" [(ngModel)]="formData.employerMatchYTD" name="employerMatchYTD" placeholder="0.00">
                </div>
              </div>
              <div class="form-group">
                <label class="form-label">Current Balance / Rollover Amount</label>
                <input type="number" step="0.01" class="form-input" [(ngModel)]="formData.currentBalance" name="currentBalance" placeholder="0.00">
                <small class="form-hint">Use this for existing accounts or rollovers. You can also add individual holdings later.</small>
              </div>
              <div class="form-group">
                <label class="form-label">Vesting Percentage</label>
                <input type="number" min="0" max="100" class="form-input" [(ngModel)]="formData.vestingPercent" name="vestingPercent" placeholder="100">
              </div>
              <div class="modal-footer">
                <button type="button" class="btn btn-secondary" (click)="closeModal()">Cancel</button>
                <button type="submit" class="btn btn-primary">{{ editingAccount() ? 'Save Changes' : 'Add Account' }}</button>
              </div>
            </form>
          </div>
        </div>
      }

      <!-- Delete Confirmation Modal -->
      @if (deletingAccount()) {
        <div class="modal-overlay" (click)="deletingAccount.set(null)">
          <div class="modal" (click)="$event.stopPropagation()">
            <div class="modal-header">
              <h2 class="modal-title">Delete Account</h2>
              <button class="modal-close" (click)="deletingAccount.set(null)">×</button>
            </div>
            <p>Are you sure you want to delete <strong>{{ deletingAccount()?.name }}</strong>?</p>
            <div class="modal-footer">
              <button class="btn btn-secondary" (click)="deletingAccount.set(null)">Cancel</button>
              <button class="btn btn-danger" (click)="deleteAccount()">Delete</button>
            </div>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .page-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      margin-bottom: 24px;

      h1 {
        font-size: 1.8rem;
        margin-bottom: 4px;
      }
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

    .account-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
      gap: 20px;
    }

    .account-card {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .account-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .account-name {
      font-size: 1.2rem;
      font-weight: 600;
      color: white;
      text-decoration: none;

      &:hover {
        color: #6366f1;
      }
    }

    .account-actions {
      display: flex;
      gap: 6px;
    }

    .account-type {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .account-provider, .account-employer {
      font-size: 0.85rem;
      color: #6a6a7a;
    }

    .account-value {
      font-size: 1.8rem;
      font-weight: 700;
      margin: 8px 0;
    }

    .contribution-section {
      background: rgba(0, 0, 0, 0.2);
      border-radius: 10px;
      padding: 12px;
    }

    .contribution-header {
      display: flex;
      justify-content: space-between;
      font-size: 0.8rem;
      color: #a0a0b0;
      margin-bottom: 8px;
    }

    .contribution-bar {
      height: 6px;
      background: rgba(255, 255, 255, 0.1);
      border-radius: 3px;
      overflow: hidden;
    }

    .contribution-fill {
      height: 100%;
      background: linear-gradient(90deg, #22c55e, #16a34a);
      border-radius: 3px;
      transition: width 0.5s ease;
    }

    .contribution-remaining {
      font-size: 0.8rem;
      color: #6a6a7a;
      margin-top: 6px;
      text-align: right;
    }

    .vesting-info {
      display: flex;
      justify-content: space-between;
      font-size: 0.85rem;
      color: #a0a0b0;
      padding: 8px 0;
      border-top: 1px solid rgba(255, 255, 255, 0.06);
    }

    .vesting-value {
      color: #f59e0b;
      font-weight: 600;
    }

    .account-link {
      font-size: 0.9rem;
      color: #6366f1;
      text-decoration: none;
      margin-top: auto;
      padding-top: 12px;
      border-top: 1px solid rgba(255, 255, 255, 0.06);

      &:hover {
        text-decoration: underline;
      }
    }

    .form-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
    }

    @media (max-width: 768px) {
      .page-header {
        flex-direction: column;
        gap: 16px;
      }

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
export class RetirementListComponent {
  retirementService = inject(RetirementService);

  showAddModal = false;
  editingAccount = signal<RetirementAccount | null>(null);
  deletingAccount = signal<RetirementAccount | null>(null);

  formData = {
    name: '',
    type: '401k' as RetirementAccountType,
    provider: '',
    employer: '',
    currentBalance: 0,
    contributionYTD: 0,
    employerMatchYTD: 0,
    vestingPercent: 100
  };

  totalContributionsYTD(): number {
    return this.retirementService.accounts().reduce((sum, a) => sum + a.contributionYTD, 0);
  }

  getTypeLabel(type: RetirementAccountType): string {
    return getAccountTypeLabel(type);
  }

  getAccountValue(account: RetirementAccount): number {
    return calculateRetirementAccountValue(account);
  }

  getContributionLimit(type: RetirementAccountType): number {
    return getContributionLimit(type, false);
  }

  getContributionProgress(account: RetirementAccount): number {
    const limit = getContributionLimit(account.type, false);
    return Math.min(100, (account.contributionYTD / limit) * 100);
  }

  getContributionRemaining(account: RetirementAccount): number {
    return calculateContributionRemaining(account, false);
  }

  editAccount(account: RetirementAccount): void {
    this.editingAccount.set(account);
    this.formData = {
      name: account.name,
      type: account.type,
      provider: account.provider,
      employer: account.employer || '',
      currentBalance: account.currentBalance || 0,
      contributionYTD: account.contributionYTD,
      employerMatchYTD: account.employerMatchYTD || 0,
      vestingPercent: account.vestingPercent ?? 100
    };
  }

  confirmDelete(account: RetirementAccount): void {
    this.deletingAccount.set(account);
  }

  closeModal(): void {
    this.showAddModal = false;
    this.editingAccount.set(null);
    this.formData = { name: '', type: '401k', provider: '', employer: '', currentBalance: 0, contributionYTD: 0, employerMatchYTD: 0, vestingPercent: 100 };
  }

  saveAccount(): void {
    if (!this.formData.name || !this.formData.provider) return;

    if (this.editingAccount()) {
      this.retirementService.update(this.editingAccount()!.id, {
        name: this.formData.name,
        type: this.formData.type,
        provider: this.formData.provider,
        employer: this.formData.employer || undefined,
        currentBalance: Number(this.formData.currentBalance) || undefined,
        contributionYTD: Number(this.formData.contributionYTD),
        employerMatchYTD: Number(this.formData.employerMatchYTD) || undefined,
        vestingPercent: Number(this.formData.vestingPercent)
      });
    } else {
      this.retirementService.create({
        name: this.formData.name,
        type: this.formData.type,
        provider: this.formData.provider,
        employer: this.formData.employer || undefined,
        currentBalance: Number(this.formData.currentBalance) || undefined,
        contributionYTD: Number(this.formData.contributionYTD),
        employerMatchYTD: Number(this.formData.employerMatchYTD) || undefined,
        vestingPercent: Number(this.formData.vestingPercent)
      });
    }
    this.closeModal();
  }

  deleteAccount(): void {
    if (this.deletingAccount()) {
      this.retirementService.delete(this.deletingAccount()!.id);
      this.deletingAccount.set(null);
    }
  }
}
