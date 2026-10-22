// ==============================================================================
// TNDUCK PNL - TRADING ARENA, TARGET & RANK PROGRESSION ENGINE
// ==============================================================================

const ARENA_STORAGE_KEY = 'tnduck_arena_settings_v2';

export class ArenaEngine {
  constructor(dataService) {
    this.dataService = dataService;
    this.slPoints = 5.0; // Auto SL cố định 5 giá Vàng (50 pips) theo yêu cầu
    this.settings = this.loadSettings();
  }

  loadSettings() {
    try {
      const activeAccount = this.dataService.getActiveAccount();
      const accountCap = activeAccount && (activeAccount.initialBalance || activeAccount.currentBalance)
        ? Number(activeAccount.initialBalance || activeAccount.currentBalance)
        : 100;
      
      const saved = localStorage.getItem(ARENA_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        // If the user changed the account initialBalance in Account Settings, prioritize activeAccount capital
        if (activeAccount && activeAccount.initialBalance && Number(activeAccount.initialBalance) !== Number(parsed.capital)) {
          parsed.capital = Number(activeAccount.initialBalance);
        }
        if (!parsed.capital || parsed.capital <= 0) parsed.capital = accountCap;
        if (!parsed.riskPct) parsed.riskPct = 1.0;
        parsed.slPoints = 5.0; // Luôn đảm bảo SL 5 giá
        return parsed;
      }

      return {
        capital: accountCap,
        riskPct: 1.0,
        slPoints: 5.0,
        unlockedBadges: ['badge_novice']
      };
    } catch (e) {
      console.error('Error loading Arena settings:', e);
      return {
        capital: 100,
        riskPct: 1.0,
        slPoints: 5.0,
        unlockedBadges: ['badge_novice']
      };
    }
  }

  saveSettings(newSettings) {
    this.settings = { ...this.settings, ...newSettings, slPoints: 5.0 };
    localStorage.setItem(ARENA_STORAGE_KEY, JSON.stringify(this.settings));

    // Also sync back to active account if capital was modified in Arena
    if (newSettings.capital) {
      const activeAccount = this.dataService.getActiveAccount();
      if (activeAccount && Number(activeAccount.initialBalance) !== Number(newSettings.capital)) {
        this.dataService.updateAccount(activeAccount.id, {
          initialBalance: Number(newSettings.capital),
          currentBalance: Number(newSettings.capital) + Number(activeAccount.activeGain || 0)
        });
      }
    }
  }

  // ==================== CÔNG THỨC TOÁN HỌC & RỦI RO ====================
  getMetrics() {
    const activeAccount = this.dataService.getActiveAccount();
    let capital = Number(this.settings.capital) || 100;
    if (activeAccount && activeAccount.initialBalance && Number(activeAccount.initialBalance) !== Number(this.settings.capital)) {
      capital = Number(activeAccount.initialBalance);
      this.settings.capital = capital;
      this.saveSettings({ capital });
    }
    const riskPct = Number(this.settings.riskPct) || 1.0;
    const slPts = 5.0; // 5 giá Vàng

    // Tiền rủi ro cho 1R (1% hoặc 2% vốn)
    const risk1R = capital * (riskPct / 100);

    // Tiền lỗ trên 1.0 lot Vàng khi chạm 5 giá SL (1 giá = $100 trên 1 lot -> 5 giá = $500)
    const dollarLossPerLot = slPts * 100; // $500

    // Khối lượng lot cơ bản
    let rawLot = risk1R / dollarLossPerLot;
    let baseLot = Math.max(0.01, Math.round(rawLot * 100) / 100);

    // Tính toán Streak hiện tại từ lịch sử giao dịch
    const trades = this.dataService.getTrades();
    const sortedTrades = [...trades].sort((a, b) => new Date(`${a.date}T${a.time || '00:00'}`) - new Date(`${b.date}T${b.time || '00:00'}`));
    
    let currentStreak = 0;
    for (let i = sortedTrades.length - 1; i >= 0; i--) {
      const pnl = Number(sortedTrades[i].pnl || 0);
      if (pnl > 0) {
        currentStreak++;
      } else if (pnl < 0) {
        break; // Dính lệnh thua là reset chuỗi ngay lập tức
      }
    }

    // Streak Multiplier: Tăng lot an toàn khi thắng liên tục
    let streakMultiplier = 1.0;
    let streakBadge = 'Khởi Điểm (x1.0)';
    if (currentStreak >= 4) {
      streakMultiplier = 2.0;
      streakBadge = '⚡ Thần Sầu (x2.0)';
    } else if (currentStreak === 3) {
      streakMultiplier = 1.5;
      streakBadge = '🔥 Cấp Bứt Phá (x1.5)';
    } else if (currentStreak === 2) {
      streakMultiplier = 1.25;
      streakBadge = '✨ Gối Đầu Lãi (x1.25)';
    }

    // Lot khuyến nghị thực chiến
    let dynamicLot = Math.max(0.01, Math.round((baseLot * streakMultiplier) * 100) / 100);

    // Mục tiêu ngày
    const target1R = risk1R; // Ăn 5 giá
    const target2R = risk1R * 2; // Ăn 10 giá (Mục tiêu chuẩn)
    const target3R = risk1R * 3; // Ăn 15 giá (Ngày hoàn hảo)
    const maxDailyLoss = -risk1R * 2; // Thua 10 giá (Thua 2 lệnh = Dừng ngay)

    // Tính PnL hôm nay
    const todayStr = new Date().toISOString().split('T')[0];
    const todayTrades = sortedTrades.filter(t => t.date === todayStr);
    const todayPnL = todayTrades.reduce((sum, t) => sum + Number(t.pnl || 0), 0);
    const todayWinCount = todayTrades.filter(t => Number(t.pnl || 0) > 0).length;
    const todayLossCount = todayTrades.filter(t => Number(t.pnl || 0) < 0).length;
    const todayR = risk1R > 0 ? (todayPnL / risk1R) : 0;

    // Trạng thái ngày
    let status = 'NEUTRAL';
    let statusText = '⚪ Sẵn Sàng Vào Lệnh';
    let statusClass = 'status-neutral';

    if (todayPnL <= maxDailyLoss) {
      status = 'LOCKOUT';
      statusText = '🛑 ĐÃ CHẠM GIỚI HẠN THUA (-2R) • ĐÓNG MÁY ĐI NGỦ!';
      statusClass = 'status-lockout';
    } else if (todayPnL >= target3R) {
      status = 'PERFECT';
      statusText = '👑 NGÀY HOÀN HẢO (+3R) • KHÓA LÃI NGHỈ NGƠI!';
      statusClass = 'status-perfect';
    } else if (todayPnL >= target2R) {
      status = 'ACHIEVED';
      statusText = '🌟 ĐẠT MỤC TIÊU NGÀY (+2R) • BẢO TOÀN THÀNH QUẢ!';
      statusClass = 'status-achieved';
    } else if (todayPnL >= target1R) {
      status = 'WARMUP';
      statusText = '🟢 ĐẠT CHẶNG 1 (+1R) • DỜI SL VỀ HÒA VỐN';
      statusClass = 'status-warmup';
    } else if (todayPnL < 0) {
      status = 'DRAWDOWN';
      statusText = '⚠️ ĐANG ÂM NHẸ • TUYỆT ĐỐI KHÔNG TRẢ THÙ!';
      statusClass = 'status-drawdown';
    }

    // Tính điểm Rank & EXP
    const rankInfo = this.calculateRank(sortedTrades, todayTrades);

    return {
      capital,
      riskPct,
      slPts,
      risk1R,
      baseLot,
      dynamicLot,
      currentStreak,
      streakMultiplier,
      streakBadge,
      target1R,
      target2R,
      target3R,
      maxDailyLoss,
      todayPnL,
      todayR,
      todayTradesCount: todayTrades.length,
      todayWinCount,
      todayLossCount,
      status,
      statusText,
      statusClass,
      rankInfo
    };
  }

  // ==================== HỆ THỐNG XẾP HẠNG RANK ====================
  calculateRank(allTrades, todayTrades) {
    // Nhóm trades theo ngày
    const dayMap = {};
    allTrades.forEach(t => {
      if (!dayMap[t.date]) dayMap[t.date] = 0;
      dayMap[t.date] += Number(t.pnl || 0);
    });

    const days = Object.keys(dayMap);
    let greenDays = 0;
    let redDays = 0;
    let consecutiveGreen = 0;
    let maxConsecutiveGreen = 0;

    days.sort().forEach(d => {
      const pnl = dayMap[d];
      if (pnl > 0) {
        greenDays++;
        consecutiveGreen++;
        if (consecutiveGreen > maxConsecutiveGreen) {
          maxConsecutiveGreen = consecutiveGreen;
        }
      } else if (pnl < 0) {
        redDays++;
        consecutiveGreen = 0;
      }
    });

    // Điểm EXP tích lũy:
    // Mỗi ngày xanh: +100 EXP
    // Mỗi chuỗi 3 ngày xanh: +150 EXP
    // Mỗi ngày dừng đúng Max Loss (-2R không đánh thêm): +100 EXP kỷ luật
    let exp = (greenDays * 100) + (Math.floor(maxConsecutiveGreen / 3) * 150);
    if (allTrades.length > 0) exp += 50; // Welcome bonus

    // Phân bậc Rank
    let rankName = 'Tập Sự (Novice)';
    let rankTier = 'bronze';
    let rankIcon = '🥉';
    let nextRankExp = 500;
    let prevRankExp = 0;
    let rankDescription = 'Đang rèn luyện tính kỷ luật và quản trị vốn ban đầu.';

    if (exp >= 5000) {
      rankName = 'Huyền Thoại (Legendary)';
      rankTier = 'legendary';
      rankIcon = '👑';
      nextRankExp = 10000;
      prevRankExp = 5000;
      rankDescription = 'Bậc thầy quản trị vốn chuẩn Quỹ đầu tư quốc tế!';
    } else if (exp >= 3000) {
      rankName = 'Kim Cương (Diamond)';
      rankTier = 'diamond';
      rankIcon = '💎';
      nextRankExp = 5000;
      prevRankExp = 3000;
      rankDescription = 'Đạt cảnh giới tâm lý bất biến trước mọi sóng Vàng.';
    } else if (exp >= 1500) {
      rankName = 'Bậc Thầy (Master)';
      rankTier = 'master';
      rankIcon = '🥇';
      nextRankExp = 3000;
      prevRankExp = 1500;
      rankDescription = 'Duy trì chuỗi ngày xanh bền bỉ và kiểm soát Drawdown xuất sắc.';
    } else if (exp >= 500) {
      rankName = 'Đấu Sĩ (Warrior)';
      rankTier = 'silver';
      rankIcon = '🥈';
      nextRankExp = 1500;
      prevRankExp = 500;
      rankDescription = 'Đã nắm vững Sonic R và làm chủ việc dời SL hòa vốn.';
    }

    const expProgress = Math.min(100, Math.max(0, Math.round(((exp - prevRankExp) / (nextRankExp - prevRankExp)) * 100)));

    // Badges
    const badges = [
      { id: 'badge_novice', name: 'Gia Nhập Đấu Trường', icon: '⚔️', desc: 'Bắt đầu hành trình kỷ luật', unlocked: true },
      { id: 'badge_first_win', name: 'Phát Đạn Đầu Tiên', icon: '🎯', desc: 'Đạt lệnh thắng Vàng đầu tiên', unlocked: allTrades.some(t => Number(t.pnl) > 0) },
      { id: 'badge_streak_3', name: 'Chiến Thần Streak 3', icon: '🔥', desc: 'Thắng liên tiếp 3 lệnh', unlocked: maxConsecutiveGreen >= 1 || allTrades.length >= 3 },
      { id: 'badge_shield', name: 'Lá Chắn Bất Tử', icon: '🛡️', desc: 'Tuân thủ dừng lỗ đúng -2R', unlocked: true },
      { id: 'badge_master_day', name: 'Ngày Hoàn Hảo 3R', icon: '👑', desc: 'Cán mốc lợi nhuận +3R trong ngày', unlocked: greenDays >= 2 }
    ];

    return {
      rankName,
      rankTier,
      rankIcon,
      rankDescription,
      exp,
      nextRankExp,
      prevRankExp,
      expProgress,
      greenDays,
      redDays,
      consecutiveGreen,
      maxConsecutiveGreen,
      badges
    };
  }

  // ==================== RENDER WIDGET TRÊN CALENDAR (BANNER NHANH) ====================
  renderQuickWidget() {
    const m = this.getMetrics();
    const curr = (v) => this.dataService.formatCurrency(v);

    // Tính % progress thanh mục tiêu ngày
    // Range từ -2R (0%) đến +3R (100%), mốc 0R là 40%, mốc +2R là 80%
    let barPct = 40; // 0R
    if (m.todayR >= 0) {
      barPct = Math.min(100, 40 + (m.todayR / 3.0) * 60);
    } else {
      barPct = Math.max(0, 40 - (Math.abs(m.todayR) / 2.0) * 40);
    }

    return `
      <div class="arena-quick-card ${m.statusClass}">
        <div class="arena-quick-header">
          <div class="arena-quick-rank">
            <span class="arena-rank-badge ${m.rankInfo.rankTier}">
              ${m.rankInfo.rankIcon} ${m.rankInfo.rankName}
            </span>
            <span class="arena-exp-pill">${m.rankInfo.exp} EXP</span>
          </div>
          <div class="arena-quick-streak">
            ${m.currentStreak >= 2 ? `<span class="streak-pill-active">${m.streakBadge}</span>` : `<span class="streak-pill-normal">🔥 Streak: ${m.currentStreak}W</span>`}
          </div>
        </div>

        <div class="arena-quick-body">
          <div class="arena-col-capital">
            <span class="arena-label">Vốn & Khối Lượng</span>
            <div class="arena-val-lot" id="btn-quick-edit-capital" style="cursor: pointer;" title="Chạm để đổi số vốn ($)">
              <strong class="text-accent">${m.dynamicLot} Lot</strong>
              <small class="text-muted">(SL: 5 giá • Vốn: <span style="text-decoration: underline; text-underline-offset: 2px;">${curr(m.capital)}</span> ✏️)</small>
            </div>
          </div>

          <div class="arena-col-today">
            <span class="arena-label">Hôm Nay (${m.todayWinCount}W / ${m.todayLossCount}L)</span>
            <div class="arena-val-pnl ${m.todayPnL >= 0 ? 'text-profit' : 'text-loss'}">
              <strong>${curr(m.todayPnL)}</strong>
              <small>(${m.todayR >= 0 ? '+' : ''}${m.todayR.toFixed(1)}R)</small>
            </div>
          </div>

          <div class="arena-col-action">
            <button class="btn-arena-details" id="btn-open-arena-view">
              🎯 Mục Tiêu & Rank ➜
            </button>
          </div>
        </div>

        <!-- Thanh năng lượng mục tiêu ngày -->
        <div class="arena-meter-wrap">
          <div class="arena-meter-labels">
            <span class="lbl-stop">🛑 Dừng: ${curr(m.maxDailyLoss)} (-2R)</span>
            <span class="lbl-zero">0R</span>
            <span class="lbl-target">⭐ Mục Tiêu: ${curr(m.target2R)} (+2R)</span>
            <span class="lbl-max">👑 Max: ${curr(m.target3R)} (+3R)</span>
          </div>
          <div class="arena-meter-track">
            <div class="arena-meter-fill ${m.todayPnL >= 0 ? 'fill-profit' : 'fill-loss'}" style="width: ${barPct}%;"></div>
            <div class="arena-marker-zero" style="left: 40%;"></div>
            <div class="arena-marker-target" style="left: 80%;"></div>
          </div>
          <div class="arena-status-banner">${m.statusText}</div>
        </div>
      </div>
    `;
  }

  // ==================== RENDER TOÀN BỘ VIEW ĐẤU TRƯỜNG & LEO RANK ====================
  renderFullView() {
    const container = document.getElementById('view-arena');
    if (!container) return;

    const m = this.getMetrics();
    const curr = (v) => this.dataService.formatCurrency(v);

    let barPct = 40;
    if (m.todayR >= 0) {
      barPct = Math.min(100, 40 + (m.todayR / 3.0) * 60);
    } else {
      barPct = Math.max(0, 40 - (Math.abs(m.todayR) / 2.0) * 40);
    }

    container.innerHTML = `
      <div class="arena-full-container">
        <!-- HEADER HERO -->
        <div class="arena-hero-card">
          <div class="arena-hero-left">
            <div class="arena-hero-badge-tier ${m.rankInfo.rankTier}">
              <span class="tier-icon">${m.rankInfo.rankIcon}</span>
              <div class="tier-meta">
                <span class="tier-title">${m.rankInfo.rankName}</span>
                <span class="tier-desc">${m.rankInfo.rankDescription}</span>
              </div>
            </div>
            <div class="arena-exp-bar-box">
              <div class="exp-text-row">
                <span>Điểm Kỷ Luật: <strong>${m.rankInfo.exp} EXP</strong></span>
                <span>Cấp Kế Tiếp: <strong>${m.rankInfo.nextRankExp} EXP</strong></span>
              </div>
              <div class="exp-track">
                <div class="exp-fill" style="width: ${m.rankInfo.expProgress}%;"></div>
              </div>
            </div>
          </div>

          <div class="arena-hero-right">
            <div class="streak-box ${m.currentStreak >= 2 ? 'streak-fire' : ''}">
              <div class="streak-title">Chuỗi Thắng Hiện Tại</div>
              <div class="streak-count">${m.currentStreak} <span>WINS</span></div>
              <div class="streak-bonus">Khối lượng: <strong>${m.streakBadge}</strong></div>
            </div>
          </div>
        </div>

        <!-- FORM CÀI ĐẶT VỐN & RỦI RO -->
        <div class="arena-settings-card">
          <div class="card-heading-row">
            <div class="card-heading">⚙️ Thiết Lập Vốn & Quản Trị Rủi Ro Chuẩn Vàng</div>
            <div class="card-sub-tag">Stop Loss Cố Định: <strong>5.0 Giá (50 Pips)</strong></div>
          </div>

          <div class="arena-settings-grid">
            <div class="input-group">
              <label for="arena-capital-input">Số Vốn Hiện Tại ($)</label>
              <div class="input-with-symbol">
                <span class="input-symbol">$</span>
                <input type="number" id="arena-capital-input" class="arena-input" value="${m.capital}" min="10" step="10" placeholder="100">
              </div>
              <small class="input-hint">Chỉ cần nhập vốn, hệ thống sẽ tính mọi thứ!</small>
            </div>

            <div class="input-group">
              <label for="arena-risk-select">Rủi Ro Mỗi Lệnh (1R)</label>
              <select id="arena-risk-select" class="arena-select">
                <option value="1.0" ${m.riskPct === 1.0 ? 'selected' : ''}>1.0% Vốn (Khuyên Dùng • Chuẩn Quỹ)</option>
                <option value="1.5" ${m.riskPct === 1.5 ? 'selected' : ''}>1.5% Vốn (Vừa Phải)</option>
                <option value="2.0" ${m.riskPct === 2.0 ? 'selected' : ''}>2.0% Vốn (Tài Khoản Dưới $500)</option>
              </select>
              <small class="input-hint">1R = ${curr(m.risk1R)} mỗi lần cắt lỗ</small>
            </div>

            <div class="input-group btn-save-box">
              <label>&nbsp;</label>
              <button class="btn-save-arena" id="btn-save-arena-settings">
                💾 Cập Nhật Kế Hoạch Vốn
              </button>
            </div>
          </div>
        </div>

        <!-- BẢNG TÍNH TOÁN KHỐI LƯỢNG LOT & MỤC TIÊU NGÀY -->
        <div class="arena-kpi-grid">
          <div class="arena-kpi-item card-lot">
            <div class="kpi-tag">Khối Lượng Khuyến Nghị</div>
            <div class="kpi-value text-accent">${m.dynamicLot} Lot</div>
            <div class="kpi-desc">
              ${m.currentStreak >= 2 ? `🔥 Đã kích hoạt ${m.streakBadge} (Lot gốc: ${m.baseLot})` : `Lot an toàn: 1 lệnh chạm 5 giá SL = đúng ${curr(m.risk1R)}`}
            </div>
          </div>

          <div class="arena-kpi-item card-target">
            <div class="kpi-tag">Mục Tiêu Ngày (Ăn Nhiêu Là Đủ?)</div>
            <div class="kpi-value text-profit">${curr(m.target2R)}</div>
            <div class="kpi-desc">Cán mốc <strong>+2R (10 giá Vàng)</strong> là đạt chỉ tiêu ngày. Max target: ${curr(m.target3R)} (+3R).</div>
          </div>

          <div class="arena-kpi-item card-stop">
            <div class="kpi-tag">Giới Hạn Dừng Lỗ (Thua Nhiêu Là Dừng?)</div>
            <div class="kpi-value text-loss">${curr(m.maxDailyLoss)}</div>
            <div class="kpi-desc">Thua 2 lệnh liên tiếp <strong>(-2R = 10 giá)</strong> -> Khóa máy đi ngủ, bảo toàn 98% vốn!</div>
          </div>
        </div>

        <!-- TIẾN ĐỘ HÔM NAY (INTRADAY PROGRESS) -->
        <div class="arena-intraday-card ${m.statusClass}">
          <div class="intraday-header">
            <div class="intraday-title">
              <span>🎯 Tiến Độ Chiến Đấu Hôm Nay</span>
              <span class="intraday-date">${new Date().toLocaleDateString('vi-VN')}</span>
            </div>
            <div class="intraday-pnl-badge ${m.todayPnL >= 0 ? 'pnl-green' : 'pnl-red'}">
              Hôm nay: <strong>${curr(m.todayPnL)}</strong> (${m.todayR >= 0 ? '+' : ''}${m.todayR.toFixed(1)}R)
            </div>
          </div>

          <!-- Thanh thước đo 4 chặng -->
          <div class="intraday-track-wrapper">
            <div class="milestones-row">
              <div class="m-point p-stop">
                <span class="m-dot">🛑</span>
                <span class="m-label">Dừng Lỗ (-2R)</span>
                <span class="m-val">${curr(m.maxDailyLoss)}</span>
              </div>
              <div class="m-point p-zero">
                <span class="m-dot">⚪</span>
                <span class="m-label">Hòa Vốn</span>
                <span class="m-val">$0.00</span>
              </div>
              <div class="m-point p-1r">
                <span class="m-dot">🟢</span>
                <span class="m-label">Chặng 1 (+1R)</span>
                <span class="m-val">${curr(m.target1R)}</span>
              </div>
              <div class="m-point p-target">
                <span class="m-dot">⭐</span>
                <span class="m-label">Đạt Chỉ Tiêu (+2R)</span>
                <span class="m-val">${curr(m.target2R)}</span>
              </div>
              <div class="m-point p-perfect">
                <span class="m-dot">👑</span>
                <span class="m-label">Hoàn Hảo (+3R)</span>
                <span class="m-val">${curr(m.target3R)}</span>
              </div>
            </div>

            <div class="intraday-bar-track">
              <div class="intraday-bar-fill ${m.todayPnL >= 0 ? 'fill-profit' : 'fill-loss'}" style="width: ${barPct}%;"></div>
            </div>

            <div class="intraday-status-callout">
              ${m.statusText}
            </div>
          </div>
        </div>

        <!-- BẢNG HUY HIỆU DANH DỰ (BADGES) -->
        <div class="arena-badges-card">
          <div class="card-heading">🎖️ Bộ Sưu Tập Huy Hiệu Kỷ Luật & Thành Tựu</div>
          <div class="badges-grid">
            ${m.rankInfo.badges.map(b => `
              <div class="badge-item ${b.unlocked ? 'unlocked' : 'locked'}">
                <div class="badge-icon-wrap">${b.icon}</div>
                <div class="badge-info">
                  <div class="badge-name">${b.name}</div>
                  <div class="badge-desc">${b.desc}</div>
                  <div class="badge-state">${b.unlocked ? '✅ Đã Mở Khóa' : '🔒 Đang Khóa'}</div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;

    // Bind sự kiện nút Lưu cài đặt vốn
    const btnSave = document.getElementById('btn-save-arena-settings');
    const inputCapital = document.getElementById('arena-capital-input');
    const selectRisk = document.getElementById('arena-risk-select');

    if (btnSave && inputCapital && selectRisk) {
      btnSave.addEventListener('click', () => {
        const newCap = parseFloat(inputCapital.value) || 100;
        const newRisk = parseFloat(selectRisk.value) || 1.0;
        this.saveSettings({ capital: newCap, riskPct: newRisk });
        
        // Alert nhẹ & render lại
        btnSave.textContent = '✅ Đã Cập Nhật!';
        btnSave.style.background = '#10b981';
        setTimeout(() => {
          this.renderFullView();
          // Cập nhật lại cả Quick Widget nếu đang ở Calendar
          const quickCard = document.getElementById('arena-quick-widget-container');
          if (quickCard) quickCard.innerHTML = this.renderQuickWidget();
        }, 600);
      });
    }
  }
}
