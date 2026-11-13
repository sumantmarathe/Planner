/**
 * Financial Planning, Recurring Cash Flow & Predictive Wealth Engine
 */

import { formatDateISO, parseDateISO, getTodayISO } from './calendar-utils.mjs';

export const FINANCE_TYPES = Object.freeze({
  INCOME: 'INCOME',
  EXPENSE: 'EXPENSE'
});

export const PERIODICITIES = Object.freeze({
  MONTHLY: 'MONTHLY',
  QUARTERLY: 'QUARTERLY',
  YEARLY: 'YEARLY',
  WEEKLY: 'WEEKLY',
  BIWEEKLY: 'BIWEEKLY',
  CUSTOM: 'CUSTOM'
});

export const PERIODICITY_LABELS = Object.freeze({
  MONTHLY: 'Monthly',
  QUARTERLY: 'Quarterly (Every 3 Mo)',
  YEARLY: 'Yearly (Annual)',
  WEEKLY: 'Weekly',
  BIWEEKLY: 'Bi-Weekly (Every 2 Wks)',
  CUSTOM: 'Custom Interval'
});

export const FINANCE_CATEGORIES = Object.freeze({
  INCOME: [
    'Salary',
    'Freelance / Consulting',
    'Business',
    'Investments & Dividends',
    'Rental Income',
    'Interest',
    'Gifts & Grants',
    'Other Income'
  ],
  EXPENSE: [
    'Rent / Housing',
    'EMI & Loan Repayments',
    'Utilities & Electricity',
    'Groceries & Food',
    'Transportation & Fuel',
    'Insurance Policies',
    'Healthcare & Medical',
    'Education & Fees',
    'Digital Subscriptions',
    'Entertainment & Outings',
    'Family & Household',
    'Savings & Emergency Fund',
    'Other Expense'
  ]
});

function generateId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'fin_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 9);
}

/**
 * Validates financial record inputs
 */
export function validateFinanceRecord(input) {
  if (!input || typeof input !== 'object') {
    throw new Error('ERR_FINANCE_INPUT: Record must be a non-null object');
  }

  const name = (input.name || input.title || '').trim();
  if (!name) {
    throw new Error('ERR_FINANCE_NAME: Name is required');
  }

  const type = (input.type || '').toUpperCase();
  if (!Object.values(FINANCE_TYPES).includes(type)) {
    throw new Error(`ERR_FINANCE_TYPE: Type must be either INCOME or EXPENSE (got ${input.type})`);
  }

  const amount = Number(input.amount);
  if (isNaN(amount) || amount <= 0) {
    throw new Error('ERR_FINANCE_AMOUNT: Amount must be a positive number in Rupees');
  }

  let periodicity = (input.periodicity || PERIODICITIES.MONTHLY).toUpperCase();
  if (!Object.values(PERIODICITIES).includes(periodicity)) {
    periodicity = PERIODICITIES.MONTHLY;
  }

  const intervalMonths = Math.max(1, parseInt(input.intervalMonths, 10) || (periodicity === PERIODICITIES.QUARTERLY ? 3 : (periodicity === PERIODICITIES.YEARLY ? 12 : 1)));

  let defaultPaymentDate = parseInt(input.defaultPaymentDate, 10);
  if (isNaN(defaultPaymentDate) || defaultPaymentDate < 1 || defaultPaymentDate > 31) {
    defaultPaymentDate = 1;
  }

  let dueDate = parseInt(input.dueDate, 10);
  if (isNaN(dueDate) || dueDate < 1 || dueDate > 31) {
    dueDate = defaultPaymentDate;
  }

  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  let startDate = (input.startDate || '').trim() || null;
  let endDate = (input.endDate || '').trim() || null;

  if (startDate && (!dateRegex.test(startDate) || isNaN(Date.parse(startDate)))) {
    startDate = null;
  }
  if (endDate && (!dateRegex.test(endDate) || isNaN(Date.parse(endDate)))) {
    endDate = null;
  }

  if (startDate && endDate && startDate > endDate) {
    const tmp = startDate;
    startDate = endDate;
    endDate = tmp;
  }

  const category = (input.category || (type === FINANCE_TYPES.INCOME ? 'Salary' : 'Rent / Housing')).trim();
  const notes = (input.notes || input.description || '').trim();

  return {
    name,
    type,
    amount: Math.round(amount * 100) / 100,
    periodicity,
    intervalMonths,
    defaultPaymentDate,
    dueDate,
    category,
    startDate,
    endDate,
    notes
  };
}

/**
 * Creates a persisted financial record
 */
export function createFinanceRecord(rawInput) {
  const validated = validateFinanceRecord(rawInput);
  const now = new Date().toISOString();

  return {
    id: rawInput.id || generateId(),
    ...validated,
    createdAt: rawInput.createdAt || now,
    updatedAt: now
  };
}

/**
 * Checks whether a recurring financial item falls into a given target month (YYYY-MM)
 */
export function isRecordActiveInMonth(record, targetYear, targetMonthIndex) {
  // targetMonthIndex is 0-based: 0 for Jan, 11 for Dec
  const monthStart = new Date(targetYear, targetMonthIndex, 1);
  const monthEnd = new Date(targetYear, targetMonthIndex + 1, 0); // Last day of month
  const monthStartIso = formatDateISO(monthStart);
  const monthEndIso = formatDateISO(monthEnd);

  // 1. Check startDate bound
  if (record.startDate && record.startDate > monthEndIso) {
    return false;
  }

  // 2. Check endDate bound
  if (record.endDate && record.endDate < monthStartIso) {
    return false;
  }

  // 3. Periodicity frequency check
  const anchorDate = record.startDate ? parseDateISO(record.startDate) : new Date(record.createdAt || Date.now());
  const anchorYear = anchorDate.getFullYear();
  const anchorMonthIndex = anchorDate.getMonth();

  const totalMonthsDiff = (targetYear - anchorYear) * 12 + (targetMonthIndex - anchorMonthIndex);
  if (totalMonthsDiff < 0) return false;

  switch (record.periodicity) {
    case PERIODICITIES.MONTHLY:
      return true;

    case PERIODICITIES.QUARTERLY:
      return totalMonthsDiff % 3 === 0;

    case PERIODICITIES.YEARLY:
      return totalMonthsDiff % 12 === 0;

    case PERIODICITIES.CUSTOM:
      return totalMonthsDiff % (record.intervalMonths || 1) === 0;

    case PERIODICITIES.WEEKLY:
    case PERIODICITIES.BIWEEKLY:
      return true; // Occurs in every month

    default:
      return true;
  }
}

/**
 * Computes total monthly amount for an active item in a specific month
 */
export function calculateMonthItemMultiplier(record, targetYear, targetMonthIndex) {
  if (record.periodicity === PERIODICITIES.WEEKLY) {
    // Exact count of day-of-week occurrences in month, or standard 52/12 = 4.33
    const daysInMonth = new Date(targetYear, targetMonthIndex + 1, 0).getDate();
    return Math.round((daysInMonth / 7) * 100) / 100;
  }
  if (record.periodicity === PERIODICITIES.BIWEEKLY) {
    const daysInMonth = new Date(targetYear, targetMonthIndex + 1, 0).getDate();
    return Math.round((daysInMonth / 14) * 100) / 100;
  }
  return 1;
}

/**
 * Predictive Engine: Projects cash flow and savings over the upcoming horizon
 */
export function calculateFinancialForecast(records = [], options = {}) {
  const horizonMonths = Math.max(1, Math.min(60, options.horizonMonths || 6));
  const refDate = options.referenceDateIso ? parseDateISO(options.referenceDateIso) : new Date();

  const startYear = refDate.getFullYear();
  const startMonth = refDate.getMonth(); // 0-based

  const monthlyForecasts = [];
  let runningCumulativeSavings = 0;
  const categoryTotals = {};

  for (let offset = 0; offset < horizonMonths; offset++) {
    const dateCursor = new Date(startYear, startMonth + offset, 1);
    const yr = dateCursor.getFullYear();
    const mo = dateCursor.getMonth();

    const monthKey = `${yr}-${String(mo + 1).padStart(2, '0')}`;
    const monthLabel = dateCursor.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

    let monthIncome = 0;
    let monthExpense = 0;
    const activeIncomes = [];
    const activeExpenses = [];

    for (const record of records) {
      if (!isRecordActiveInMonth(record, yr, mo)) {
        continue;
      }

      const multiplier = calculateMonthItemMultiplier(record, yr, mo);
      const computedAmount = Math.round(record.amount * multiplier);

      const daysInThisMonth = new Date(yr, mo + 1, 0).getDate();
      const actualPaymentDay = Math.min(record.defaultPaymentDate || 1, daysInThisMonth);
      const paymentDateIso = `${monthKey}-${String(actualPaymentDay).padStart(2, '0')}`;

      const entry = {
        recordId: record.id,
        name: record.name,
        amount: computedAmount,
        category: record.category,
        paymentDate: paymentDateIso,
        periodicity: record.periodicity
      };

      if (record.type === FINANCE_TYPES.INCOME) {
        monthIncome += computedAmount;
        activeIncomes.push(entry);
      } else {
        monthExpense += computedAmount;
        activeExpenses.push(entry);
        categoryTotals[record.category] = (categoryTotals[record.category] || 0) + computedAmount;
      }
    }

    const netSavings = monthIncome - monthExpense;
    runningCumulativeSavings += netSavings;

    const savingsRate = monthIncome > 0
      ? Math.max(-100, Math.min(100, Math.round((netSavings / monthIncome) * 100)))
      : (monthExpense > 0 ? -100 : 0);

    monthlyForecasts.push({
      monthKey,
      monthLabel,
      totalIncome: monthIncome,
      totalExpense: monthExpense,
      netSavings,
      cumulativeSavings: runningCumulativeSavings,
      savingsRate,
      incomes: activeIncomes,
      expenses: activeExpenses
    });
  }

  const totalIncomeAll = monthlyForecasts.reduce((acc, m) => acc + m.totalIncome, 0);
  const totalExpenseAll = monthlyForecasts.reduce((acc, m) => acc + m.totalExpense, 0);
  const totalProjectedSavings = runningCumulativeSavings;

  return {
    horizonMonths,
    monthlyForecasts,
    averageMonthlyIncome: Math.round(totalIncomeAll / horizonMonths),
    averageMonthlyExpense: Math.round(totalExpenseAll / horizonMonths),
    averageMonthlySavings: Math.round(totalProjectedSavings / horizonMonths),
    totalProjectedSavings,
    expenseCategoryBreakdown: categoryTotals
  };
}

/**
 * Helper to format Rupee currency nicely (₹1,50,000)
 */
export function formatRupees(amount) {
  const num = Math.round(amount || 0);
  const sign = num < 0 ? '-' : '';
  const abs = Math.abs(num);
  
  // Format Indian Numbering System (Lakhs & Crores)
  const str = abs.toString();
  let result = '';
  if (str.length > 3) {
    const lastThree = str.substring(str.length - 3);
    const otherNumbers = str.substring(0, str.length - 3);
    result = otherNumbers.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + lastThree;
  } else {
    result = str;
  }

  return `${sign}₹${result}`;
}
