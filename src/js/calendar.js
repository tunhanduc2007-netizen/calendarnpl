// ==============================================================================
// CALENDAR VIEW ENGINE (INTERACTIVE HEATMAP, WEEKLY SUMMARY, MONTHLY METRICS)
// ==============================================================================

export class CalendarEngine {
  constructor(dataService, onDayClick) {
    this.dataService = dataService;
    this.onDayClick = onDayClick;
    const now = new Date();
    this.currentYear = now.getFullYear();
    this.currentMonth = now.getMonth();
  }

  setMonth(year, monthIndex) {
    this.currentYear = year;
    this.currentMonth = monthIndex;
    this.render();
  }

  prevMonth() {
    this.currentMonth--;
    if (this.currentMonth < 0) {
      this.currentMonth = 11;
      this.currentYear--;
    }
    this.render();
  }

  nextMonth() {
    this.currentMonth++;
    if (this.currentMonth > 11) {
      this.currentMonth = 0;
      this.currentYear++;
    }
    this.render();
  }

  formatCurrency(num, showSign = true) {
    return this.dataService.formatCurrency(num, showSign);
  }

  getMonthName(monthIndex) {
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    return months[monthIndex];
  }

  render() {
    const container = document.getElementById('calendar-container');
    if (!container) return;

    const trades = this.dataService.getTrades();
    const activeAccount = this.dataService.getActiveAccount();
    const baseCapital = activeAccount ? (activeAccount.initialBalance * 0.25 || 50000) : 50000;

    // Filter trades for current year & month
    const targetMonthStr = String(this.currentMonth + 1).padStart(2, '0');
    const targetPrefix = `${this.currentYear}-${targetMonthStr}`;
    const monthTrades = trades.filter(t => t.date && t.date.startsWith(targetPrefix));

    // Map daily trades
    const firstDayIndex = new Date(this.currentYear, this.currentMonth, 1).getDay(); // 0 is SUN
    const daysInMonth = new Date(this.currentYear, this.currentMonth + 1, 0).getDate();
    const prevMonthDays = new Date(this.currentYear, this.currentMonth, 0).getDate();

    const dailyMap = {};
    let winDaysCount = 0;
    let lossDaysCount = 0;
    let totalMonthPnL = 0;

    for (let d = 1; d <= daysInMonth; d++) {
      const dayStr = `${targetPrefix}-${String(d).padStart(2, '0')}`;
      const dayTrades = monthTrades.filter(t => t.date === dayStr);
      const dayPnL = dayTrades.reduce((s, t) => s + Number(t.pnl || 0), 0);
      const dayPct = baseCapital > 0 ? ((dayPnL / baseCapital) * 100).toFixed(1) : '0.0';
      
      if (dayTrades.length > 0) {
        totalMonthPnL += dayPnL;
        if (dayPnL > 0) winDaysCount++;
        else if (dayPnL < 0) lossDaysCount++;
      }

      dailyMap[d] = {
        dateStr: dayStr,
        dayNumber: d,
        trades: dayTrades,
        tradeCount: dayTrades.length,
        pnl: dayPnL,
        pct: dayPct
      };
    }

    const totalActiveDays = winDaysCount + lossDaysCount;
    const monthWinRate = totalActiveDays > 0 ? Math.round((winDaysCount / totalActiveDays) * 100) : 0;
    const monthPnLPct = baseCapital > 0 ? ((totalMonthPnL / baseCapital) * 100).toFixed(1) : '0.0';

    // Update Header Controls & Metrics
    this.updateMonthlyHeader({
      pnl: totalMonthPnL,
      pnlPct: monthPnLPct,
      trades: totalActiveDays,
      winRate: monthWinRate,
      winDays: winDaysCount,
      lossDays: lossDaysCount
    });

    // Build weeks
    const weeks = [];
    let currentWeek = [];
    
    // Fill leading days from previous month
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      currentWeek.push({ isCurrentMonth: false, dayNumber: prevMonthDays - i });
    }

    // Fill days of current month
    for (let d = 1; d <= daysInMonth; d++) {
      currentWeek.push({ isCurrentMonth: true, ...dailyMap[d] });
      if (currentWeek.length === 7) {
        weeks.push(currentWeek);
        currentWeek = [];
      }
    }

    // Fill trailing days for next month
    if (currentWeek.length > 0) {
      let nextMonthDay = 1;
      while (currentWeek.length < 7) {
        currentWeek.push({ isCurrentMonth: false, dayNumber: nextMonthDay++ });
      }
      weeks.push(currentWeek);
    }

    const todayStr = new Date().toISOString().split('T')[0];

    // Render HTML
    container.innerHTML = `
      <div class="calendar-wrapper">
        <!-- LEFT: WEEKLY SUMMARY -->
        <div class="weekly-summary-col">
          <div class="weekly-col-header">TỔNG KẾT TUẦN</div>
          <div class="weekly-cards-list">
            ${weeks.map((week, idx) => {
              const weekDaysWithTrades = week.filter(d => d.isCurrentMonth && d.tradeCount > 0);
              const weekPnL = weekDaysWithTrades.reduce((sum, d) => sum + d.pnl, 0);
              const weekDaysCount = weekDaysWithTrades.length;
              const isProfit = weekPnL > 0;
              const isLoss = weekPnL < 0;
              const colorClass = isProfit ? 'text-profit' : (isLoss ? 'text-loss' : 'text-neutral');

              return `
                <div class="weekly-card ${isProfit ? 'weekly-win' : (isLoss ? 'weekly-loss' : '')}">
                  <div class="weekly-title">Tuần ${idx + 1}</div>
                  <div class="weekly-amount ${colorClass}">${this.formatCurrency(weekPnL)}</div>
                  <div class="weekly-subtext">${weekDaysCount > 0 ? `${weekDaysCount} ngày giao dịch` : 'Chưa có lệnh'}</div>
                </div>
              `;
            }).join('')}
          </div>
        </div>

        <!-- RIGHT: 7-DAY CALENDAR GRID -->
        <div class="calendar-main-col">
          <div class="calendar-days-header">
            <div>CN</div>
            <div>T2</div>
            <div>T3</div>
            <div>T4</div>
            <div>T5</div>
            <div>T6</div>
            <div>T7</div>
          </div>
          <div class="calendar-grid">
            ${weeks.map(week => week.map(cell => {
              if (!cell.isCurrentMonth) {
                return `
                  <div class="cal-cell outside-month">
                    <div class="cal-diagonal-stripes"></div>
                  </div>
                `;
              }

              const hasTrades = cell.tradeCount > 0;
              const isWin = hasTrades && cell.pnl > 0;
              const isLoss = hasTrades && cell.pnl < 0;
              const isToday = cell.dateStr === todayStr;
              const cellClass = isWin ? 'cell-profit glow-profit' : (isLoss ? 'cell-loss glow-loss' : 'cell-empty');
              const notePreview = (hasTrades && cell.trades[0]?.notes) ? cell.trades[0].notes : (isWin ? 'Lãi đẹp 🟢' : 'Thua lỗ 🔴');

              return `
                <div class="cal-cell ${cellClass} ${isToday ? 'cal-cell-today' : ''}" data-date="${cell.dateStr}" id="day-cell-${cell.dayNumber}">
                  <div class="cal-cell-top">
                    <span class="cal-day-num">${cell.dayNumber}</span>
                    ${isToday ? '<span class="today-pill">HÔM NAY</span>' : ''}
                  </div>

                  ${hasTrades ? `
                    <div class="cal-cell-center">
                      <div class="cal-day-pnl ${isWin ? 'text-profit' : 'text-loss'}">
                        ${this.formatCurrency(cell.pnl)}
                      </div>
                      <div class="cal-day-pill ${isWin ? 'pill-profit' : 'pill-loss'}" title="${notePreview}">
                        ${notePreview}
                      </div>
                    </div>
                  ` : `
                    <div class="cal-cell-empty-hover">
                      <span class="empty-plus-icon">+</span>
                      <span class="empty-add-text">Ghi PnL</span>
                    </div>
                  `}
                </div>
              `;
            }).join('')).join('')}
          </div>
        </div>
      </div>
    `;

    // Attach click listeners to all valid calendar cells
    const dayCells = container.querySelectorAll('.cal-cell:not(.outside-month)');
    dayCells.forEach(cell => {
      cell.addEventListener('click', () => {
        const dateStr = cell.getAttribute('data-date');
        const dayData = Object.values(dailyMap).find(d => d.dateStr === dateStr);
        if (this.onDayClick) {
          this.onDayClick(dateStr, dayData || { dateStr, trades: [], pnl: 0 });
        }
      });
    });
  }

  updateMonthlyHeader({ pnl, pnlPct, trades, winRate, winDays, lossDays }) {
    const pnlEl = document.getElementById('stat-month-pnl');
    const pnlPctEl = document.getElementById('stat-month-pct');
    const tradesEl = document.getElementById('stat-month-trades');
    const winRateEl = document.getElementById('stat-month-winrate');
    const winDaysEl = document.getElementById('stat-win-days');
    const lossDaysEl = document.getElementById('stat-loss-days');
    const winrateBarEl = document.getElementById('monthly-winrate-bar');
    const monthTagEl = document.getElementById('summary-month-tag');
    const monthSelectEl = document.getElementById('select-month');
    const yearSelectEl = document.getElementById('select-year');

    if (pnlEl) {
      const isNeg = pnl < 0;
      pnlEl.textContent = this.formatCurrency(pnl, true);
      pnlEl.className = `metric-value ${isNeg ? 'text-loss glow-loss-text' : (pnl > 0 ? 'text-profit glow-profit-text' : 'text-neutral')}`;
    }
    if (pnlPctEl) {
      const numPct = Number(pnlPct);
      pnlPctEl.textContent = `${numPct > 0 ? '+' : ''}${pnlPct}%`;
      pnlPctEl.className = `metric-value ${numPct < 0 ? 'text-loss' : (numPct > 0 ? 'text-profit' : 'text-neutral')}`;
    }
    if (tradesEl) tradesEl.textContent = `${trades} ngày`;
    if (winRateEl) winRateEl.textContent = `${winRate}%`;
    if (winDaysEl) winDaysEl.textContent = `${winDays || 0} Thắng`;
    if (lossDaysEl) lossDaysEl.textContent = `${lossDays || 0} Thua`;
    
    if (winrateBarEl) {
      winrateBarEl.style.width = `${winRate}%`;
    }

    if (monthTagEl) {
      monthTagEl.textContent = `Tháng ${this.currentMonth + 1} / ${this.currentYear}`;
    }

    if (monthSelectEl) monthSelectEl.value = this.currentMonth;
    if (yearSelectEl) yearSelectEl.value = this.currentYear;
  }
}
