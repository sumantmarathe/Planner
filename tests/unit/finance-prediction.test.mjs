import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createFinanceRecord,
  validateFinanceRecord,
  calculateFinancialForecast,
  FINANCE_TYPES,
  PERIODICITIES
} from '../../js/core/finance.mjs';

test('Finance Model: validates required fields and normalizes attributes', () => {
  // Valid Income
  const income = validateFinanceRecord({
    name: 'Primary Salary',
    type: FINANCE_TYPES.INCOME,
    amount: 150000,
    periodicity: PERIODICITIES.MONTHLY,
    defaultPaymentDate: 1,
    category: 'Salary'
  });

  assert.equal(income.name, 'Primary Salary');
  assert.equal(income.type, 'INCOME');
  assert.equal(income.amount, 150000);
  assert.equal(income.defaultPaymentDate, 1);
  assert.equal(income.dueDate, 1);

  // Invalid Amount (non-positive)
  assert.throws(() => {
    validateFinanceRecord({ name: 'Bonus', type: FINANCE_TYPES.INCOME, amount: -500 });
  }, /ERR_FINANCE_AMOUNT/);

  // Invalid Name
  assert.throws(() => {
    validateFinanceRecord({ name: '', type: FINANCE_TYPES.EXPENSE, amount: 2000 });
  }, /ERR_FINANCE_NAME/);

  // Invalid Type
  assert.throws(() => {
    validateFinanceRecord({ name: 'Misc', type: 'INVALID', amount: 2000 });
  }, /ERR_FINANCE_TYPE/);
});

test('Finance Prediction: projects recurring cash flow, money needed, and cumulative savings', () => {
  const records = [
    // Monthly Salary: ₹1,00,000
    createFinanceRecord({
      name: 'Salary',
      type: FINANCE_TYPES.INCOME,
      amount: 100000,
      periodicity: PERIODICITIES.MONTHLY,
      defaultPaymentDate: 1,
      category: 'Salary'
    }),
    // Monthly Rent: ₹30,000
    createFinanceRecord({
      name: 'Apartment Rent',
      type: FINANCE_TYPES.EXPENSE,
      amount: 30000,
      periodicity: PERIODICITIES.MONTHLY,
      defaultPaymentDate: 5,
      category: 'Rent'
    }),
    // Monthly Groceries & Utilities: ₹20,000
    createFinanceRecord({
      name: 'Living Expenses',
      type: FINANCE_TYPES.EXPENSE,
      amount: 20000,
      periodicity: PERIODICITIES.MONTHLY,
      defaultPaymentDate: 10,
      category: 'Utilities'
    })
  ];

  const forecast = calculateFinancialForecast(records, {
    horizonMonths: 6,
    referenceDateIso: '2026-11-01'
  });

  assert.equal(forecast.horizonMonths, 6);
  assert.equal(forecast.monthlyForecasts.length, 6);

  // In each month:
  // Income: ₹1,00,000
  // Expenses needed: ₹50,000
  // Net Savings: ₹50,000
  forecast.monthlyForecasts.forEach((m, idx) => {
    assert.equal(m.totalIncome, 100000, `Month ${m.monthKey} income`);
    assert.equal(m.totalExpense, 50000, `Month ${m.monthKey} needed expenses`);
    assert.equal(m.netSavings, 50000, `Month ${m.monthKey} net savings`);
    assert.equal(m.cumulativeSavings, 50000 * (idx + 1), `Cumulative savings month ${idx + 1}`);
    assert.equal(m.savingsRate, 50, `Savings rate 50%`);
  });

  assert.equal(forecast.totalProjectedSavings, 300000);
  assert.equal(forecast.expenseCategoryBreakdown.Rent, 180000);
  assert.equal(forecast.expenseCategoryBreakdown.Utilities, 120000);
});

test('Finance Prediction: handles non-monthly periodicity and active date bounds', () => {
  const records = [
    // Base monthly income: ₹80,000
    createFinanceRecord({
      name: 'Consulting Retainer',
      type: FINANCE_TYPES.INCOME,
      amount: 80000,
      periodicity: PERIODICITIES.MONTHLY,
      defaultPaymentDate: 1
    }),
    // Quarterly bonus: ₹40,000 in months 1 and 4
    createFinanceRecord({
      name: 'Quarterly Bonus',
      type: FINANCE_TYPES.INCOME,
      amount: 40000,
      periodicity: PERIODICITIES.QUARTERLY,
      startDate: '2026-11-01',
      defaultPaymentDate: 15
    }),
    // Car EMI of ₹15,000 that ends after 2 months (ends 2026-12-31)
    createFinanceRecord({
      name: 'Car Loan EMI',
      type: FINANCE_TYPES.EXPENSE,
      amount: 15000,
      periodicity: PERIODICITIES.MONTHLY,
      startDate: '2026-01-01',
      endDate: '2026-12-31',
      defaultPaymentDate: 10
    })
  ];

  const forecast = calculateFinancialForecast(records, {
    horizonMonths: 4,
    referenceDateIso: '2026-11-01'
  });

  const m1 = forecast.monthlyForecasts[0]; // Nov 2026: 80k + 40k income = 120k; EMI active = 15k
  assert.equal(m1.totalIncome, 120000);
  assert.equal(m1.totalExpense, 15000);

  const m2 = forecast.monthlyForecasts[1]; // Dec 2026: 80k income; EMI active = 15k
  assert.equal(m2.totalIncome, 80000);
  assert.equal(m2.totalExpense, 15000);

  const m3 = forecast.monthlyForecasts[2]; // Jan 2027: 80k income; EMI ended = 0k
  assert.equal(m3.totalIncome, 80000);
  assert.equal(m3.totalExpense, 0);

  const m4 = forecast.monthlyForecasts[3]; // Feb 2027: 80k + 40k quarterly bonus = 120k; EMI ended = 0k
  assert.equal(m4.totalIncome, 120000);
  assert.equal(m4.totalExpense, 0);
});
