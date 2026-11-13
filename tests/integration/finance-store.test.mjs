import test from 'node:test';
import assert from 'node:assert/strict';
import { createPlannerStore, MemoryStorageAdapter } from '../../js/core/store.mjs';
import { FINANCE_TYPES, PERIODICITIES } from '../../js/core/finance.mjs';

test('Finance Store Integration: CRUD lifecycle and prediction calculation', async () => {
  const store = createPlannerStore(new MemoryStorageAdapter(), new MemoryStorageAdapter(), new MemoryStorageAdapter());

  // Create Income
  const salary = await store.createFinanceRecord({
    name: 'Tech Job Salary',
    type: FINANCE_TYPES.INCOME,
    amount: 180000,
    periodicity: PERIODICITIES.MONTHLY,
    defaultPaymentDate: 1,
    category: 'Salary'
  });

  assert.ok(salary.id);
  assert.equal(salary.amount, 180000);

  // Create Expense
  const rent = await store.createFinanceRecord({
    name: 'Home Rent',
    type: FINANCE_TYPES.EXPENSE,
    amount: 45000,
    periodicity: PERIODICITIES.MONTHLY,
    defaultPaymentDate: 5,
    category: 'Rent / Housing'
  });

  assert.ok(rent.id);
  assert.equal(rent.amount, 45000);

  // List all
  const all = await store.getAllFinanceRecords();
  assert.equal(all.length, 2);

  // Update rent
  const updatedRent = await store.updateFinanceRecord(rent.id, { amount: 50000 });
  assert.equal(updatedRent.amount, 50000);

  // Get forecast
  const forecast = await store.getFinancialForecast({ horizonMonths: 3 });
  assert.equal(forecast.horizonMonths, 3);
  assert.equal(forecast.monthlyForecasts[0].totalIncome, 180000);
  assert.equal(forecast.monthlyForecasts[0].totalExpense, 50000);
  assert.equal(forecast.monthlyForecasts[0].netSavings, 130000);

  // Export & Import backup verification
  const exported = await store.exportData();
  const parsed = JSON.parse(exported);
  assert.ok(Array.isArray(parsed.financeRecords));
  assert.equal(parsed.financeRecords.length, 2);

  // Delete
  await store.deleteFinanceRecord(salary.id);
  const remaining = await store.getAllFinanceRecords();
  assert.equal(remaining.length, 1);
});

