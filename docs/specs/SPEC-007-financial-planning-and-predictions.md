---
id: SPEC-007
title: Financial Planning, Recurring Cash Flow & Predictive Wealth Projections
status: LOCKED
owner_mode: architect
target_platforms: [PWA, Android]
offline_capable: true
invariants:
  - isolated_navigation_grouping
  - local_first_financial_privacy
  - confidential_gdrive_sync_inclusion
  - deterministic_recurrence_cashflow_projections
  - standalone_responsive_svg_charting
---

# Specification: Financial Planning, Recurring Cash Flow & Predictive Wealth Projections

## 1. Functional Requirements

- **FR-01 (Navigation Separation)**:
  - Top navigation bar split into two clear groups:
    - Left/Primary cluster: **Plan**, **Tasks**, **Habits**.
    - Distinct secondary feature button on the other side (right-aligned in nav): **Finance** (`#nav-btn-finance`) with a distinct icon and styling.
  - Keyboard shortcut: <kbd>F</kbd> or <kbd>4</kbd> to open Finance.

- **FR-02 (Financial Data Model - Incomes & Expenses)**:
  - Entity types: `INCOME` and `EXPENSE`.
  - Currency: Indian Rupee (`₹` / `INR`).
  - Required & optional attributes:
    - `id`: unique UUID string.
    - `name` / `title`: non-empty string.
    - `type`: `'INCOME'` | `'EXPENSE'`.
    - `amount`: positive number in Rupees (`₹`).
    - `periodicity`:
      - `MONTHLY`: recurs every month on payment date.
      - `QUARTERLY`: recurs every 3 months.
      - `YEARLY`: recurs annually.
      - `WEEKLY`: recurs weekly.
      - `BIWEEKLY`: recurs every 2 weeks.
      - `CUSTOM`: customizable month interval (`intervalMonths`).
    - `dueDate`: number (day of month 1-31) or null.
    - `defaultPaymentDate`: number (day of month 1-31).
    - `category`: categorized string (e.g. Salary, Freelance, Investment, Rent, EMI/Loans, Utilities, Groceries, Insurance, Subscriptions, Lifestyle, Other).
    - `startDate`: optional ISO date string (`YYYY-MM-DD` or null).
    - `endDate`: optional ISO date string (`YYYY-MM-DD` or null).
    - `notes`: optional string.
    - `createdAt`, `updatedAt`: ISO timestamp strings.

- **FR-03 (Predictive Projection Engine)**:
  - Configurable forecast horizon: 3, 6, 12, or 24 upcoming months.
  - For each month $m$ in the horizon:
    - Evaluate active recurring incomes: $\text{Total Income}(m) = \sum \text{Income}_i(m)$.
    - Evaluate active recurring expenses: $\text{Money Needed}(m) = \sum \text{Expense}_j(m)$.
    - Calculate Net Savings: $\text{Net Savings}(m) = \text{Total Income}(m) - \text{Money Needed}(m)$.
    - Calculate Cumulative Wealth Accumulation: $\text{Cumulative Savings}(m) = \sum_{k=1}^m \text{Net Savings}(k)$.
    - Calculate Savings Rate %: $\frac{\text{Net Savings}(m)}{\text{Total Income}(m)} \times 100\%$.
    - Detect potential cash flow deficits (expenses exceeding income in any month).

- **FR-04 (Interactive Visual Data & Graphs)**:
  - Lightweight, responsive native SVG charting (zero external heavy dependencies, 100% offline and cross-platform):
    1. **Monthly Cash Flow Projection Chart**: Dual-bar comparison of Monthly Income vs. Money Needed across upcoming months.
    2. **Cumulative Savings Growth Curve**: Smooth line/area trend graph showing projected savings trajectory over time.
    3. **Expense Distribution Donut Chart**: Breakdown of recurring expenses by category.
  - Interactive period toggle: 3 Months, 6 Months, 12 Months, 24 Months.

- **FR-05 (Confidential Storage & Sync Integration)**:
  - Financial records persist in local IndexedDB/LocalStorage under store key `dayplanner_finance_v1`.
  - Serialized and encrypted/safeguarded within the existing Google Drive `appDataFolder` sync payload (`dayplanner_database.json`) under key `financeRecords`.

## 2. Interface Contracts

```typescript
export type CashFlowType = 'INCOME' | 'EXPENSE';

export type FinancialPeriodicity = 'MONTHLY' | 'QUARTERLY' | 'YEARLY' | 'WEEKLY' | 'BIWEEKLY' | 'CUSTOM';

export interface FinanceRecord {
  id: string;
  name: string;
  type: CashFlowType;
  amount: number; // In Rupees (₹)
  periodicity: FinancialPeriodicity;
  intervalMonths?: number; // For CUSTOM
  dueDate: number; // Day of month 1-31
  defaultPaymentDate: number; // Day of month 1-31
  category: string;
  startDate: string | null;
  endDate: string | null;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface MonthForecast {
  monthKey: string; // YYYY-MM
  monthLabel: string; // "Jan 2027"
  totalIncome: number;
  totalExpense: number;
  netSavings: number;
  cumulativeSavings: number;
  savingsRate: number; // 0 - 100%
  incomes: Array<{ recordId: string; name: string; amount: number; paymentDate: string }>;
  expenses: Array<{ recordId: string; name: string; amount: number; paymentDate: string }>;
}

export interface FinanceForecastSummary {
  horizonMonths: number;
  monthlyForecasts: MonthForecast[];
  averageMonthlyIncome: number;
  averageMonthlyExpense: number;
  averageMonthlySavings: number;
  totalProjectedSavings: number;
  expenseCategoryBreakdown: Record<string, number>;
}
```

## 3. Edge Cases & Validation Rules

| Scenario | System Behavior | Error/Event Code |
| :--- | :--- | :--- |
| Negative or zero amount | Validation throws error; amount must be positive | `ERR_VALIDATION_AMOUNT` |
| Empty name | Validation throws error; name is required | `ERR_VALIDATION_NAME` |
| Day of month > 31 or < 1 | Clamped to valid range 1-31 | `NORMALIZED_DATE` |
| Leap year / 28-30 day months | If payment day is 31 and month has 30 days, payments occur on last day of month | `MONTH_END_ADJUSTED` |
| Expense > Income | Net savings is negative; UI visually warns of projected shortfall in red | `DEFICIT_WARNING` |
