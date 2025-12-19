import { Component, inject, signal } from '@angular/core';
import { CommonModule, CurrencyPipe, PercentPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BankService } from '../../../core/services/bank.service';
import { BankAccount, BankAccountType, getAccountTypeLabel } from '../../../core/models/bank-account.model';

@Component({
    selector: 'app-bank-account-list',
    standalone: true,
    imports: [CommonModule, FormsModule, CurrencyPipe, PercentPipe],
    template: `
    <div class="page animate-fade-in">
      <header class="page-header">
        <div>
          <h1>Bank Accounts</h1>
          <p class="text-muted">Track your cash across all bank accounts</p>
        </div>
        <button class="btn btn-primary" (click)="showAddModal = true">+ Add Account</button>
      </header>

      <!-- Summary Stats -->
      <div class="stats-bar">
        <div class="stat">
          <span class="stat-label">Total Cash</span>
          <span class="stat-value">{{ bankService.totalBalance() | currency:'USD':'symbol':'1.0-0' }}</span>
        </div>
        <div class="stat">
          <span class="stat-label">Accounts</span>
          <span class="stat-value">{{ bankService.accounts().length }}</span>
        </div>
        <div class="stat">
          <span class="stat-label">Checking</span>
          <span class="stat-value">{{ getBalanceByType('checking') | currency:'USD':'symbol':'1.0-0' }}</span>
        </div>
        <div class="stat">
          <span class="stat-label">Savings</span>
          <span class="stat-value">{{ getBalanceByType('savings') | currency:'USD':'symbol':'1.0-0' }}</span>
        </div>
      </div>

      <!-- Account List -->
      @if (bankService.accounts().length === 0) {
        <div class="empty-state card">
          <div class="empty-icon">💵</div>
          <h3>No bank accounts yet</h3>
          <p>Add your checking, savings, and other accounts</p>
          <button class="btn btn-primary" (click)="showAddModal = true">Add Account</button>
        </div>
      } @else {
        <div class="account-grid">
          @for (account of bankService.accounts(); track account.id) {
            <div class="account-card card">
              <div class="account-header">
                <span class="account-name">{{ account.name }}</span>
                <div class="account-actions">
                  <button class="btn btn-icon btn-secondary" (click)="editAccount(account)" title="Edit">✏️</button>
                  <button class="btn btn-icon btn-secondary" (click)="confirmDelete(account)" title="Delete">🗑️</button>
                </div>
              </div>
              <div class="account-type">
                <span class="badge" [class]="getBadgeClass(account.type)">{{ getTypeLabel(account.type) }}</span>
                <span class="account-bank">{{ account.bankName }}</span>
              </div>
              <div class="account-balance">{{ account.balance | currency:'USD':'symbol':'1.2-2' }}</div>
              @if (account.interestRate) {
                <div class="account-interest">
                  <span>APY:</span>
                  <span class="interest-value">{{ account.interestRate | percent:'1.2-2' }}</span>
                </div>
              }
            </div>
          }
        </div>
      }

      <!-- Add/Edit Modal -->
      @if (showAddModal || editingAccount()) {
        <div class="modal-overlay" (click)="closeModal()">
          <div class="modal" (click)="$event.stopPropagation()">
            <div class="modal-header">
              <h2 class="modal-title">{{ editingAccount() ? 'Edit Account' : 'Add Bank Account' }}</h2>
              <button class="modal-close" (click)="closeModal()">×</button>
            </div>
            <form (ngSubmit)="saveAccount()">
              <div class="form-group">
                <label class="form-label">Account Name</label>
                <input type="text" class="form-input" [(ngModel)]="formData.name" name="name" placeholder="e.g., Main Checking" required>
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">Account Type</label>
                  <select class="form-select" [(ngModel)]="formData.type" name="type">
                    <option value="checking">Checking</option>
                    <option value="savings">Savings</option>
                    <option value="money_market">Money Market</option>
                    <option value="cd">Certificate of Deposit</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div class="form-group">
                  <label class="form-label">Bank Name</label>
                  <input type="text" class="form-input" [(ngModel)]="formData.bankName" name="bankName" placeholder="e.g., Chase, Bank of America" required>
                </div>
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">Balance</label>
                  <input type="number" step="0.01" class="form-input" [(ngModel)]="formData.balance" name="balance" placeholder="0.00" required>
                </div>
                <div class="form-group">
                  <label class="form-label">Interest Rate (APY)</label>
                  <input type="number" step="0.0001" class="form-input" [(ngModel)]="formData.interestRate" name="interestRate" placeholder="e.g., 0.045 for 4.5%">
                </div>
              </div>
              <div class="form-group">
                <label class="form-label">Account Number (Optional)</label>
                <input type="text" class="form-input" [(ngModel)]="formData.accountNumber" name="accountNumber" placeholder="e.g., ****1234">
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

      h1 { font-size: 1.8rem; margin-bottom: 4px; }
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
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
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

    .account-bank {
      font-size: 0.85rem;
      color: #6a6a7a;
    }

    .account-balance {
      font-size: 2rem;
      font-weight: 700;
      margin: 8px 0;
    }

    .account-interest {
      display: flex;
      justify-content: space-between;
      font-size: 0.85rem;
      color: #a0a0b0;
      padding-top: 12px;
      border-top: 1px solid rgba(255, 255, 255, 0.06);
    }

    .interest-value {
      color: #22c55e;
      font-weight: 600;
    }

    .badge-checking { background: rgba(59, 130, 246, 0.15); color: #3b82f6; }
    .badge-savings { background: rgba(34, 197, 94, 0.15); color: #22c55e; }
    .badge-money_market { background: rgba(168, 85, 247, 0.15); color: #a855f7; }
    .badge-cd { background: rgba(245, 158, 11, 0.15); color: #f59e0b; }
    .badge-other { background: rgba(107, 114, 128, 0.15); color: #6b7280; }

    .form-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
    }

    @media (max-width: 768px) {
      .page-header { flex-direction: column; gap: 16px; }
      .stats-bar { flex-wrap: wrap; gap: 20px; }
      .form-row { grid-template-columns: 1fr; }
    }
  `]
})
export class BankAccountListComponent {
    bankService = inject(BankService);

    showAddModal = false;
    editingAccount = signal<BankAccount | null>(null);
    deletingAccount = signal<BankAccount | null>(null);

    formData = {
        name: '',
        type: 'checking' as BankAccountType,
        bankName: '',
        accountNumber: '',
        balance: 0,
        interestRate: 0
    };

    getBalanceByType(type: BankAccountType): number {
        return this.bankService.accounts()
            .filter(a => a.type === type)
            .reduce((sum, a) => sum + a.balance, 0);
    }

    getTypeLabel(type: BankAccountType): string {
        return getAccountTypeLabel(type);
    }

    getBadgeClass(type: BankAccountType): string {
        return `badge badge-${type}`;
    }

    editAccount(account: BankAccount): void {
        this.editingAccount.set(account);
        this.formData = {
            name: account.name,
            type: account.type,
            bankName: account.bankName,
            accountNumber: account.accountNumber || '',
            balance: account.balance,
            interestRate: account.interestRate || 0
        };
    }

    confirmDelete(account: BankAccount): void {
        this.deletingAccount.set(account);
    }

    closeModal(): void {
        this.showAddModal = false;
        this.editingAccount.set(null);
        this.formData = { name: '', type: 'checking', bankName: '', accountNumber: '', balance: 0, interestRate: 0 };
    }

    saveAccount(): void {
        if (!this.formData.name || !this.formData.bankName) return;

        if (this.editingAccount()) {
            this.bankService.update(this.editingAccount()!.id, {
                name: this.formData.name,
                type: this.formData.type,
                bankName: this.formData.bankName,
                accountNumber: this.formData.accountNumber || undefined,
                balance: Number(this.formData.balance),
                interestRate: Number(this.formData.interestRate) || undefined
            });
        } else {
            this.bankService.create({
                name: this.formData.name,
                type: this.formData.type,
                bankName: this.formData.bankName,
                accountNumber: this.formData.accountNumber || undefined,
                balance: Number(this.formData.balance),
                interestRate: Number(this.formData.interestRate) || undefined
            });
        }
        this.closeModal();
    }

    deleteAccount(): void {
        if (this.deletingAccount()) {
            this.bankService.delete(this.deletingAccount()!.id);
            this.deletingAccount.set(null);
        }
    }
}
