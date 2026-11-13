/**
 * Native SVG Charting for Financial Planning & Wealth Projections
 * Zero external libraries, 100% offline, crisp vector rendering
 */

import { formatRupees } from '../core/finance.mjs';

/**
 * Escapes HTML characters for safe SVG labels
 */
function escapeSvg(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Generates an SVG Dual-Bar Chart comparing Monthly Income vs. Money Needed (Expenses)
 */
export function generateCashFlowBarChartSvg(monthlyForecasts = [], width = 720, height = 280) {
  if (!monthlyForecasts || monthlyForecasts.length === 0) {
    return `<svg viewBox="0 0 ${width} ${height}" class="finance-svg-chart empty"><text x="50%" y="50%" text-anchor="middle" fill="#64748b" font-size="14">No financial projections available</text></svg>`;
  }

  const padding = { top: 35, right: 25, bottom: 45, left: 75 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  let maxVal = Math.max(...monthlyForecasts.map(m => Math.max(m.totalIncome, m.totalExpense)), 10000);
  // Round maxVal up to pleasant interval
  const magnitude = Math.pow(10, Math.floor(Math.log10(maxVal)));
  maxVal = Math.ceil(maxVal / magnitude) * magnitude;

  const numMonths = monthlyForecasts.length;
  const colWidth = chartW / numMonths;
  const barWidth = Math.max(8, Math.min(26, colWidth * 0.32));
  const barGap = 4;

  // Horizontal Grid Lines
  const gridCount = 4;
  let gridSvg = '';
  for (let i = 0; i <= gridCount; i++) {
    const val = (maxVal / gridCount) * i;
    const y = padding.top + chartH - (val / maxVal) * chartH;
    gridSvg += `
      <line x1="${padding.left}" y1="${y}" x2="${width - padding.right}" y2="${y}" stroke="rgba(255, 255, 255, 0.08)" stroke-dasharray="3,3" />
      <text x="${padding.left - 8}" y="${y + 4}" fill="#94a3b8" font-size="10" text-anchor="end">${formatRupees(val)}</text>
    `;
  }

  // Bars & Labels
  let barsSvg = '';
  monthlyForecasts.forEach((m, idx) => {
    const centerX = padding.left + (idx + 0.5) * colWidth;
    const incomeH = Math.max(2, (m.totalIncome / maxVal) * chartH);
    const expenseH = Math.max(2, (m.totalExpense / maxVal) * chartH);

    const incomeX = centerX - barWidth - (barGap / 2);
    const expenseX = centerX + (barGap / 2);

    const incomeY = padding.top + chartH - incomeH;
    const expenseY = padding.top + chartH - expenseH;

    const surplusColor = m.netSavings >= 0 ? '#10b981' : '#ef4444';

    barsSvg += `
      <!-- Month Group -->
      <g class="chart-month-col" data-month="${escapeSvg(m.monthKey)}">
        <!-- Income Bar -->
        <rect x="${incomeX}" y="${incomeY}" width="${barWidth}" height="${incomeH}" rx="4" fill="#10b981" opacity="0.9">
          <title>${escapeSvg(m.monthLabel)} Income: ${formatRupees(m.totalIncome)}</title>
        </rect>

        <!-- Expense (Money Needed) Bar -->
        <rect x="${expenseX}" y="${expenseY}" width="${barWidth}" height="${expenseH}" rx="4" fill="#f43f5e" opacity="0.9">
          <title>${escapeSvg(m.monthLabel)} Needed: ${formatRupees(m.totalExpense)}</title>
        </rect>

        <!-- Net Savings Indicator -->
        <circle cx="${centerX}" y="${Math.min(incomeY, expenseY) - 10}" r="3" fill="${surplusColor}" />

        <!-- X Axis Label -->
        <text x="${centerX}" y="${height - padding.bottom + 20}" fill="#cbd5e1" font-size="11" font-weight="600" text-anchor="middle">
          ${escapeSvg(m.monthLabel)}
        </text>

        <!-- Net Savings Sub-label -->
        <text x="${centerX}" y="${height - padding.bottom + 34}" fill="${surplusColor}" font-size="9" font-weight="700" text-anchor="middle">
          ${m.netSavings >= 0 ? '+' : ''}${formatRupees(m.netSavings)}
        </text>
      </g>
    `;
  });

  return `
    <svg viewBox="0 0 ${width} ${height}" class="finance-svg-chart" style="width: 100%; height: auto; display: block; overflow: visible;">
      <defs>
        <linearGradient id="incomeGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#10b981" stop-opacity="1" />
          <stop offset="100%" stop-color="#059669" stop-opacity="0.8" />
        </linearGradient>
      </defs>
      <!-- Background / Grid -->
      ${gridSvg}
      <!-- Bars & Annotations -->
      ${barsSvg}
    </svg>
  `;
}

/**
 * Generates an SVG Cumulative Wealth & Savings Projection Curve
 */
export function generateSavingsTrajectorySvg(monthlyForecasts = [], width = 720, height = 240) {
  if (!monthlyForecasts || monthlyForecasts.length === 0) {
    return `<svg viewBox="0 0 ${width} ${height}" class="finance-svg-chart empty"><text x="50%" y="50%" text-anchor="middle" fill="#64748b" font-size="14">No savings projection available</text></svg>`;
  }

  const padding = { top: 30, right: 35, bottom: 40, left: 75 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  const values = monthlyForecasts.map(m => m.cumulativeSavings);
  const minVal = Math.min(0, ...values);
  const maxVal = Math.max(10000, ...values);
  const range = maxVal - minVal || 1;

  const numPoints = monthlyForecasts.length;
  const stepX = chartW / (numPoints - 1 || 1);

  const points = monthlyForecasts.map((m, idx) => {
    const x = padding.left + idx * stepX;
    const y = padding.top + chartH - ((m.cumulativeSavings - minVal) / range) * chartH;
    return { x, y, month: m.monthLabel, value: m.cumulativeSavings };
  });

  // Zero reference line
  const zeroY = padding.top + chartH - ((0 - minVal) / range) * chartH;

  // Build path strings
  let pathD = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const cp1x = prev.x + (curr.x - prev.x) / 2;
    const cp2x = cp1x;
    pathD += ` C ${cp1x} ${prev.y}, ${cp2x} ${curr.y}, ${curr.x} ${curr.y}`;
  }

  // Area Path
  const lastPt = points[points.length - 1];
  const firstPt = points[0];
  const areaD = `${pathD} L ${lastPt.x} ${zeroY} L ${firstPt.x} ${zeroY} Z`;

  let dotsSvg = '';
  points.forEach((pt) => {
    dotsSvg += `
      <circle cx="${pt.x}" y="${pt.y}" r="4" fill="#38bdf8" stroke="#0f172a" stroke-width="2">
        <title>${escapeSvg(pt.month)}: ${formatRupees(pt.value)}</title>
      </circle>
      <text x="${pt.x}" y="${pt.y - 10}" fill="#38bdf8" font-size="10" font-weight="700" text-anchor="middle">
        ${formatRupees(pt.value)}
      </text>
      <text x="${pt.x}" y="${height - padding.bottom + 18}" fill="#94a3b8" font-size="10" text-anchor="middle">
        ${escapeSvg(pt.month)}
      </text>
    `;
  });

  return `
    <svg viewBox="0 0 ${width} ${height}" class="finance-svg-chart" style="width: 100%; height: auto; display: block; overflow: visible;">
      <defs>
        <linearGradient id="savingsAreaGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#38bdf8" stop-opacity="0.35" />
          <stop offset="100%" stop-color="#38bdf8" stop-opacity="0.02" />
        </linearGradient>
      </defs>
      <!-- Zero Baseline -->
      <line x1="${padding.left}" y1="${zeroY}" x2="${width - padding.right}" y2="${zeroY}" stroke="rgba(255, 255, 255, 0.15)" stroke-dasharray="4,4" />
      <text x="${padding.left - 8}" y="${zeroY + 4}" fill="#64748b" font-size="10" text-anchor="end">₹0</text>
      
      <!-- Max Horizon Guideline -->
      <line x1="${padding.left}" y1="${padding.top}" x2="${width - padding.right}" y2="${padding.top}" stroke="rgba(255, 255, 255, 0.08)" />
      <text x="${padding.left - 8}" y="${padding.top + 4}" fill="#94a3b8" font-size="10" text-anchor="end">${formatRupees(maxVal)}</text>

      <!-- Shaded Area -->
      <path d="${areaD}" fill="url(#savingsAreaGradient)" />

      <!-- Curve Stroke -->
      <path d="${pathD}" fill="none" stroke="#38bdf8" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />

      <!-- Data Dots & Values -->
      ${dotsSvg}
    </svg>
  `;
}

/**
 * Generates an SVG Donut Chart for Expense Categories
 */
export function generateCategoryDonutSvg(categoryTotals = {}, size = 220) {
  const entries = Object.entries(categoryTotals).filter(([, val]) => val > 0);
  const total = entries.reduce((acc, [, val]) => acc + val, 0);

  if (total === 0 || entries.length === 0) {
    return `<svg viewBox="0 0 ${size} ${size}" class="finance-svg-chart"><text x="50%" y="50%" text-anchor="middle" fill="#64748b" font-size="12">No recurring expenses</text></svg>`;
  }

  const center = size / 2;
  const radius = size * 0.38;
  const strokeWidth = size * 0.18;

  const palette = [
    '#f43f5e', '#f59e0b', '#3b82f6', '#8b5cf6', '#ec4899',
    '#06b6d4', '#10b981', '#6366f1', '#eab308', '#64748b'
  ];

  let cumulativeAngle = -Math.PI / 2; // Start from 12 o'clock
  let slicesSvg = '';

  entries.forEach(([cat, amount], idx) => {
    const fraction = amount / total;
    const sliceAngle = fraction * 2 * Math.PI;
    const color = palette[idx % palette.length];

    const startAngle = cumulativeAngle;
    const endAngle = cumulativeAngle + sliceAngle;
    cumulativeAngle += sliceAngle;

    // SVG arc coordinates
    const x1 = center + radius * Math.cos(startAngle);
    const y1 = center + radius * Math.sin(startAngle);
    const x2 = center + radius * Math.cos(endAngle);
    const y2 = center + radius * Math.sin(endAngle);
    const largeArc = sliceAngle > Math.PI ? 1 : 0;

    const pathData = `M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`;

    slicesSvg += `
      <path d="${pathData}" fill="none" stroke="${color}" stroke-width="${strokeWidth}" stroke-linecap="butt">
        <title>${escapeSvg(cat)}: ${formatRupees(amount)} (${Math.round(fraction * 100)}%)</title>
      </path>
    `;
  });

  return `
    <svg viewBox="0 0 ${size} ${size}" class="finance-svg-chart" style="width: ${size}px; height: ${size}px; display: block; margin: 0 auto;">
      <g>
        ${slicesSvg}
      </g>
      <!-- Center Text -->
      <text x="${center}" y="${center - 4}" text-anchor="middle" fill="#94a3b8" font-size="10" font-weight="600">Total Need</text>
      <text x="${center}" y="${center + 14}" text-anchor="middle" fill="#f8fafc" font-size="13" font-weight="700">${formatRupees(total)}</text>
    </svg>
  `;
}
