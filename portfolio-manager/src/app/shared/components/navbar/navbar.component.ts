import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

@Component({
    selector: 'app-navbar',
    standalone: true,
    imports: [RouterLink, RouterLinkActive],
    template: `
    <nav class="navbar">
      <div class="navbar-container">
        <a routerLink="/dashboard" class="navbar-brand">
          <span class="brand-icon">📊</span>
          <span class="brand-text">Portfolio Manager</span>
        </a>
        
        <div class="navbar-links">
          <a routerLink="/dashboard" routerLinkActive="active" [routerLinkActiveOptions]="{exact: true}" class="nav-link">
            <span class="nav-icon">🏠</span>
            <span class="nav-text">Dashboard</span>
          </a>
          <a routerLink="/portfolios" routerLinkActive="active" class="nav-link">
            <span class="nav-icon">💼</span>
            <span class="nav-text">Portfolios</span>
          </a>
          <a routerLink="/retirement" routerLinkActive="active" class="nav-link">
            <span class="nav-icon">🏦</span>
            <span class="nav-text">Retirement</span>
          </a>
          <a routerLink="/bank-accounts" routerLinkActive="active" class="nav-link">
            <span class="nav-icon">💵</span>
            <span class="nav-text">Bank Accounts</span>
          </a>
        </div>
      </div>
    </nav>
  `,
    styles: [`
    .navbar {
      background: rgba(26, 26, 46, 0.95);
      backdrop-filter: blur(20px);
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      position: sticky;
      top: 0;
      z-index: 100;
    }

    .navbar-container {
      max-width: 1400px;
      margin: 0 auto;
      padding: 0 24px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      height: 70px;
    }

    .navbar-brand {
      display: flex;
      align-items: center;
      gap: 12px;
      text-decoration: none;
      color: white;
      font-weight: 600;
      font-size: 1.25rem;
      transition: opacity 0.2s;

      &:hover {
        opacity: 0.9;
      }
    }

    .brand-icon {
      font-size: 1.5rem;
    }

    .brand-text {
      background: linear-gradient(135deg, #6366f1 0%, #a855f7 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }

    .navbar-links {
      display: flex;
      gap: 8px;
    }

    .nav-link {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 16px;
      border-radius: 10px;
      text-decoration: none;
      color: #a0a0b0;
      font-weight: 500;
      font-size: 0.95rem;
      transition: all 0.2s;

      &:hover {
        background: rgba(255, 255, 255, 0.05);
        color: white;
      }

      &.active {
        background: rgba(99, 102, 241, 0.15);
        color: #6366f1;
      }
    }

    .nav-icon {
      font-size: 1.1rem;
    }

    @media (max-width: 768px) {
      .navbar-container {
        padding: 0 16px;
      }

      .nav-text {
        display: none;
      }

      .nav-link {
        padding: 10px 12px;
      }

      .brand-text {
        display: none;
      }
    }
  `]
})
export class NavbarComponent { }
