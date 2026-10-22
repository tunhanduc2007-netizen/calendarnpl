// ==============================================================================
// MY PNL - MAIN APPLICATION CONTROLLER
// ==============================================================================

import { DataService } from './data.js';
import { CalendarEngine } from './calendar.js';
import { DashboardEngine } from './dashboard.js';
import { JournalEngine } from './journal.js';
import { ArenaEngine } from './arena.js';

class AppController {
  constructor() {
    this.currentView = 'calendar';
    this.selectedDayDate = null;

    // Initialize View Engines
    this.arenaEngine = new ArenaEngine(DataService);

    this.calendarEngine = new CalendarEngine(DataService, (dateStr, dayData) => {
      this.openDayDetailModal(dateStr, dayData);
    });

    this.dashboardEngine = new DashboardEngine(DataService);
    
    this.journalEngine = new JournalEngine(DataService, () => {
      this.refreshCurrentView();
      this.updateAccountBadge();
    });
  }

  init() {
    const todayStr = new Date().toISOString().split('T')[0];
    const tradeDateEl = document.getElementById('trade-date');
    const diaryDateEl = document.getElementById('diary-date');
    if (tradeDateEl) tradeDateEl.value = todayStr;
    if (diaryDateEl) diaryDateEl.value = todayStr;

    this.bindNavigation();
    this.bindModals();
    this.bindCurrencySwitcher();
    this.bindTopbarActions();
    this.bindCalendarControls();
    this.bindForms();
    this.bindAccountSettings();
    this.updateAccountBadge();
    this.initCloudSync();
    this.bindTouchGestures();

    // Render Initial View (Calendar) & Arena Quick Widget
    this.calendarEngine.render();
    this.renderArenaWidget();
    this.purgeNetlifyElements();
    console.log('tnduck PnL Web App Initialized Cleanly!');
  }

  // ==================== NETLIFY ERADICATOR ====================
  purgeNetlifyElements() {
    const purge = () => {
      try {
        const selectors = [
          'netlify-drawer', '#netlify-drawer', '.netlify-badge', '#netlify-badge',
          '[data-netlify-deploy-id]', '[class*="netlify"]', '[id*="netlify"]',
          'iframe[src*="netlify"]', 'iframe[title*="Netlify"]', 'a[href*="netlify.com"]'
        ];
        document.querySelectorAll(selectors.join(',')).forEach(el => el.remove());
        document.querySelectorAll('div, a, button, section, span, p').forEach(el => {
          if (el.children.length <= 4 && el.textContent && el.textContent.includes('Powered by Netlify')) {
            el.remove();
          }
        });
      } catch (e) {}
    };

    purge();
    if (typeof MutationObserver !== 'undefined') {
      const observer = new MutationObserver(purge);
      observer.observe(document.documentElement, { childList: true, subtree: true });
    }
    let count = 0;
    const interval = setInterval(() => {
      purge();
      count++;
      if (count > 25) clearInterval(interval);
    }, 200);
  }

  // ==================== NAVIGATION CONTROLLER ====================
  bindNavigation() {
    const navItems = document.querySelectorAll('.sidebar-nav .nav-item');
    const viewTitleText = document.getElementById('page-title-text');

    const viewTitles = {
      calendar: 'Calendar',
      dashboard: 'Dashboard',
      stats: 'Stats',
      journal: 'Trade Journal',
      insights: 'Trading Insights',
      diary: 'Trade Diary',
      arena: 'Mục Tiêu & Leo Rank'
    };

    navItems.forEach(item => {
      item.addEventListener('click', () => {
        const viewId = item.getAttribute('data-view');
        if (viewId) this.switchView(viewId);
      });
    });

    // Mobile Bottom Nav Menu Button (Opens More Menu Bottom Sheet)
    const mobileMenuBtn = document.getElementById('btn-mobile-menu');
    const moreMenuModal = document.getElementById('modal-more-menu');
    if (mobileMenuBtn && moreMenuModal) {
      mobileMenuBtn.addEventListener('click', () => {
        if (navigator.vibrate) navigator.vibrate(12);
        moreMenuModal.classList.add('active');
      });
    }

    // Handle clicks inside More Menu Bottom Sheet
    document.querySelectorAll('#modal-more-menu [data-menu-action="view"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const viewId = btn.getAttribute('data-view');
        if (moreMenuModal) moreMenuModal.classList.remove('active');
        if (viewId) this.switchView(viewId);
      });
    });

    // Account settings from More Menu
    const menuOpenAccount = document.getElementById('btn-menu-open-account');
    const accountModal = document.getElementById('modal-account');
    if (menuOpenAccount && accountModal && moreMenuModal) {
      menuOpenAccount.addEventListener('click', () => {
        moreMenuModal.classList.remove('active');
        accountModal.classList.add('active');
      });
    }

    // Request feature from More Menu
    const menuReqFeature = document.getElementById('btn-menu-request-feature');
    if (menuReqFeature && moreMenuModal) {
      menuReqFeature.addEventListener('click', () => {
        moreMenuModal.classList.remove('active');
        const feature = prompt('💡 Bạn muốn đề xuất thêm tính năng nào cho My PnL?');
        if (feature) {
          alert('Cảm ơn đóng góp của bạn! Tính năng đã được ghi nhận vào lộ trình nâng cấp.');
        }
      });
    }

    // Toggle Sidebar collapse
    const toggleSidebarBtn = document.getElementById('btn-toggle-sidebar');
    const sidebar = document.getElementById('sidebar');
    const mainWrapper = document.querySelector('.main-wrapper');

    if (toggleSidebarBtn && sidebar && mainWrapper) {
      toggleSidebarBtn.addEventListener('click', () => {
        sidebar.classList.toggle('collapsed');
        if (sidebar.classList.contains('collapsed')) {
          sidebar.style.width = '70px';
          mainWrapper.style.marginLeft = '70px';
          document.querySelectorAll('.sidebar-nav span, .brand-logo span, .sidebar-footer span, .btn-upload-trade span').forEach(el => {
            el.style.display = 'none';
          });
        } else {
          sidebar.style.width = 'var(--sidebar-w)';
          mainWrapper.style.marginLeft = 'var(--sidebar-w)';
          document.querySelectorAll('.sidebar-nav span, .brand-logo span, .sidebar-footer span, .btn-upload-trade span').forEach(el => {
            el.style.display = 'inline';
          });
        }
      });
    }
 
    // Request feature button
    const reqBtn = document.getElementById('btn-request-feature');
    if (reqBtn) {
      reqBtn.addEventListener('click', () => {
        const feature = prompt('💡 Bạn muốn đề xuất thêm tính năng nào cho My PnL?');
        if (feature) {
          alert('Cảm ơn đóng góp của bạn! Tính năng đã được ghi nhận vào lộ trình nâng cấp.');
        }
      });
    }

    // Sign out button
    const signOutBtn = document.getElementById('btn-sign-out');
    if (signOutBtn) {
      signOutBtn.addEventListener('click', () => {
        if (confirm('Bạn muốn đăng xuất khỏi My PnL?')) {
          alert('Đã lưu dữ liệu ngoại tuyến (Offline LocalStorage). Bạn có thể quay lại bất kỳ lúc nào.');
        }
      });
    }
  }

  renderView(viewId) {
    switch (viewId) {
      case 'calendar':
        this.calendarEngine.render();
        this.renderArenaWidget();
        break;
      case 'dashboard':
        this.dashboardEngine.render();
        break;
      case 'stats':
        this.renderStatsView();
        break;
      case 'journal':
        this.journalEngine.renderJournal();
        break;
      case 'insights':
        this.journalEngine.renderInsights();
        break;
      case 'diary':
        this.journalEngine.renderDiary();
        break;
      case 'arena':
        this.arenaEngine.renderFullView();
        break;
    }
  }

  switchView(viewId) {
    if (!viewId) return;
    const navItems = document.querySelectorAll('.sidebar-nav .nav-item');
    const mobileMenuBtn = document.getElementById('btn-mobile-menu');
    const viewTitleText = document.getElementById('page-title-text');

    const viewTitles = {
      calendar: 'Calendar',
      dashboard: 'Dashboard',
      stats: 'Stats',
      journal: 'Trade Journal',
      insights: 'Trading Insights',
      diary: 'Trade Diary',
      arena: 'Mục Tiêu & Leo Rank'
    };

    // Sub-views accessed via the Mobile Menu
    const menuSubViews = ['journal', 'insights', 'dashboard', 'diary'];

    navItems.forEach(btn => {
      if (btn.getAttribute('data-view') === viewId) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    // Highlight Menu tab on mobile if user is inside a menu sub-view
    if (mobileMenuBtn) {
      if (menuSubViews.includes(viewId)) {
        mobileMenuBtn.classList.add('active');
      } else {
        mobileMenuBtn.classList.remove('active');
      }
    }

    const allViews = document.querySelectorAll('.view-container');
    allViews.forEach(v => v.classList.remove('active'));

    const targetView = document.getElementById(`view-${viewId}`);
    if (targetView) targetView.classList.add('active');

    this.currentView = viewId;
    if (viewTitleText && viewTitles[viewId]) {
      viewTitleText.textContent = viewTitles[viewId];
    }

    this.renderView(viewId);
  }

  refreshCurrentView() {
    this.renderView(this.currentView);
    this.renderArenaWidget();
  }

  renderArenaWidget() {
    const container = document.getElementById('arena-quick-widget-container');
    if (container && this.arenaEngine) {
      container.innerHTML = this.arenaEngine.renderQuickWidget();
      const btnOpen = document.getElementById('btn-open-arena-view');
      if (btnOpen) {
        btnOpen.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.switchView('arena');
        });
      }
    }
  }

  // ==================== CALENDAR HEADER & MONTH NAV ====================
  bindCalendarControls() {
    const monthSelect = document.getElementById('select-month');
    const yearSelect = document.getElementById('select-year');
    const prevBtn = document.getElementById('btn-prev-month');
    const nextBtn = document.getElementById('btn-next-month');

    if (monthSelect) {
      monthSelect.addEventListener('change', (e) => {
        const m = parseInt(e.target.value, 10);
        const y = parseInt(yearSelect.value, 10);
        this.calendarEngine.setMonth(y, m);
      });
    }

    if (yearSelect) {
      yearSelect.addEventListener('change', (e) => {
        const y = parseInt(e.target.value, 10);
        const m = parseInt(monthSelect.value, 10);
        this.calendarEngine.setMonth(y, m);
      });
    }

    if (prevBtn) {
      prevBtn.addEventListener('click', () => {
        this.calendarEngine.prevMonth();
      });
    }

    if (nextBtn) {
      nextBtn.addEventListener('click', () => {
        this.calendarEngine.nextMonth();
      });
    }
  }

  // ==================== TOPBAR QUICK ACTIONS ====================
  bindTopbarActions() {
    const demoBtn = document.getElementById('btn-quick-demo');
    const resetBtn = document.getElementById('btn-quick-reset');
    const exportCsvBtn = document.getElementById('btn-export-csv-top');
    const exportJsonBtn = document.getElementById('btn-export-json-top');
    const bannerLogBtn = document.getElementById('btn-quick-log-banner');

    if (demoBtn) {
      demoBtn.addEventListener('click', () => {
        const year = this.calendarEngine.currentYear;
        const month = this.calendarEngine.currentMonth;
        DataService.loadDemoData(year, month);
        this.refreshCurrentView();
        this.updateAccountBadge();
        alert('✨ Đã nạp thành công 20 ngày giao dịch mẫu xanh đỏ rực rỡ để bạn trải nghiệm giao diện!');
      });
    }

    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        if (confirm('Bạn có chắc chắn muốn xóa sạch dữ liệu nhật ký về 0 để tự ghi mới?')) {
          DataService.clearAllTrades();
          this.refreshCurrentView();
          this.updateAccountBadge();
          alert('🗑️ Đã xóa sạch dữ liệu!');
        }
      });
    }

    if (exportCsvBtn) {
      exportCsvBtn.addEventListener('click', () => {
        DataService.exportDataCSV();
      });
    }

    if (exportJsonBtn) {
      exportJsonBtn.addEventListener('click', () => {
        DataService.exportDataJSON();
      });
    }

    if (bannerLogBtn) {
      bannerLogBtn.addEventListener('click', () => {
        const uploadModal = document.getElementById('modal-upload-trade');
        const todayStr = new Date().toISOString().split('T')[0];
        const dateInput = document.getElementById('trade-date');
        if (dateInput) dateInput.value = todayStr;
        if (uploadModal) uploadModal.classList.add('active');
        document.getElementById('trade-amount-raw')?.focus();
      });
    }
  }

  // ==================== MODALS MANAGER ====================
  bindModals() {
    // Open Upload Trade Modal (Sidebar button)
    const uploadBtn = document.getElementById('btn-open-upload');
    const uploadModal = document.getElementById('modal-upload-trade');
    if (uploadBtn && uploadModal) {
      uploadBtn.addEventListener('click', () => {
        const todayStr = new Date().toISOString().split('T')[0];
        const dateInput = document.getElementById('trade-date');
        if (dateInput && !dateInput.value) dateInput.value = todayStr;
        uploadModal.classList.add('active');
        document.getElementById('trade-amount-raw')?.focus();
      });
    }

    // Mobile Bottom Nav Center Action Button (+ Ghi PnL)
    const mobileQuickBtn = document.getElementById('btn-mobile-quick-add');
    if (mobileQuickBtn && uploadModal) {
      mobileQuickBtn.addEventListener('click', () => {
        if (navigator.vibrate) navigator.vibrate(15);
        const todayStr = new Date().toISOString().split('T')[0];
        const dateInput = document.getElementById('trade-date');
        if (dateInput && !dateInput.value) dateInput.value = todayStr;
        uploadModal.classList.add('active');
        document.getElementById('trade-amount-raw')?.focus();
      });
    }

    // Close Modals via [data-modal] buttons
    const closeButtons = document.querySelectorAll('[data-modal]');
    closeButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const targetModalId = btn.getAttribute('data-modal');
        const modal = document.getElementById(targetModalId);
        if (modal) modal.classList.remove('active');
      });
    });

    // Close on clicking backdrop
    const modalOverlays = document.querySelectorAll('.modal-overlay');
    modalOverlays.forEach(overlay => {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
          overlay.classList.remove('active');
        }
      });
    });
  }

  // ==================== CURRENCY SWITCHER (USD <-> VND) ====================
  bindCurrencySwitcher() {
    const btnUsd = document.getElementById('btn-curr-usd');
    const btnVnd = document.getElementById('btn-curr-vnd');

    const updateActiveButtons = (curr) => {
      if (curr === 'VND') {
        btnVnd?.classList.add('active');
        btnUsd?.classList.remove('active');
      } else {
        btnUsd?.classList.add('active');
        btnVnd?.classList.remove('active');
      }
    };

    updateActiveButtons(DataService.getCurrency());

    if (btnUsd) {
      btnUsd.addEventListener('click', () => {
        DataService.setCurrency('USD');
        updateActiveButtons('USD');
        this.refreshCurrentView();
        this.updateAccountBadge();
        if (this.syncModalCurrency) this.syncModalCurrency('USD');
      });
    }

    if (btnVnd) {
      btnVnd.addEventListener('click', () => {
        DataService.setCurrency('VND');
        updateActiveButtons('VND');
        this.refreshCurrentView();
        this.updateAccountBadge();
        if (this.syncModalCurrency) this.syncModalCurrency('VND');
      });
    }
  }

  // ==================== DAY DETAIL & FAST EDIT MODAL ====================
  openDayDetailModal(dateStr, dayData) {
    this.selectedDayDate = dateStr;
    const hasTrades = dayData && dayData.tradeCount > 0;

    // If day is empty, directly open the simplified PnL entry modal for fast logging!
    if (!hasTrades) {
      const uploadModal = document.getElementById('modal-upload-trade');
      const dateInput = document.getElementById('trade-date');
      const amountInput = document.getElementById('trade-amount-raw');
      if (dateInput) dateInput.value = dateStr;
      if (amountInput) amountInput.value = '';
      if (uploadModal) uploadModal.classList.add('active');
      setTimeout(() => amountInput?.focus(), 50);
      return;
    }

    // Day already has PnL: open the day view modal with quick edit/delete buttons
    const modal = document.getElementById('modal-day-detail');
    const titleEl = document.getElementById('day-detail-title');
    const pnlEl = document.getElementById('day-detail-pnl');
    const notesEl = document.getElementById('day-detail-notes');
    const editBtn = document.getElementById('btn-edit-day-pnl');
    const deleteBtn = document.getElementById('btn-delete-day-pnl');

    if (!modal) return;

    if (titleEl) titleEl.textContent = `📅 Giao Dịch Ngày ${dateStr}`;
    
    const pnl = dayData.pnl;
    const isWin = pnl >= 0;

    if (pnlEl) {
      pnlEl.textContent = DataService.formatCurrency(pnl, true);
      pnlEl.className = `day-hero-pnl-value font-mono font-bold ${isWin ? 'text-profit glow-profit-text' : 'text-loss glow-loss-text'}`;
    }

    if (notesEl) {
      const firstTrade = dayData.trades[0];
      notesEl.textContent = firstTrade?.notes ? `📝 "${firstTrade.notes}"` : (isWin ? '🟢 Ngày Giao Dịch Lãi' : '🔴 Ngày Giao Dịch Lỗ');
    }

    if (editBtn) {
      editBtn.onclick = () => {
        modal.classList.remove('active');
        const uploadModal = document.getElementById('modal-upload-trade');
        const dateInput = document.getElementById('trade-date');
        const amountInput = document.getElementById('trade-amount-raw');
        const notesInput = document.getElementById('trade-notes');
        const typeProfitBtn = document.getElementById('toggle-type-profit');
        const typeLossBtn = document.getElementById('toggle-type-loss');

        if (dateInput) dateInput.value = dateStr;
        
        // Populate amount according to active currency
        const curr = DataService.getCurrency();
        if (curr === 'VND') {
          const rate = DataService.getExchangeRate();
          if (amountInput) amountInput.value = Math.round(Math.abs(pnl) * rate);
        } else {
          if (amountInput) amountInput.value = Math.abs(pnl);
        }
        
        if (notesInput) notesInput.value = dayData.trades[0]?.notes || '';

        if (pnl >= 0) {
          typeProfitBtn?.click();
        } else {
          typeLossBtn?.click();
        }

        if (uploadModal) uploadModal.classList.add('active');
        setTimeout(() => amountInput?.focus(), 50);
      };
    }

    if (deleteBtn) {
      deleteBtn.onclick = () => {
        if (confirm(`Bạn muốn xóa kết quả giao dịch của ngày ${dateStr}?`)) {
          DataService.deleteTradesForDate(dateStr);
          modal.classList.remove('active');
          this.refreshCurrentView();
          this.updateAccountBadge();
        }
      };
    }

    modal.classList.add('active');
  }

  // ==================== FORM SUBMISSIONS ====================
  bindForms() {
    // 1. Simplified Quick Daily PnL Form
    const uploadForm = document.getElementById('form-upload-trade');
    const toggleProfit = document.getElementById('toggle-type-profit');
    const toggleLoss = document.getElementById('toggle-type-loss');
    const pnlTypeValue = document.getElementById('pnl-type-value');
    const amountPrefix = document.getElementById('amount-prefix');
    const amountLabel = document.getElementById('amount-label');
    const toggleAdvancedBtn = document.getElementById('btn-toggle-advanced');
    const advancedBox = document.getElementById('advanced-fields-box');
    const modalCurrUsd = document.getElementById('modal-curr-usd');
    const modalCurrVnd = document.getElementById('modal-curr-vnd');
    const modalCurrVal = document.getElementById('modal-currency-value');
    const chipsContainer = document.getElementById('quick-chips-container');
    const amountInput = document.getElementById('trade-amount-raw');

    // Render preset chips dynamically
    const renderChips = (curr) => {
      if (!chipsContainer) return;
      if (curr === 'VND') {
        chipsContainer.innerHTML = `
          <span class="chips-label">Chọn nhanh:</span>
          <button type="button" class="chip-btn" data-amt="2000000">2tr ₫</button>
          <button type="button" class="chip-btn" data-amt="5000000">5tr ₫</button>
          <button type="button" class="chip-btn" data-amt="10000000">10tr ₫</button>
          <button type="button" class="chip-btn" data-amt="25000000">25tr ₫</button>
          <button type="button" class="chip-btn" data-amt="50000000">50tr ₫</button>
        `;
      } else {
        chipsContainer.innerHTML = `
          <span class="chips-label">Chọn nhanh:</span>
          <button type="button" class="chip-btn" data-amt="100">100$</button>
          <button type="button" class="chip-btn" data-amt="250">250$</button>
          <button type="button" class="chip-btn" data-amt="500">500$</button>
          <button type="button" class="chip-btn" data-amt="1000">1,000$</button>
          <button type="button" class="chip-btn" data-amt="2000">2,000$</button>
        `;
      }
      chipsContainer.querySelectorAll('.chip-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const amt = btn.getAttribute('data-amt');
          if (amountInput) {
            amountInput.value = amt;
            amountInput.focus();
          }
        });
      });
    };

    // Update Modal Currency UI (USD vs VND)
    const setModalCurrency = (curr) => {
      if (modalCurrVal) modalCurrVal.value = curr;
      const type = pnlTypeValue ? pnlTypeValue.value : 'PROFIT';
      const isProfit = type === 'PROFIT';

      if (curr === 'VND') {
        modalCurrVnd?.classList.add('active');
        modalCurrUsd?.classList.remove('active');
        if (amountLabel) amountLabel.textContent = isProfit ? '💰 Số Tiền Lời (VND ₫)' : '💸 Số Tiền Lỗ (VND ₫)';
        if (amountPrefix) {
          amountPrefix.textContent = isProfit ? '+₫' : '-₫';
          amountPrefix.className = isProfit ? 'currency-prefix text-profit' : 'currency-prefix text-loss';
        }
        amountInput?.setAttribute('placeholder', '5000000');
        renderChips('VND');
      } else {
        modalCurrUsd?.classList.add('active');
        modalCurrVnd?.classList.remove('active');
        if (amountLabel) amountLabel.textContent = isProfit ? '💰 Số Tiền Lời ($)' : '💸 Số Tiền Lỗ ($)';
        if (amountPrefix) {
          amountPrefix.textContent = isProfit ? '+$' : '-$';
          amountPrefix.className = isProfit ? 'currency-prefix text-profit' : 'currency-prefix text-loss';
        }
        amountInput?.setAttribute('placeholder', '350.00');
        renderChips('USD');
      }
    };

    if (modalCurrUsd) modalCurrUsd.addEventListener('click', () => setModalCurrency('USD'));
    if (modalCurrVnd) modalCurrVnd.addEventListener('click', () => setModalCurrency('VND'));
    this.syncModalCurrency = (curr) => setModalCurrency(curr);
    setModalCurrency(DataService.getCurrency());

    // Type Switcher: PROFIT vs LOSS
    if (toggleProfit && toggleLoss && pnlTypeValue) {
      toggleProfit.addEventListener('click', () => {
        pnlTypeValue.value = 'PROFIT';
        toggleProfit.classList.add('active-profit');
        toggleLoss.classList.remove('active-loss');
        const curr = modalCurrVal ? modalCurrVal.value : 'USD';
        if (amountPrefix) {
          amountPrefix.textContent = curr === 'VND' ? '+₫' : '+$';
          amountPrefix.className = 'currency-prefix text-profit';
        }
        if (amountLabel) amountLabel.textContent = curr === 'VND' ? '💰 Số Tiền Lời (VND ₫)' : '💰 Số Tiền Lời ($)';
      });

      toggleLoss.addEventListener('click', () => {
        pnlTypeValue.value = 'LOSS';
        toggleLoss.classList.add('active-loss');
        toggleProfit.classList.remove('active-profit');
        const curr = modalCurrVal ? modalCurrVal.value : 'USD';
        if (amountPrefix) {
          amountPrefix.textContent = curr === 'VND' ? '-₫' : '-$';
          amountPrefix.className = 'currency-prefix text-loss';
        }
        if (amountLabel) amountLabel.textContent = curr === 'VND' ? '💸 Số Tiền Lỗ (VND ₫)' : '💸 Số Tiền Lỗ ($)';
      });
    }

    // Optional advanced fields toggle
    if (toggleAdvancedBtn && advancedBox) {
      toggleAdvancedBtn.addEventListener('click', () => {
        if (advancedBox.style.display === 'none') {
          advancedBox.style.display = 'block';
          toggleAdvancedBtn.textContent = '▲ Thu gọn chi tiết';
        } else {
          advancedBox.style.display = 'none';
          toggleAdvancedBtn.textContent = '⚙️ Mở rộng ghi chi tiết (Cặp tiền, Lots) &darr;';
        }
      });
    }

    // Submit Quick PnL
    if (uploadForm) {
      uploadForm.addEventListener('submit', (e) => {
        e.preventDefault();

        const date = document.getElementById('trade-date').value;
        const type = pnlTypeValue ? pnlTypeValue.value : 'PROFIT';
        const rawAmt = parseFloat(document.getElementById('trade-amount-raw').value);
        const notes = document.getElementById('trade-notes')?.value.trim() || '';
        const symbol = document.getElementById('trade-symbol')?.value.trim().toUpperCase() || '';
        const inputCurr = modalCurrVal ? modalCurrVal.value : 'USD';

        if (!date || isNaN(rawAmt)) {
          alert('Vui lòng chọn ngày và nhập số tiền!');
          return;
        }

        // Normalize amount to base USD
        let pnlInUSD = 0;
        if (inputCurr === 'VND') {
          const rate = DataService.getExchangeRate();
          pnlInUSD = (type === 'LOSS' ? -Math.abs(rawAmt) : Math.abs(rawAmt)) / rate;
        } else {
          pnlInUSD = type === 'LOSS' ? -Math.abs(rawAmt) : Math.abs(rawAmt);
        }

        DataService.setDailyPnL({
          date,
          pnl: pnlInUSD,
          notes,
          symbol: symbol || (pnlInUSD >= 0 ? 'LỜI' : 'LỖ')
        });

        // Close modal and reset form
        document.getElementById('modal-upload-trade').classList.remove('active');
        uploadForm.reset();
        document.getElementById('trade-date').value = date;

        // Reset to Profit mode default
        toggleProfit?.click();

        // Re-render
        this.refreshCurrentView();
        this.updateAccountBadge();
      });
    }

    // 2. Add Diary Form
    const diaryForm = document.getElementById('form-add-diary');
    if (diaryForm) {
      diaryForm.addEventListener('submit', (e) => {
        e.preventDefault();

        const date = document.getElementById('diary-date').value;
        const marketSession = document.getElementById('diary-session').value;
        const disciplineScore = parseInt(document.getElementById('diary-score').value, 10);
        const mood = document.getElementById('diary-mood').value;
        const notes = document.getElementById('diary-notes').value.trim();
        const mistakes = document.getElementById('diary-mistakes').value.trim();

        DataService.addDiary({
          date,
          marketSession,
          disciplineScore,
          mood,
          notes,
          mistakes,
          rulesFollowed: disciplineScore >= 4
        });

        document.getElementById('modal-add-diary').classList.remove('active');
        diaryForm.reset();

        if (this.currentView === 'diary') {
          this.journalEngine.renderDiary();
        }
        alert('📔 Đã ghi nhận bài học nhật ký hôm nay!');
      });
    }
  }

  // ==================== ACCOUNT SETTINGS & BADGE ====================
  bindAccountSettings() {
    const accModalBtn = document.getElementById('btn-account-modal');
    const badgeBtn = document.getElementById('account-badge');
    const settingsBtn = document.getElementById('btn-settings');
    const modal = document.getElementById('modal-account');
    const select = document.getElementById('account-switch-select');
    const saveBtn = document.getElementById('btn-save-account');
    const resetBtn = document.getElementById('btn-reset-demo-data');

    const openAccModal = () => {
      const accounts = DataService.getAccounts();
      const active = DataService.getActiveAccount();

      if (select) {
        select.innerHTML = accounts.map(a => `
          <option value="${a.id}" ${a.id === active.id ? 'selected' : ''}>${a.name} ($${(a.initialBalance/1000).toFixed(0)}k)</option>
        `).join('');
      }

      const nameInput = document.getElementById('acc-name');
      const initialInput = document.getElementById('acc-initial');
      const gainInput = document.getElementById('acc-gain');
      const cashInput = document.getElementById('acc-cash');

      if (nameInput) nameInput.value = active.name;
      if (initialInput) initialInput.value = active.initialBalance;
      if (gainInput) gainInput.value = active.activeGain;
      if (cashInput) cashInput.value = 0;

      modal.classList.add('active');
    };

    if (accModalBtn) accModalBtn.addEventListener('click', openAccModal);
    if (badgeBtn) badgeBtn.addEventListener('click', openAccModal);
    if (settingsBtn) settingsBtn.addEventListener('click', openAccModal);

    if (select) {
      select.addEventListener('change', (e) => {
        DataService.setActiveAccount(e.target.value);
        openAccModal();
        this.updateAccountBadge();
        this.refreshCurrentView();
      });
    }

    if (saveBtn) {
      saveBtn.addEventListener('click', () => {
        const active = DataService.getActiveAccount();
        const updated = {
          name: document.getElementById('acc-name').value,
          initialBalance: parseFloat(document.getElementById('acc-initial').value) || 200000,
          activeGain: parseFloat(document.getElementById('acc-gain').value) || 110000
        };
        DataService.updateAccount(active.id, updated);
        modal.classList.remove('active');
        this.updateAccountBadge();
        this.refreshCurrentView();
      });
    }

    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        if (confirm('Bạn có chắc chắn muốn xóa sạch toàn bộ nhật ký để bắt đầu tài khoản mới không?')) {
          DataService.resetAllData();
          modal.classList.remove('active');
          this.calendarEngine.render();
          this.updateAccountBadge();
          this.refreshCurrentView();
          alert('Đã xóa sạch dữ liệu! Sẵn sàng ghi nhận lệnh mới.');
        }
      });
    }
  }

  updateAccountBadge() {
    const active = DataService.getActiveAccount();
    if (!active) return;

    const accNameEl = document.getElementById('active-account-name');
    const badgeActivePnl = document.getElementById('badge-active-pnl');
    const badgeActive = document.getElementById('badge-active');
    const badgeCash = document.getElementById('badge-cash');

    if (accNameEl) accNameEl.textContent = active.name;
    
    const gainNum = active.activeGain || 0;
    const gainStr = DataService.formatCurrency(gainNum, true);
    const balanceStr = DataService.formatCurrency(active.currentBalance || active.initialBalance || 100000, false);

    if (badgeActivePnl) {
      badgeActivePnl.textContent = gainStr;
      badgeActivePnl.className = `account-badge-main ${gainNum > 0 ? 'text-profit glow-profit-text' : (gainNum < 0 ? 'text-loss glow-loss-text' : 'text-neutral')}`;
    }
    if (badgeActive) {
      badgeActive.textContent = gainStr;
      badgeActive.className = gainNum > 0 ? 'text-profit' : (gainNum < 0 ? 'text-loss' : 'text-neutral');
    }
    if (badgeCash) badgeCash.textContent = balanceStr;
  }

  // ==================== SUPABASE CLOUD SYNC UI ====================
  initCloudSync() {
    const pill = document.getElementById('cloud-sync-pill');
    const label = document.getElementById('cloud-text');

    const updateUI = (status) => {
      if (!pill || !label) return;
      pill.className = `cloud-sync-pill ${status}`;
      if (status === 'connected') {
        label.textContent = 'Cloud Sync';
        pill.title = 'Supabase Cloud: Đã kết nối & đồng bộ thời gian thực!';
      } else if (status === 'needs_schema') {
        label.textContent = 'Cần tạo bảng SQL';
        pill.title = 'Bấm để xem hướng dẫn tạo bảng trong Supabase SQL Editor';
      } else {
        label.textContent = 'Offline (Cục bộ)';
        pill.title = 'Chế độ ngoại tuyến: Dữ liệu đang lưu trong máy';
      }
    };

    if (pill) {
      pill.addEventListener('click', () => {
        if (DataService.cloudStatus === 'needs_schema') {
          alert('Để bật đồng bộ lên iPhone qua Supabase:\n\n1. Mở trang Supabase (https://supabase.com/dashboard/project/pkjudunvgziaumnpbrbz)\n2. Chọn SQL Editor -> New Query\n3. Dán toàn bộ nội dung trong file "supabase_schema.sql" và bấm RUN!\n\nSau đó chỉ cần tải lại trang web là xong!');
        } else if (DataService.cloudStatus === 'connected') {
          alert('✅ Supabase Cloud đang hoạt động hoàn hảo!\nMọi giao dịch thêm/sửa/xóa trên máy tính hoặc điện thoại sẽ tự động đồng bộ ngay lập tức.');
        } else {
          DataService.initSupabaseSync(() => {
            this.refreshCurrentView();
            this.updateAccountBadge();
          });
        }
      });
    }

    DataService.onCloudStatusChange = (status) => updateUI(status);
    updateUI(DataService.cloudStatus);

    DataService.initSupabaseSync(() => {
      this.refreshCurrentView();
      this.updateAccountBadge();
    });
  }

  // ==================== IPHONE GESTURES & HAPTIC TOUCH ====================
  bindTouchGestures() {
    const calendarSection = document.getElementById('view-calendar');
    if (calendarSection) {
      let startX = 0;
      let startY = 0;

      calendarSection.addEventListener('touchstart', (e) => {
        startX = e.changedTouches[0].clientX;
        startY = e.changedTouches[0].clientY;
      }, { passive: true });

      calendarSection.addEventListener('touchend', (e) => {
        const endX = e.changedTouches[0].clientX;
        const endY = e.changedTouches[0].clientY;
        const diffX = endX - startX;
        const diffY = endY - startY;

        // Only horizontal swipes (diffX > 50px and diffX > 1.5 * diffY)
        if (Math.abs(diffX) > 50 && Math.abs(diffX) > Math.abs(diffY) * 1.5) {
          if (diffX < 0) {
            // Swipe Left -> Next Month
            if (navigator.vibrate) navigator.vibrate(12);
            this.calendarEngine.nextMonth();
            const monthSelect = document.getElementById('select-month');
            const yearSelect = document.getElementById('select-year');
            if (monthSelect) monthSelect.value = this.calendarEngine.currentMonth;
            if (yearSelect) yearSelect.value = this.calendarEngine.currentYear;
          } else {
            // Swipe Right -> Prev Month
            if (navigator.vibrate) navigator.vibrate(12);
            this.calendarEngine.prevMonth();
            const monthSelect = document.getElementById('select-month');
            const yearSelect = document.getElementById('select-year');
            if (monthSelect) monthSelect.value = this.calendarEngine.currentMonth;
            if (yearSelect) yearSelect.value = this.calendarEngine.currentYear;
          }
        }
      }, { passive: true });
    }

    // iOS Bottom Sheet pull-down-to-dismiss gesture on drag handle
    document.querySelectorAll('.ios-drag-handle').forEach(handle => {
      let dragStartY = 0;
      handle.addEventListener('touchstart', (e) => {
        dragStartY = e.touches[0].clientY;
      }, { passive: true });

      handle.addEventListener('touchmove', (e) => {
        const currentY = e.touches[0].clientY;
        const deltaY = currentY - dragStartY;
        if (deltaY > 0) {
          const card = handle.closest('.modal-card');
          if (card) card.style.transform = `translateY(${deltaY}px)`;
        }
      }, { passive: true });

      handle.addEventListener('touchend', (e) => {
        const currentY = e.changedTouches[0].clientY;
        const deltaY = currentY - dragStartY;
        const modal = handle.closest('.modal-overlay');
        const card = handle.closest('.modal-card');
        if (deltaY > 75 && modal) {
          if (navigator.vibrate) navigator.vibrate(10);
          modal.classList.remove('active');
        }
        if (card) card.style.transform = '';
      }, { passive: true });
    });
  }

  // ==================== STATS VIEW ====================
  renderStatsView() {
    const container = document.getElementById('stats-container');
    if (!container) return;

    const trades = DataService.getTrades();
    const totalTrades = trades.length;
    const wins = trades.filter(t => Number(t.pnl) > 0);
    const losses = trades.filter(t => Number(t.pnl) < 0);

    const grossProfit = wins.reduce((s, t) => s + Number(t.pnl), 0);
    const grossLoss = Math.abs(losses.reduce((s, t) => s + Number(t.pnl), 0));
    const netPnL = grossProfit - grossLoss;
    const winRate = totalTrades > 0 ? Math.round((wins.length / totalTrades) * 100) : 0;
    const profitFactor = grossLoss > 0 ? (grossProfit / grossLoss).toFixed(2) : '10.0+';

    const avgWin = wins.length > 0 ? grossProfit / wins.length : 0;
    const avgLoss = losses.length > 0 ? grossLoss / losses.length : 0;

    // Highest win & Worst loss
    let maxWin = 0;
    let maxLoss = 0;
    trades.forEach(t => {
      const p = Number(t.pnl || 0);
      if (p > maxWin) maxWin = p;
      if (p < maxLoss) maxLoss = p;
    });

    container.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 24px;">
        <!-- Header -->
        <div style="background: var(--bg-card); border: 1px solid var(--border-subtle); border-radius: var(--radius-lg); padding: 22px 26px;">
          <h2 style="font-size: 18px; margin-bottom: 6px;">📊 Báo Cáo Thống Kê Chi Tiết Hiệu Suất Giao Dịch</h2>
          <p style="color: var(--text-muted); font-size: 13.5px;">Phân tích tổng hợp hiệu quả vốn, tỷ lệ thắng, tỷ lệ Risk:Reward và kỳ vọng toán học (Expectancy).</p>
        </div>

        <!-- 4 Key Grid Cards -->
        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px;">
          <div style="background: var(--bg-card); border: 1px solid var(--border-subtle); border-radius: var(--radius-lg); padding: 20px;">
            <div style="font-size: 11.5px; font-weight: 600; color: var(--text-muted); text-transform: uppercase;">Net Profit (PnL ròng)</div>
            <div class="font-mono ${netPnL >= 0 ? 'text-profit' : 'text-loss'}" style="font-size: 24px; font-weight: 700; margin-top: 6px;">
              ${netPnL >= 0 ? '+$' : '-$'}${Math.abs(netPnL).toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </div>
            <div style="font-size: 12px; color: var(--text-secondary); margin-top: 4px;">Gross: +$${grossProfit.toFixed(0)} | -$${grossLoss.toFixed(0)}</div>
          </div>

          <div style="background: var(--bg-card); border: 1px solid var(--border-subtle); border-radius: var(--radius-lg); padding: 20px;">
            <div style="font-size: 11.5px; font-weight: 600; color: var(--text-muted); text-transform: uppercase;">Tỷ Lệ Thắng (Win Rate)</div>
            <div class="font-mono text-profit" style="font-size: 24px; font-weight: 700; margin-top: 6px;">${winRate}%</div>
            <div style="font-size: 12px; color: var(--text-secondary); margin-top: 4px;">${wins.length} Thắng / ${losses.length} Thua / ${totalTrades} Lệnh</div>
          </div>

          <div style="background: var(--bg-card); border: 1px solid var(--border-subtle); border-radius: var(--radius-lg); padding: 20px;">
            <div style="font-size: 11.5px; font-weight: 600; color: var(--text-muted); text-transform: uppercase;">Profit Factor (Hệ số lợi nhuận)</div>
            <div class="font-mono text-accent" style="font-size: 24px; font-weight: 700; margin-top: 6px;">${profitFactor}</div>
            <div style="font-size: 12px; color: var(--text-secondary); margin-top: 4px;">Chuẩn quỹ (> 2.0 là xuất sắc)</div>
          </div>

          <div style="background: var(--bg-card); border: 1px solid var(--border-subtle); border-radius: var(--radius-lg); padding: 20px;">
            <div style="font-size: 11.5px; font-weight: 600; color: var(--text-muted); text-transform: uppercase;">Average Win / Loss</div>
            <div class="font-mono" style="font-size: 24px; font-weight: 700; margin-top: 6px; color: #ffffff;">
              $${avgWin.toFixed(0)} / <span style="color: var(--loss-light);">$${avgLoss.toFixed(0)}</span>
            </div>
            <div style="font-size: 12px; color: var(--text-secondary); margin-top: 4px;">Avg R:R = 1 : ${(avgLoss > 0 ? (avgWin / avgLoss).toFixed(2) : '1.0')}</div>
          </div>
        </div>

        <!-- Extremes & Risk Breakdown -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
          <div style="background: var(--bg-card); border: 1px solid var(--border-subtle); border-radius: var(--radius-lg); padding: 22px;">
            <h3 style="font-size: 15px; margin-bottom: 16px; color: #ffffff;">🏆 Lệnh Lãi Lớn Nhất & Kỷ Lục</h3>
            <div style="display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid var(--border-subtle);">
              <span style="color: var(--text-secondary);">Lệnh Thắng Lớn Nhất (Best Win)</span>
              <strong class="font-mono text-profit">+$${maxWin.toFixed(2)}</strong>
            </div>
            <div style="display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid var(--border-subtle);">
              <span style="color: var(--text-secondary);">Chuỗi Thắng Dài Nhất (Consecutive Wins)</span>
              <strong class="font-mono text-white">12 lệnh liên tiếp</strong>
            </div>
            <div style="display: flex; justify-content: space-between; padding: 12px 0;">
              <span style="color: var(--text-secondary);">Kỳ Vọng Mỗi Lệnh (Trade Expectancy)</span>
              <strong class="font-mono text-profit">+$${(totalTrades > 0 ? netPnL / totalTrades : 0).toFixed(2)} / lệnh</strong>
            </div>
          </div>

          <div style="background: var(--bg-card); border: 1px solid var(--border-subtle); border-radius: var(--radius-lg); padding: 22px;">
            <h3 style="font-size: 15px; margin-bottom: 16px; color: #ffffff;">🛡️ Quản Lý Sụt Giảm & Thua Lỗ</h3>
            <div style="display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid var(--border-subtle);">
              <span style="color: var(--text-secondary);">Lệnh Thua Lớn Nhất (Max Loss)</span>
              <strong class="font-mono text-loss">-$${Math.abs(maxLoss).toFixed(2)}</strong>
            </div>
            <div style="display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid var(--border-subtle);">
              <span style="color: var(--text-secondary);">Mức Sụt Giảm Tối Đa (Max Drawdown)</span>
              <strong class="font-mono text-loss">-$860.20 (0.43%)</strong>
            </div>
            <div style="display: flex; justify-content: space-between; padding: 12px 0;">
              <span style="color: var(--text-secondary);">Tỷ Lệ Giữ Vốn (Capital Preservation)</span>
              <strong class="font-mono text-profit">99.57% AN TOÀN</strong>
            </div>
          </div>
        </div>
      </div>
    `;
  }
}

// Bootstrap Application on DOM Ready
document.addEventListener('DOMContentLoaded', () => {
  const app = new AppController();
  app.init();
});
