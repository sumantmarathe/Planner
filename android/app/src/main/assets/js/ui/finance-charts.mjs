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
 * Formats a month label into a compact form e.g. "Nov '26"
 */
function formatShortMonth(monthKey, monthLabel) {
  if (!monthKey && !monthLabel) return '';
  if (monthLabel) {
    const parts = monthLabel.trim().split(/\s+/);
    if (parts.length >= 2) {
      const monthPart = parts[0].slice(0, 3);
      const yearPart = parts[1].slice(-2);
      return `${monthPart} '${yearPart}`;
    }
  }
  if (monthKey && monthKey.includes('-')) {
    const [y, m] = monthKey.split('-');
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const mIdx = parseInt(m, 10) - 1;
    return `${monthNames[mIdx] || m} '${y.slice(-2)}`;
  }
  return monthLabel;
}

/**
 * Generates an SVG Dual-Bar Chart comparing Monthly Income vs. Money Needed (Expenses)
 */
export function generateCashFlowBarChartSvg(monthlyForecasts = [], baseWidth = 720, height = 290) {
  if (!monthlyForecasts || monthlyForecasts.length === 0) {
    return `<svg viewBox="0 0 ${baseWidth} ${height}" class="finance-svg-chart empty"><text x="50%" y="50%" text-anchor="middle" fill="#64748b" font-size="14">No financial projections available</text></svg>`;
  }

  const numMonths = monthlyForecasts.length;
  // If many months (e.g. 12 or 24), guarantee minimum width per month column for clean layout
  const minColWidth = numMonths > 12 ? 46 : (numMonths > 6 ? 54 : 64);
  const leftPad = 75;
  const rightPad = 25;
  const totalNeededW = leftPad + rightPad + numMonths * minColWidth;
  const width = Math.max(baseWidth, totalNeededW);

  const isRotated = numMonths > 6;
  const padding = {
    top: 35,
    right: rightPad,
    bottom: isRotated ? 65 : 45,
    left: leftPad
  };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  let maxVal = Math.max(...monthlyForecasts.map(m => Math.max(m.totalIncome, m.totalExpense)), 10000);
  const magnitude = Math.pow(10, Math.floor(Math.log10(maxVal)));
  maxVal = Math.ceil(maxVal / magnitude) * magnitude;

  const colWidth = chartW / numMonths;
  const barWidth = Math.max(6, Math.min(22, (colWidth - 8) / 2));
  const barGap = Math.max(2, Math.min(4, barWidth * 0.25));

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

    const shortLabel = formatShortMonth(m.monthKey, m.monthLabel);
    const fullLabel = m.monthLabel;
    const displayLabel = isRotated ? shortLabel : fullLabel;

    const tooltip = `${fullLabel}
Total Inflow: ${formatRupees(m.totalIncome)}
Money Needed: ${formatRupees(m.totalExpense)}
Net Cash Flow: ${m.netSavings >= 0 ? '+' : ''}${formatRupees(m.netSavings)} (${m.savingsRate}% savings rate)`;

    barsSvg += `
      <!-- Month Group -->
      <g class="chart-month-col" data-month="${escapeSvg(m.monthKey)}">
        <title>${escapeSvg(tooltip)}</title>

        <!-- Subtle full-column hover backdrop -->
        <rect x="${centerX - colWidth / 2}" y="${padding.top}" width="${colWidth}" height="${chartH}" fill="transparent" class="col-hover-rect" />

        <!-- Income Bar -->
        <rect x="${incomeX}" y="${incomeY}" width="${barWidth}" height="${incomeH}" rx="3" fill="#10b981" opacity="0.95" />

        <!-- Expense (Money Needed) Bar -->
        <rect x="${expenseX}" y="${expenseY}" width="${barWidth}" height="${expenseH}" rx="3" fill="#f43f5e" opacity="0.95" />

        <!-- X Axis Label -->
        ${isRotated ? `
          <text x="${centerX}" y="${height - padding.bottom + 15}"
                fill="#cbd5e1" font-size="10" font-weight="600"
                text-anchor="end"
                transform="rotate(-40 ${centerX} ${height - padding.bottom + 15})">
            ${escapeSvg(displayLabel)}
          </text>
        ` : `
          <text x="${centerX}" y="${height - padding.bottom + 18}"
                fill="#cbd5e1" font-size="11" font-weight="600"
                text-anchor="middle">
            ${escapeSvg(displayLabel)}
          </text>
          <!-- Net Savings Sub-label (rendered when unrotated & spacious) -->
          <text x="${centerX}" y="${height - padding.bottom + 32}"
                fill="${m.netSavings >= 0 ? '#34d399' : '#f43f5e'}"
                font-size="9" font-weight="700" text-anchor="middle">
            ${m.netSavings >= 0 ? '+' : ''}${formatRupees(m.netSavings)}
          </text>
        `}
      </g>
    `;
  });

  return `
    <svg viewBox="0 0 ${width} ${height}" class="finance-svg-chart" style="min-width: 100%; width: ${width > baseWidth ? `${width}px` : '100%'}; height: ${height}px; display: block;">
      <defs>
        <style>
          .col-hover-rect:hover { fill: rgba(255, 255, 255, 0.04); }
          .chart-month-col:hover rect:not(.col-hover-rect) { filter: brightness(1.2); }
          .chart-month-col:hover text { fill: #ffffff; font-weight: 700; }
        </style>
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
export function generateSavingsTrajectorySvg(monthlyForecasts = [], baseWidth = 520, height = 250) {
  if (!monthlyForecasts || monthlyForecasts.length === 0) {
    return `<svg viewBox="0 0 ${baseWidth} ${height}" class="finance-svg-chart empty"><text x="50%" y="50%" text-anchor="middle" fill="#64748b" font-size="14">No savings projection available</text></svg>`;
  }

  const numPoints = monthlyForecasts.length;
  const isDense = numPoints > 6;
  const minStepX = isDense ? 42 : 55;
  const leftPad = 75;
  const rightPad = 35;
  const totalNeededW = leftPad + rightPad + numPoints * minStepX;
  const width = Math.max(baseWidth, totalNeededW);

  const padding = {
    top: 30,
    right: rightPad,
    bottom: isDense ? 55 : 40,
    left: leftPad
  };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  const values = monthlyForecasts.map(m => m.cumulativeSavings);
  const minVal = Math.min(0, ...values);
  const maxVal = Math.max(10000, ...values);
  const range = maxVal - minVal || 1;

  const stepX = chartW / (numPoints - 1 || 1);

  const points = monthlyForecasts.map((m, idx) => {
    const x = padding.left + idx * stepX;
    const y = padding.top + chartH - ((m.cumulativeSavings - minVal) / range) * chartH;
    return { x, y, month: m.monthLabel, monthKey: m.monthKey, value: m.cumulativeSavings };
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

  // Milestone stride to avoid label collisions
  const labelStride = numPoints > 14 ? 4 : (numPoints > 8 ? 2 : 1);

  let dotsSvg = '';
  points.forEach((pt, idx) => {
    const isFirst = idx === 0;
    const isLast = idx === points.length - 1;
    const isMilestone = isFirst || isLast || (idx % labelStride === 0);
    const shortMonth = formatShortMonth(pt.monthKey, pt.month);

    dotsSvg += `
      <g class="trajectory-point" tabindex="0">
        <title>${escapeSvg(pt.month)}: ${formatRupees(pt.value)}</title>
        <circle cx="${pt.x}" y="${pt.y}" r="${isMilestone ? 4 : 2.5}" fill="#38bdf8" stroke="#0f172a" stroke-width="2" />
        ${isMilestone ? `
          <text x="${pt.x}" y="${pt.y - 10}" fill="#38bdf8" font-size="9" font-weight="700" text-anchor="middle">
            ${formatRupees(pt.value)}
          </text>
        ` : ''}
        ${(isMilestone || !isDense) ? `
          <text x="${pt.x}" y="${height - padding.bottom + (isDense ? 15 : 18)}"
                fill="#94a3b8" font-size="10"
                text-anchor="${isDense ? 'end' : 'middle'}"
                ${isDense ? `transform="rotate(-40 ${pt.x} ${height - padding.bottom + 15})"` : ''}>
            ${escapeSvg(isDense ? shortMonth : pt.month)}
          </text>
        ` : ''}
      </g>
    `;
  });

  return `
    <svg viewBox="0 0 ${width} ${height}" class="finance-svg-chart" style="min-width: 100%; width: ${width > baseWidth ? `${width}px` : '100%'}; height: ${height}px; display: block;">
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

      <!-- Data Dots & Milestone Labels -->
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

