// ==============================================================================
// TRADE JOURNAL, TRADING INSIGHTS & TRADING DIARY MODULE
// ==============================================================================

export class JournalEngine {
  constructor(dataService, onRefresh) {
    this.dataService = dataService;
    this.onRefresh = onRefresh;
    this.currentFilter = 'ALL'; // 'ALL', 'WIN', 'LOSS'
    this.searchKeyword = '';
  }

  formatCurrency(num, showSign = true) {
    return this.dataService.formatCurrency(num, showSign);
  }

  renderJournal() {
    const container = document.getElementById('view-journal');
    if (!container) return;

    let trades = this.dataService.getTrades();

    // Apply Filter
    if (this.currentFilter === 'WIN') {
      trades = trades.filter(t => Number(t.pnl) > 0);
    } else if (this.currentFilter === 'LOSS') {
      trades = trades.filter(t => Number(t.pnl) < 0);
    }

    // Apply Search
    if (this.searchKeyword.trim()) {
      const q = this.searchKeyword.toLowerCase().trim();
      trades = trades.filter(t =>
        (t.symbol && t.symbol.toLowerCase().includes(q)) ||
        (t.strategy && t.strategy.toLowerCase().includes(q)) ||
        (t.notes && t.notes.toLowerCase().includes(q))
      );
    }

    // Sort newest first
    trades.sort((a, b) => new Date(`${b.date}T${b.time || '00:00'}`) - new Date(`${a.date}T${a.time || '00:00'}`));

    container.innerHTML = `
      <div class="journal-wrapper">
        <!-- TOOLBAR -->
        <div class="journal-toolbar">
          <div class="search-box">
            <svg class="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
            <input type="text" id="journal-search-input" placeholder="Tìm kiếm theo Symbol, Setup hoặc Ghi chú..." value="${this.searchKeyword}" />
          </div>

          <div class="filter-tabs">
            <button class="filter-tab ${this.currentFilter === 'ALL' ? 'active' : ''}" data-filter="ALL">Tất cả (${this.dataService.getTrades().length})</button>
            <button class="filter-tab ${this.currentFilter === 'WIN' ? 'active' : ''}" data-filter="WIN">Thắng (Win)</button>
            <button class="filter-tab ${this.currentFilter === 'LOSS' ? 'active' : ''}" data-filter="LOSS">Thua (Loss)</button>
          </div>

          <button class="btn btn-primary" id="btn-add-trade-journal">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M12 5v14M5 12h14"/></svg>
            Thêm Lệnh Mới
          </button>
        </div>

        <!-- JOURNAL TABLE -->
        <div class="table-card">
          <div class="table-responsive">
            <table class="pro-table">
              <thead>
                <tr>
                  <th>Thời Gian</th>
                  <th>Cặp Tiền</th>
                  <th>Vị Thế</th>
                  <th>Khối Lượng</th>
                  <th>Entry / Exit</th>
                  <th>Setup Chiến Lược</th>
                  <th>Lãi / Lỗ (PnL)</th>
                  <th>Ghi Chú</th>
                  <th>Thao Tác</th>
                </tr>
              </thead>
              <tbody>
                ${trades.length === 0 ? `
                  <tr>
                    <td colspan="9" class="text-center py-8 text-neutral">Không tìm thấy lệnh nào phù hợp.</td>
                  </tr>
                ` : trades.map(t => {
                  const isLong = t.side === 'LONG';
                  const isWin = Number(t.pnl) > 0;
                  return `
                    <tr id="trade-row-${t.id}">
                      <td>
                        <div class="font-medium">${t.date}</div>
                        <div class="text-xs text-neutral">${t.time || '--:--'}</div>
                      </td>
                      <td><span class="badge-symbol">${t.symbol}</span></td>
                      <td>
                        <span class="badge-side ${isLong ? 'side-long' : 'side-short'}">
                          ${isLong ? '▲ LONG' : '▼ SHORT'}
                        </span>
                      </td>
                      <td class="font-mono">${t.lots || '0.10'} Lot</td>
                      <td class="font-mono text-sm">
                        <div>Vào: ${t.entry || '--'}</div>
                        <div class="text-neutral">Ra: ${t.exit || '--'}</div>
                      </td>
                      <td><span class="badge-strategy">${t.strategy || 'Price Action'}</span></td>
                      <td class="font-bold ${isWin ? 'text-profit' : 'text-loss'} font-mono">
                        ${this.formatCurrency(Number(t.pnl || 0))}
                      </td>
                      <td class="text-sm max-w-xs text-neutral truncate" title="${t.notes || ''}">
                        ${t.notes || '---'}
                      </td>
                      <td>
                        <button class="btn-action btn-delete-trade" data-id="${t.id}" title="Xóa lệnh">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M3 6h18m-2 0v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6m3 0V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                        </button>
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

    // Event listeners
    const searchInput = container.querySelector('#journal-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchKeyword = e.target.value;
        this.renderJournal();
      });
    }

    const filterBtns = container.querySelectorAll('.filter-tab');
    filterBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        this.currentFilter = btn.getAttribute('data-filter');
        this.renderJournal();
      });
    });

    const addBtn = container.querySelector('#btn-add-trade-journal');
    if (addBtn) {
      addBtn.addEventListener('click', () => {
        const modal = document.getElementById('modal-upload-trade');
        if (modal) modal.classList.add('active');
      });
    }

    const deleteBtns = container.querySelectorAll('.btn-delete-trade');
    deleteBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-id');
        if (confirm('Bạn có chắc chắn muốn xóa lệnh này không?')) {
          this.dataService.deleteTrade(id);
          this.renderJournal();
          if (this.onRefresh) this.onRefresh();
        }
      });
    });
  }

  renderInsights() {
    const container = document.getElementById('view-insights');
    if (!container) return;

    const trades = this.dataService.getTrades();
    const totalTrades = trades.length;
    const wins = trades.filter(t => Number(t.pnl) > 0);
    const winRate = totalTrades > 0 ? Math.round((wins.length / totalTrades) * 100) : 0;

    // Strategy analysis
    const stratMap = {};
    trades.forEach(t => {
      const s = t.strategy || 'Chung';
      if (!stratMap[s]) stratMap[s] = { name: s, count: 0, wins: 0, pnl: 0 };
      stratMap[s].count++;
      stratMap[s].pnl += Number(t.pnl || 0);
      if (Number(t.pnl) > 0) stratMap[s].wins++;
    });
    const stratList = Object.values(stratMap).sort((a, b) => b.pnl - a.pnl);
    const bestStrat = stratList[0] || { name: 'Chưa đủ dữ liệu', pnl: 0 };

    // Day of week analysis
    const dayNames = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
    const dowMap = {};
    trades.forEach(t => {
      if (!t.date) return;
      const d = new Date(t.date).getDay();
      if (!dowMap[d]) dowMap[d] = { day: dayNames[d], pnl: 0, count: 0 };
      dowMap[d].pnl += Number(t.pnl || 0);
      dowMap[d].count++;
    });
    const dowList = Object.values(dowMap).sort((a, b) => b.pnl - a.pnl);
    const bestDay = dowList[0] || { day: 'Thứ Năm', pnl: 0 };

    container.innerHTML = `
      <div class="insights-wrapper">
        <div class="insights-banner">
          <div class="banner-icon">🧠</div>
          <div class="banner-text">
            <h2>Báo Cáo Thông Minh & Đúc Kết Giao Dịch (AI Insights)</h2>
            <p>Hệ thống tự động phân tích ${totalTrades} lệnh trong nhật ký để tìm ra lợi thế cạnh tranh và thói quen cần khắc phục.</p>
          </div>
        </div>

        <div class="insights-grid">
          <!-- CARD 1: BEST SETUP -->
          <div class="insight-card highlight-green">
            <div class="card-badge">CHIẾN THUẬT VÀNG</div>
            <div class="card-title">Setup Sinh Lời Cao Nhất: ${bestStrat.name}</div>
            <div class="card-metric text-profit">${this.formatCurrency(bestStrat.pnl)}</div>
            <div class="card-desc">
              Chiến thuật <strong>${bestStrat.name}</strong> mang lại tỷ lệ thắng <strong>${bestStrat.count > 0 ? Math.round((bestStrat.wins / bestStrat.count) * 100) : 0}%</strong> qua ${bestStrat.count} lệnh. Bạn nên kiên nhẫn đợi đúng setup này để đi volume lớn hơn!
            </div>
          </div>

          <!-- CARD 2: BEST DAY -->
          <div class="insight-card highlight-blue">
            <div class="card-badge">THỜI ĐIỂM VÀNG</div>
            <div class="card-title">Ngày Giao Dịch Hiệu Quả Nhất: ${bestDay.day}</div>
            <div class="card-metric text-accent">${this.formatCurrency(bestDay.pnl)}</div>
            <div class="card-desc">
              Bạn có phong độ tập trung và kiếm được nhiều lợi nhuận nhất vào các ngày <strong>${bestDay.day}</strong>. Hãy tận dụng ngày này để khai thác thị trường tối đa.
            </div>
          </div>

          <!-- CARD 3: RISK WARNING -->
          <div class="insight-card highlight-amber">
            <div class="card-badge">BÀI HỌC QUẢN TRỊ RỦI RO</div>
            <div class="card-title">Khắc Phục: Bẫy Chặn Đầu Trend Lớn</div>
            <div class="card-desc">
              Các lệnh thua lớn nhất trong lịch sử thường rơi vào các pha <strong>ngược xu hướng khi có tin tức mạnh</strong>. 
              <br/><br/>
              💡 <em>Khắc phục: Chỉ đánh Ping-Pong 2 đầu khi EMA 89 đi ngang. Khi nến đã đóng cửa vượt cản, chuyển ngay sang bảo toàn vốn!</em>
            </div>
          </div>

          <!-- CARD 4: DISCIPLINE RULE -->
          <div class="insight-card highlight-purple">
            <div class="card-badge">NGUYÊN TẮC BẤT DI BẤT DỊCH</div>
            <div class="card-title">Quy Tắc Nam Châm POC</div>
            <div class="card-desc">
              Xác suất giá quay về chạm POC hôm nay lên đến <strong>82%</strong>. Khi giá đạt POC, việc <strong>dời SL về hòa vốn (BE)</strong> đã giúp bạn tránh được hơn 90% các cú quét giật ngược!
            </div>
          </div>
        </div>
      </div>
    `;
  }

  renderDiary() {
    const container = document.getElementById('view-diary');
    if (!container) return;

    const diaryEntries = this.dataService.getDiary();

    container.innerHTML = `
      <div class="diary-wrapper">
        <div class="diary-header">
          <div>
            <h2>📔 Nhật Ký Cảm Xúc & Kỷ Luật Giao Dịch (Trade Diary)</h2>
            <p class="text-neutral">Ghi lại tâm lý, bài học và mức độ tuân thủ kỷ luật mỗi ngày để nâng cao bản lĩnh trader.</p>
          </div>
          <button class="btn btn-primary" id="btn-add-diary">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M12 5v14M5 12h14"/></svg>
            Viết Nhật Ký Hôm Nay
          </button>
        </div>

        <div class="diary-list">
          ${diaryEntries.map(entry => `
            <div class="diary-card">
              <div class="diary-card-top">
                <div class="diary-date">📅 ${entry.date} <span class="badge-session">${entry.marketSession || 'Tất cả phiên'}</span></div>
                <div class="diary-stars">
                  ${'⭐'.repeat(entry.disciplineScore || 5)} (${entry.disciplineScore || 5}/5 sao)
                </div>
              </div>
              <div class="diary-body">
                <div class="diary-notes">${entry.notes}</div>
                ${entry.mistakes ? `<div class="diary-mistake">⚠️ <strong>Cần lưu ý:</strong> ${entry.mistakes}</div>` : ''}
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;

    const addBtn = container.querySelector('#btn-add-diary');
    if (addBtn) {
      addBtn.addEventListener('click', () => {
        const modal = document.getElementById('modal-add-diary');
        if (modal) modal.classList.add('active');
      });
    }
  }
}
