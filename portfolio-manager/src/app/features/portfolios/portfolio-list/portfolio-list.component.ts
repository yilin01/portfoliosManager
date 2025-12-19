import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CommonModule, CurrencyPipe, PercentPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PortfolioService } from '../../../core/services/portfolio.service';
import { Portfolio, calculatePortfolioValue, calculatePortfolioCost } from '../../../core/models/portfolio.model';

@Component({
    selector: 'app-portfolio-list',
    standalone: true,
    imports: [CommonModule, RouterLink, FormsModule, CurrencyPipe, PercentPipe],
    template: `
    <div class="page animate-fade-in">
      <header class="page-header">
        <div>
          <h1>Investment Portfolios</h1>
          <p class="text-muted">Manage your brokerage accounts</p>
        </div>
        <button class="btn btn-primary" (click)="showAddModal = true">
          + Add Portfolio
        </button>
      </header>

      <!-- Summary Stats -->
      <div class="stats-bar">
        <div class="stat">
          <span class="stat-label">Total Value</span>
          <span class="stat-value">{{ portfolioService.totalValue() | currency:'USD':'symbol':'1.0-0' }}</span>
        </div>
        <div class="stat">
          <span class="stat-label">Portfolios</span>
          <span class="stat-value">{{ portfolioService.portfolios().length }}</span>
        </div>
        <div class="stat">
          <span class="stat-label">Total Gain/Loss</span>
          <span class="stat-value" [class]="totalGainLoss() >= 0 ? 'value-positive' : 'value-negative'">
            {{ totalGainLoss() | currency:'USD':'symbol':'1.0-0' }}
          </span>
        </div>
      </div>

      <!-- Portfolio List -->
      @if (portfolioService.portfolios().length === 0) {
        <div class="empty-state card">
          <div class="empty-icon">💼</div>
          <h3>No portfolios yet</h3>
          <p>Add your first brokerage portfolio to start tracking your investments</p>
          <button class="btn btn-primary" (click)="showAddModal = true">Add Portfolio</button>
        </div>
      } @else {
        <div class="portfolio-grid">
          @for (portfolio of portfolioService.portfolios(); track portfolio.id) {
            <div class="portfolio-card card">
              <div class="portfolio-header">
                <a [routerLink]="['/portfolios', portfolio.id]" class="portfolio-name">{{ portfolio.name }}</a>
                <div class="portfolio-actions">
                  <button class="btn btn-icon btn-secondary" (click)="editPortfolio(portfolio)" title="Edit">✏️</button>
                  <button class="btn btn-icon btn-secondary" (click)="confirmDelete(portfolio)" title="Delete">🗑️</button>
                </div>
              </div>
              <div class="portfolio-broker">{{ portfolio.broker }}</div>
              <div class="portfolio-value">{{ getPortfolioValue(portfolio) | currency:'USD':'symbol':'1.0-0' }}</div>
              <div class="portfolio-meta">
                <span>{{ portfolio.holdings.length }} holdings</span>
                <span [class]="getGainLossClass(portfolio)">
                  {{ getGainLossPercent(portfolio) | percent:'1.1-1' }}
                </span>
              </div>
              <a [routerLink]="['/portfolios', portfolio.id]" class="portfolio-link">View Details →</a>
            </div>
          }
        </div>
      }

      <!-- Add/Edit Modal -->
      @if (showAddModal || editingPortfolio()) {
        <div class="modal-overlay" (click)="closeModal()">
          <div class="modal" (click)="$event.stopPropagation()">
            <div class="modal-header">
              <h2 class="modal-title">{{ editingPortfolio() ? 'Edit Portfolio' : 'Add Portfolio' }}</h2>
              <button class="modal-close" (click)="closeModal()">×</button>
            </div>
            <form (ngSubmit)="savePortfolio()">
              <div class="form-group">
                <label class="form-label">Portfolio Name</label>
                <input type="text" class="form-input" [(ngModel)]="formData.name" name="name" placeholder="e.g., Main Brokerage" required>
              </div>
              <div class="form-group">
                <label class="form-label">Broker</label>
                <input type="text" class="form-input" [(ngModel)]="formData.broker" name="broker" placeholder="e.g., Fidelity, Schwab, Robinhood" required>
              </div>
              <div class="form-group">
                <label class="form-label">Account Number (Optional)</label>
                <input type="text" class="form-input" [(ngModel)]="formData.accountNumber" name="accountNumber" placeholder="e.g., ****1234">
              </div>
              <div class="modal-footer">
                <button type="button" class="btn btn-secondary" (click)="closeModal()">Cancel</button>
                <button type="submit" class="btn btn-primary">{{ editingPortfolio() ? 'Save Changes' : 'Add Portfolio' }}</button>
              </div>
            </form>
          </div>
        </div>
      }

      <!-- Delete Confirmation Modal -->
      @if (deletingPortfolio()) {
        <div class="modal-overlay" (click)="deletingPortfolio.set(null)">
          <div class="modal" (click)="$event.stopPropagation()">
            <div class="modal-header">
              <h2 class="modal-title">Delete Portfolio</h2>
              <button class="modal-close" (click)="deletingPortfolio.set(null)">×</button>
            </div>
            <p>Are you sure you want to delete <strong>{{ deletingPortfolio()?.name }}</strong>? This will also delete all holdings in this portfolio.</p>
            <div class="modal-footer">
              <button class="btn btn-secondary" (click)="deletingPortfolio.set(null)">Cancel</button>
              <button class="btn btn-danger" (click)="deletePortfolio()">Delete</button>
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

    .portfolio-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
      gap: 20px;
    }

    .portfolio-card {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .portfolio-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .portfolio-name {
      font-size: 1.2rem;
      font-weight: 600;
      color: white;
      text-decoration: none;

      &:hover {
        color: #6366f1;
      }
    }

    .portfolio-actions {
      display: flex;
      gap: 6px;
    }

    .portfolio-broker {
      font-size: 0.85rem;
      color: #6a6a7a;
    }

    .portfolio-value {
      font-size: 1.8rem;
      font-weight: 700;
      margin: 8px 0;
    }

    .portfolio-meta {
      display: flex;
      justify-content: space-between;
      font-size: 0.85rem;
      color: #a0a0b0;
    }

    .portfolio-link {
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

    .value-positive { color: #22c55e; }
    .value-negative { color: #ef4444; }

    @media (max-width: 768px) {
      .page-header {
        flex-direction: column;
        gap: 16px;
      }

      .stats-bar {
        flex-wrap: wrap;
        gap: 20px;
      }
    }
  `]
})
export class PortfolioListComponent {
    portfolioService = inject(PortfolioService);

    showAddModal = false;
    editingPortfolio = signal<Portfolio | null>(null);
    deletingPortfolio = signal<Portfolio | null>(null);

    formData = {
        name: '',
        broker: '',
        accountNumber: ''
    };

    totalGainLoss(): number {
        return this.portfolioService.portfolios().reduce((sum, p) => {
            return sum + (calculatePortfolioValue(p) - calculatePortfolioCost(p));
        }, 0);
    }

    getPortfolioValue(portfolio: Portfolio): number {
        return calculatePortfolioValue(portfolio);
    }

    getGainLossPercent(portfolio: Portfolio): number {
        const value = calculatePortfolioValue(portfolio);
        const cost = calculatePortfolioCost(portfolio);
        if (cost === 0) return 0;
        return (value - cost) / cost;
    }

    getGainLossClass(portfolio: Portfolio): string {
        return this.getGainLossPercent(portfolio) >= 0 ? 'value-positive' : 'value-negative';
    }

    editPortfolio(portfolio: Portfolio): void {
        this.editingPortfolio.set(portfolio);
        this.formData = {
            name: portfolio.name,
            broker: portfolio.broker,
            accountNumber: portfolio.accountNumber || ''
        };
    }

    confirmDelete(portfolio: Portfolio): void {
        this.deletingPortfolio.set(portfolio);
    }

    closeModal(): void {
        this.showAddModal = false;
        this.editingPortfolio.set(null);
        this.formData = { name: '', broker: '', accountNumber: '' };
    }

    savePortfolio(): void {
        if (!this.formData.name || !this.formData.broker) return;

        if (this.editingPortfolio()) {
            this.portfolioService.update(this.editingPortfolio()!.id, {
                name: this.formData.name,
                broker: this.formData.broker,
                accountNumber: this.formData.accountNumber || undefined
            });
        } else {
            this.portfolioService.create({
                name: this.formData.name,
                broker: this.formData.broker,
                accountNumber: this.formData.accountNumber || undefined
            });
        }
        this.closeModal();
    }

    deletePortfolio(): void {
        if (this.deletingPortfolio()) {
            this.portfolioService.delete(this.deletingPortfolio()!.id);
            this.deletingPortfolio.set(null);
        }
    }
}
