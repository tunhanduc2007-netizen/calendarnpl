// ==============================================================================
// DASHBOARD & ANALYTICS MODULE (EQUITY CURVE, METRICS, ASSET BREAKDOWN)
// ==============================================================================

export class DashboardEngine {
  constructor(dataService) {
    this.dataService = dataService;
  }

  formatCurrency(num, showSign = true) {
    return this.dataService.formatCurrency(num, showSign);
  }

  render() {
    const container = document.getElementById('view-dashboard');
    if (!container) return;

    const trades = this.dataService.getTrades();
    const activeAccount = this.dataService.getActiveAccount();
    const initialBal = activeAccount ? activeAccount.initialBalance : 200000;

    // Sort trades chronologically
    const sortedTrades = [...trades].sort((a, b) => new Date(`${a.date}T${a.time || '00:00'}`) - new Date(`${b.date}T${b.time || '00:00'}`));

    // Calculations
    const totalTrades = sortedTrades.length;
    const winTrades = sortedTrades.filter(t => Number(t.pnl) > 0);
    const lossTrades = sortedTrades.filter(t => Number(t.pnl) < 0);
    
    const grossProfit = winTrades.reduce((s, t) => s + Number(t.pnl), 0);
    const grossLoss = Math.abs(lossTrades.reduce((s, t) => s + Number(t.pnl), 0));
    const netPnL = grossProfit - grossLoss;
    
    const winRate = totalTrades > 0 ? Math.round((winTrades.length / totalTrades) * 100) : 0;
    const profitFactor = grossLoss > 0 ? (grossProfit / grossLoss).toFixed(2) : (grossProfit > 0 ? '∞' : '0.00');
    
    const avgWin = winTrades.length > 0 ? grossProfit / winTrades.length : 0;
    const avgLoss = lossTrades.length > 0 ? grossLoss / lossTrades.length : 0;
    const winLossRatio = avgLoss > 0 ? (avgWin / avgLoss).toFixed(2) : '1.00';

    // Equity curve points
    let currentEquity = initialBal;
    let peakEquity = initialBal;
    let maxDrawdown = 0;
    const equityHistory = [{ date: 'Start', equity: initialBal, pnl: 0 }];

    sortedTrades.forEach(t => {
      currentEquity += Number(t.pnl || 0);
      if (currentEquity > peakEquity) {
        peakEquity = currentEquity;
      }
      const dd = peakEquity - currentEquity;
      if (dd > maxDrawdown) {
        maxDrawdown = dd;
      }
      equityHistory.push({
        date: t.date,
        equity: currentEquity,
        pnl: Number(t.pnl || 0)
      });
    });

    const maxDDPct = peakEquity > 0 ? ((maxDrawdown / peakEquity) * 100).toFixed(1) : '0.0';

    // Asset Breakdown
    const assetMap = {};
    sortedTrades.forEach(t => {
      const sym = t.symbol || 'OTHER';
      if (!assetMap[sym]) assetMap[sym] = { symbol: sym, count: 0, pnl: 0, wins: 0 };
      assetMap[sym].count++;
      assetMap[sym].pnl += Number(t.pnl || 0);
      if (Number(t.pnl) > 0) assetMap[sym].wins++;
    });
    const assetList = Object.values(assetMap).sort((a, b) => b.pnl - a.pnl);

    // Render Dashboard HTML
    container.innerHTML = `
      <div class="dashboard-content">
        <!-- TOP KPI CARDS -->
        <div class="kpi-grid">
          <div class="kpi-card">
            <div class="kpi-label">Tổng Lợi Nhuận Ròng (Net PnL)</div>
            <div class="kpi-value ${netPnL >= 0 ? 'text-profit' : 'text-loss'}">
              ${this.formatCurrency(netPnL)}
            </div>
            <div class="kpi-sub">${netPnL >= 0 ? '▲ Tăng trưởng' : '▼ Sụt giảm'} ${((netPnL / initialBal) * 100).toFixed(2)}% vốn ban đầu</div>
          </div>

          <div class="kpi-card">
            <div class="kpi-label">Tỷ Lệ Thắng (Win Rate)</div>
            <div class="kpi-value text-accent">${winRate}%</div>
            <div class="kpi-sub">${winTrades.length} Thắng / ${lossTrades.length} Thua (${totalTrades} lệnh)</div>
          </div>

          <div class="kpi-card">
            <div class="kpi-label">Hệ Số Lợi Nhuận (Profit Factor)</div>
            <div class="kpi-value ${Number(profitFactor) >= 1.5 ? 'text-profit' : 'text-neutral'}">${profitFactor}</div>
            <div class="kpi-sub">Lãi: ${this.formatCurrency(grossProfit, false)} / Lỗ: ${this.formatCurrency(grossLoss, false)}</div>
          </div>

          <div class="kpi-card">
            <div class="kpi-label">Sụt Giảm Lớn Nhất (Max Drawdown)</div>
            <div class="kpi-value text-loss">-${maxDDPct}%</div>
            <div class="kpi-sub">Mức DD tối đa: ${this.formatCurrency(maxDrawdown, false)}</div>
          </div>
        </div>

        <!-- CHARTS SECTION -->
        <div class="charts-row">
          <!-- EQUITY CURVE SVG CHART -->
          <div class="chart-card flex-2">
            <div class="chart-header">
              <div class="chart-title">📈 Đường Cong Vốn (Cumulative Equity Curve)</div>
              <div class="chart-legend">
                <span class="legend-dot profit-dot"></span> Tài khoản: $${currentEquity.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </div>
            </div>
            <div class="chart-canvas-box" id="equity-svg-container">
              ${this.generateEquitySVG(equityHistory)}
            </div>
          </div>

          <!-- WIN / LOSS DOUGHNUT -->
          <div class="chart-card flex-1">
            <div class="chart-header">
              <div class="chart-title">🎯 Tỷ Lệ Kèo Thắng / Thua</div>
            </div>
            <div class="doughnut-box">
              ${this.generateDoughnutSVG(winTrades.length, lossTrades.length)}
              <div class="win-loss-legend">
                <div class="legend-row">
                  <span class="dot-win"></span> Kèo Thắng: <strong>${winTrades.length}</strong> (${winRate}%)
                </div>
                <div class="legend-row">
                  <span class="dot-loss"></span> Kèo Thua: <strong>${lossTrades.length}</strong> (${100 - winRate}%)
                </div>
                <div class="legend-row mt-2">
                  <span>Trung bình Thắng:</span> <strong class="text-profit">${this.formatCurrency(avgWin)}</strong>
                </div>
                <div class="legend-row">
                  <span>Trung bình Thua:</span> <strong class="text-loss">-${this.formatCurrency(avgLoss, false)}</strong>
                </div>
                <div class="legend-row">
                  <span>Tỷ lệ Lãi/Lỗ (Win/Loss Ratio):</span> <strong>${winLossRatio}R</strong>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- ASSET PERFORMANCE TABLE -->
        <div class="table-card">
          <div class="chart-header">
            <div class="chart-title">🏆 Hiệu Suất Theo Sản Phẩm Giao Dịch (Asset Breakdown)</div>
          </div>
          <div class="table-responsive">
            <table class="pro-table">
              <thead>
                <tr>
                  <th>Sản Phẩm</th>
                  <th>Số Lệnh</th>
                  <th>Tỷ Lệ Thắng</th>
                  <th>Tổng Lãi / Lỗ</th>
                  <th>Đánh Giá</th>
                </tr>
              </thead>
              <tbody>
                ${assetList.map(item => {
                  const itemWR = item.count > 0 ? Math.round((item.wins / item.count) * 100) : 0;
                  const isProf = item.pnl > 0;
                  return `
                    <tr>
                      <td><span class="badge-symbol">${item.symbol}</span></td>
                      <td>${item.count} lệnh</td>
                      <td>
                        <div class="bar-progress-container">
                          <div class="bar-progress-fill" style="width: ${itemWR}%;"></div>
                          <span>${itemWR}%</span>
                        </div>
                      </td>
                      <td class="${isProf ? 'text-profit' : 'text-loss'} font-bold">
                        ${this.formatCurrency(item.pnl)}
                      </td>
                      <td>
                        ${itemWR >= 75 ? '<span class="status-pill status-hot">🔥 Chuyên môn cao</span>' : (itemWR >= 50 ? '<span class="status-pill status-neutral">Ổn định</span>' : '<span class="status-pill status-danger">Cần cải thiện</span>')}
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  }

  generateEquitySVG(data) {
    if (!data || data.length < 2) {
      return '<div class="empty-chart">Chưa có dữ liệu để vẽ đường cong vốn</div>';
    }

    const width = 680;
    const height = 240;
    const padding = { top: 20, right: 30, bottom: 30, left: 60 };

    const equities = data.map(d => d.equity);
    const minVal = Math.min(...equities) * 0.995;
    const maxVal = Math.max(...equities) * 1.005;

    const getX = (idx) => padding.left + (idx / (data.length - 1)) * (width - padding.left - padding.right);
    const getY = (val) => height - padding.bottom - ((val - minVal) / (maxVal - minVal)) * (height - padding.top - padding.bottom);

    const points = data.map((d, i) => `${getX(i).toFixed(1)},${getY(d.equity).toFixed(1)}`).join(' ');
    const firstX = getX(0).toFixed(1);
    const lastX = getX(data.length - 1).toFixed(1);
    const baseY = (height - padding.bottom).toFixed(1);
    const fillArea = `${firstX},${baseY} ${points} ${lastX},${baseY}`;

    return `
      <svg viewBox="0 0 ${width} ${height}" class="equity-svg" preserveAspectRatio="none">
        <defs>
          <linearGradient id="equityGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#10b981" stop-opacity="0.35" />
            <stop offset="100%" stop-color="#10b981" stop-opacity="0.0" />
          </linearGradient>
        </defs>

        <!-- Grid lines -->
        <line x1="${padding.left}" y1="${getY(minVal)}" x2="${width - padding.right}" y2="${getY(minVal)}" stroke="#1e293b" stroke-dasharray="3,3" />
        <line x1="${padding.left}" y1="${getY((minVal + maxVal) / 2)}" x2="${width - padding.right}" y2="${getY((minVal + maxVal) / 2)}" stroke="#1e293b" stroke-dasharray="3,3" />
        <line x1="${padding.left}" y1="${getY(maxVal)}" x2="${width - padding.right}" y2="${getY(maxVal)}" stroke="#1e293b" stroke-dasharray="3,3" />

        <!-- Gradient area -->
        <polygon points="${fillArea}" fill="url(#equityGrad)" />

        <!-- Main path -->
        <polyline points="${points}" fill="none" stroke="#10b981" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />

        <!-- Data points dots -->
        ${data.filter((_, i) => i === 0 || i === data.length - 1 || i % Math.max(1, Math.floor(data.length / 8)) === 0).map((d, idx) => {
          const i = data.indexOf(d);
          return `<circle cx="${getX(i)}" cy="${getY(d.equity)}" r="4" fill="#0f172a" stroke="#10b981" stroke-width="2" />`;
        }).join('')}
      </svg>
    `;
  }

  generateDoughnutSVG(wins, losses) {
    const total = wins + losses;
    if (total === 0) return '<div class="empty-chart">Chưa có lệnh</div>';

    const winAngle = (wins / total) * 360;
    const r = 45;
    const c = 2 * Math.PI * r;
    const winStroke = (wins / total) * c;
    const lossStroke = c - winStroke;

    return `
      <div class="doughnut-container">
        <svg viewBox="0 0 120 120" class="doughnut-svg">
          <circle cx="60" cy="60" r="${r}" fill="none" stroke="#1e293b" stroke-width="14" />
          <circle cx="60" cy="60" r="${r}" fill="none" stroke="#f43f5e" stroke-width="14" stroke-dasharray="${c}" stroke-dashoffset="0" transform="rotate(-90 60 60)" />
          <circle cx="60" cy="60" r="${r}" fill="none" stroke="#10b981" stroke-width="14" stroke-dasharray="${winStroke} ${c}" stroke-dashoffset="0" transform="rotate(-90 60 60)" />
        </svg>
        <div class="doughnut-center-text">
          <span class="pct">${Math.round((wins / total) * 100)}%</span>
          <span class="lbl">WIN</span>
        </div>
      </div>
    `;
  }
}
