// ==============================================================================
// DATA MANAGEMENT MODULE (HYBRID LOCALSTORAGE + SUPABASE CLOUD REALTIME)
// ==============================================================================

import { supabase } from './supabaseClient.js';

const STORAGE_KEYS = {
  TRADES: 'mypnl_trades_user_data_v1',
  ACCOUNTS: 'mypnl_accounts_user_data_v1',
  ACTIVE_ACCOUNT: 'mypnl_active_account_user_data_v1',
  DIARY: 'mypnl_diary_user_data_v1',
  CURRENCY: 'mypnl_currency_mode_v1',
  EXCHANGE_RATE: 'mypnl_exchange_rate_v1'
};

// Default Clean Account
const defaultAccounts = [
  { 
    id: 'acc_main', 
    name: 'Tài Khoản Giao Dịch Chính', 
    initialBalance: 100, 
    currentBalance: 100, 
    activeGain: 0, 
    currency: '$' 
  }
];

// Completely clean empty trade list
const initialTrades = [];

// Completely clean empty diary list
const defaultDiary = [];

// Data Service
export const DataService = {
  cloudStatus: 'connecting', // 'connected' | 'offline' | 'needs_schema'
  onCloudStatusChange: null,

  getCurrency() {
    return localStorage.getItem(STORAGE_KEYS.CURRENCY) || 'USD';
  },

  setCurrency(curr) {
    const val = curr === 'VND' ? 'VND' : 'USD';
    localStorage.setItem(STORAGE_KEYS.CURRENCY, val);
    return val;
  },

  getExchangeRate() {
    const val = localStorage.getItem(STORAGE_KEYS.EXCHANGE_RATE);
    return val ? parseFloat(val) : 25400;
  },

  setExchangeRate(rate) {
    if (rate && !isNaN(rate) && rate > 0) {
      localStorage.setItem(STORAGE_KEYS.EXCHANGE_RATE, String(rate));
    }
  },

  formatCurrency(num, showSign = true) {
    const currency = this.getCurrency();
    const rate = this.getExchangeRate();
    const n = Number(num || 0);

    if (currency === 'VND') {
      const vndVal = Math.round(n * rate);
      const isNeg = vndVal < 0;
      const abs = Math.abs(vndVal);
      const sign = isNeg ? '-' : (showSign && vndVal > 0 ? '+' : '');
      return `${sign}${abs.toLocaleString('vi-VN')} ₫`;
    } else {
      if (!n || n === 0) return '$0.00';
      const isNeg = n < 0;
      const abs = Math.abs(n);
      const sign = isNeg ? '-$' : (showSign && n > 0 ? '+$' : '$');
      return `${sign}${abs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
  },

  getTrades() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.TRADES);
      if (!data) {
        this.saveTrades(initialTrades);
        return initialTrades;
      }
      return JSON.parse(data);
    } catch (e) {
      console.error('Failed to load trades:', e);
      return initialTrades;
    }
  },

  saveTrades(trades) {
    localStorage.setItem(STORAGE_KEYS.TRADES, JSON.stringify(trades));
  },

  addTrade(trade) {
    const trades = this.getTrades();
    const newTrade = {
      ...trade,
      id: trade.id || 'trade_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4)
    };
    trades.unshift(newTrade);
    this.saveTrades(trades);

    // Sync to Supabase Cloud asynchronously
    this.syncTradeToSupabase(newTrade);

    return newTrade;
  },

  updateTrade(id, updatedData) {
    const trades = this.getTrades();
    const index = trades.findIndex(t => t.id === id);
    if (index !== -1) {
      trades[index] = { ...trades[index], ...updatedData };
      this.saveTrades(trades);

      // Sync to Supabase Cloud
      this.syncTradeToSupabase(trades[index]);

      return trades[index];
    }
    return null;
  },

  deleteTrade(id) {
    let trades = this.getTrades();
    trades = trades.filter(t => t.id !== id);
    this.saveTrades(trades);

    // Sync deletion to Supabase Cloud
    this.deleteTradeFromSupabase(id);

    return true;
  },

  async clearAllTrades() {
    this.saveTrades([]);
    try {
      await supabase.from('trades').delete().neq('id', '___none___');
      console.log('🗑️ Đã xóa sạch dữ liệu giao dịch trên Supabase Cloud.');
    } catch (e) {
      console.warn('Supabase delete failed:', e);
    }
  },

  getAccounts() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.ACCOUNTS);
      if (!data) {
        localStorage.setItem(STORAGE_KEYS.ACCOUNTS, JSON.stringify(defaultAccounts));
        return defaultAccounts;
      }
      return JSON.parse(data);
    } catch {
      return defaultAccounts;
    }
  },

  getActiveAccount() {
    const accounts = this.getAccounts();
    const activeId = localStorage.getItem(STORAGE_KEYS.ACTIVE_ACCOUNT);
    return accounts.find(a => a.id === activeId) || accounts[0];
  },

  setActiveAccount(accountId) {
    localStorage.setItem(STORAGE_KEYS.ACTIVE_ACCOUNT, accountId);
  },

  updateAccount(accountId, updatedData) {
    const accounts = this.getAccounts();
    const idx = accounts.findIndex(a => a.id === accountId);
    if (idx !== -1) {
      accounts[idx] = { ...accounts[idx], ...updatedData };
      localStorage.setItem(STORAGE_KEYS.ACCOUNTS, JSON.stringify(accounts));
      return accounts[idx];
    }
    return null;
  },

  getDiary() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.DIARY);
      if (!data) {
        localStorage.setItem(STORAGE_KEYS.DIARY, JSON.stringify(defaultDiary));
        return defaultDiary;
      }
      return JSON.parse(data);
    } catch {
      return defaultDiary;
    }
  },

  addDiary(entry) {
    const diary = this.getDiary();
    const newEntry = {
      ...entry,
      id: entry.id || 'diary_' + Date.now()
    };
    diary.unshift(newEntry);
    localStorage.setItem(STORAGE_KEYS.DIARY, JSON.stringify(diary));

    // Sync to Supabase Cloud
    this.syncDiaryToSupabase(newEntry);

    return newEntry;
  },

  clearAllDiary() {
    localStorage.setItem(STORAGE_KEYS.DIARY, JSON.stringify([]));
  },

  setDailyPnL({ date, pnl, notes = '', symbol = 'DAILY' }) {
    let trades = this.getTrades();
    // Remove existing trades for this date if user sets simple daily PnL
    const removedTrades = trades.filter(t => t.date === date);
    trades = trades.filter(t => t.date !== date);
    
    const newTrade = {
      id: 'trade_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      date,
      time: '12:00',
      symbol: symbol || (pnl >= 0 ? 'WIN DAY' : 'LOSS DAY'),
      side: pnl >= 0 ? 'PROFIT' : 'LOSS',
      entry: 0,
      exit: 0,
      lots: 1,
      pnl: Number(pnl),
      strategy: pnl >= 0 ? 'Chiến thuật chuẩn' : 'Quản lý vốn',
      notes: notes || '',
      account: this.getActiveAccount()?.id || 'acc_main'
    };
    trades.unshift(newTrade);
    this.saveTrades(trades);

    // Delete old date trades in Supabase and insert new
    removedTrades.forEach(t => this.deleteTradeFromSupabase(t.id));
    this.syncTradeToSupabase(newTrade);

    return newTrade;
  },

  deleteTradesForDate(dateStr) {
    let trades = this.getTrades();
    const toDelete = trades.filter(t => t.date === dateStr);
    trades = trades.filter(t => t.date !== dateStr);
    this.saveTrades(trades);

    toDelete.forEach(t => this.deleteTradeFromSupabase(t.id));
    return true;
  },

  loadDemoData(targetYear, targetMonth) {
    const y = targetYear || new Date().getFullYear();
    const m = typeof targetMonth === 'number' ? targetMonth : new Date().getMonth();
    const monthStr = String(m + 1).padStart(2, '0');

    const demoTrades = [
      { day: 1, pnl: 450.00, sym: 'XAUUSD', notes: 'Bắt đáy phiên Âu đẹp' },
      { day: 2, pnl: 820.00, sym: 'BTCUSDT', notes: 'Long breakout cản' },
      { day: 5, pnl: -240.00, sym: 'EURUSD', notes: 'Dính stoploss ngắn' },
      { day: 6, pnl: 610.00, sym: 'XAUUSD', notes: 'Sonic R Dragon trend' },
      { day: 7, pnl: 380.00, sym: 'US30', notes: 'Scalping phiên Mỹ' },
      { day: 8, pnl: 1150.00, sym: 'XAUUSD', notes: 'Ăn trọn sóng tin CPI' },
      { day: 9, pnl: -180.00, sym: 'GBPUSD', notes: 'Cut lỗ bảo toàn vốn' },
      { day: 12, pnl: 520.00, sym: 'BTCUSDT', notes: 'Cản POC rút chân' },
      { day: 13, pnl: 740.00, sym: 'XAUUSD', notes: 'Short đỉnh Ping-pong' },
      { day: 14, pnl: -320.00, sym: 'NAS100', notes: 'FOMO vào sớm' },
      { day: 15, pnl: 890.00, sym: 'XAUUSD', notes: 'Kỷ luật gỡ lại xuất sắc' },
      { day: 16, pnl: 650.00, sym: 'ETHUSDT', notes: 'Chốt lời target 1' },
      { day: 19, pnl: 430.00, sym: 'XAUUSD', notes: 'Follow trend EMA 89' },
      { day: 20, pnl: -150.00, sym: 'USDJPY', notes: 'Sideway khó chịu' },
      { day: 21, pnl: 960.00, sym: 'XAUUSD', notes: 'Hôm nay thắng lớn!' },
      { day: 22, pnl: 310.00, sym: 'BTCUSDT', notes: 'Scalping nhẹ nhàng' },
      { day: 23, pnl: 780.00, sym: 'US30', notes: 'Phiên Mỹ bùng nổ' },
      { day: 26, pnl: 540.00, sym: 'XAUUSD', notes: 'Dragon Wave test hỗ trợ' },
      { day: 27, pnl: -210.00, sym: 'EURUSD', notes: 'Cắt lỗ đúng kế hoạch' },
      { day: 28, pnl: 1250.00, sym: 'XAUUSD', notes: 'Super win ngày FOMC' },
    ];

    const generated = demoTrades.map((d, i) => {
      const dayStr = String(d.day).padStart(2, '0');
      const date = `${y}-${monthStr}-${dayStr}`;
      return {
        id: 'demo_' + Date.now() + '_' + i,
        date,
        time: '14:30',
        symbol: d.sym,
        side: d.pnl >= 0 ? 'LONG' : 'SHORT',
        entry: 2650.0,
        exit: 2665.0,
        lots: 0.5,
        pnl: d.pnl,
        strategy: 'Sonic R Dragon Trend',
        notes: d.notes,
        account: 'acc_main'
      };
    });

    this.saveTrades(generated);

    // Sync demo trades to Supabase Cloud
    generated.forEach(t => this.syncTradeToSupabase(t));

    return generated;
  },

  exportDataJSON() {
    const data = {
      trades: this.getTrades(),
      accounts: this.getAccounts(),
      diary: this.getDiary(),
      exportDate: new Date().toISOString()
    };
    const jsonStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(data, null, 2));
    const dlAnchor = document.createElement('a');
    dlAnchor.setAttribute("href", jsonStr);
    dlAnchor.setAttribute("download", `MyPnL_Trading_Journal_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(dlAnchor);
    dlAnchor.click();
    dlAnchor.remove();
  },

  exportDataCSV() {
    const trades = this.getTrades();
    if (trades.length === 0) {
      alert('Chưa có dữ liệu giao dịch để xuất file CSV!');
      return;
    }
    const headers = ['Date', 'Symbol', 'Side', 'PnL ($)', 'Notes'];
    const rows = trades.map(t => [
      `"${t.date}"`,
      `"${t.symbol || ''}"`,
      `"${t.side || ''}"`,
      t.pnl,
      `"${(t.notes || '').replace(/"/g, '""')}"`
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `MyPnL_Trades_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
  },

  async resetAllData() {
    this.saveTrades([]);
    localStorage.setItem(STORAGE_KEYS.ACCOUNTS, JSON.stringify(defaultAccounts));
    localStorage.setItem(STORAGE_KEYS.ACTIVE_ACCOUNT, defaultAccounts[0].id);
    localStorage.setItem(STORAGE_KEYS.DIARY, JSON.stringify([]));

    try {
      await supabase.from('trades').delete().neq('id', '___none___');
      console.log('🗑️ Đã xóa sạch toàn bộ dữ liệu trên Supabase Cloud.');
    } catch (e) {
      console.warn('Supabase reset failed (offline/no schema):', e);
    }
  },

  // ==================== SUPABASE CLOUD SYNC ENGINE ====================

  async initSupabaseSync(onUpdateCallback) {
    try {
      console.log('🔄 Đang kết nối Supabase Cloud...');
      const { data, error } = await supabase
        .from('trades')
        .select('*')
        .order('date', { ascending: false });

      if (error) {
        if (error.code === 'PGRST205' || error.message?.includes('schema cache')) {
          this.cloudStatus = 'needs_schema';
          console.warn('⚠️ Supabase: Chưa tạo bảng "trades". Vui lòng chạy file supabase_schema.sql trong Supabase SQL Editor.');
        } else {
          this.cloudStatus = 'offline';
          console.warn('⚠️ Supabase sync error:', error.message);
        }
      } else {
        this.cloudStatus = 'connected';
        console.log(`✅ Supabase Cloud kết nối thành công! Đã tải ${data ? data.length : 0} giao dịch.`);

        // If cloud has trades, merge or sync to local
        if (data && data.length > 0) {
          this.saveTrades(data);
          if (onUpdateCallback) onUpdateCallback();
        } else {
          // If cloud is empty but local has trades, push local trades to cloud
          const localTrades = this.getTrades();
          if (localTrades && localTrades.length > 0) {
            console.log(`📤 Đang đẩy ${localTrades.length} giao dịch từ máy lên Supabase Cloud...`);
            await supabase.from('trades').upsert(localTrades);
          }
        }
      }
    } catch (err) {
      this.cloudStatus = 'offline';
      console.warn('⚠️ Không thể kết nối Supabase (Chế độ Ngoại tuyến):', err);
    }

    if (this.onCloudStatusChange) {
      this.onCloudStatusChange(this.cloudStatus);
    }

    // Subscribe to Realtime changes across devices (iPhone <-> Mac)
    this.subscribeRealtime(onUpdateCallback);
  },

  subscribeRealtime(onUpdateCallback) {
    try {
      supabase
        .channel('public:trades_realtime')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'trades' }, async (payload) => {
          console.log('⚡ [Realtime] Phát hiện thay đổi dữ liệu từ thiết bị khác:', payload);
          // Re-fetch all trades and update UI
          const { data } = await supabase.from('trades').select('*').order('date', { ascending: false });
          if (data) {
            this.saveTrades(data);
            if (onUpdateCallback) onUpdateCallback();
          }
        })
        .subscribe();
    } catch (err) {
      console.warn('Realtime subscription error:', err);
    }
  },

  async syncTradeToSupabase(trade) {
    try {
      const payload = {
        id: String(trade.id),
        date: String(trade.date),
        time: trade.time || '12:00',
        symbol: trade.symbol || 'XAUUSD',
        side: trade.side || 'PROFIT',
        entry: Number(trade.entry || 0),
        exit: Number(trade.exit || 0),
        lots: Number(trade.lots || 1),
        pnl: Number(trade.pnl || 0),
        strategy: trade.strategy || '',
        notes: trade.notes || '',
        account: trade.account || 'acc_main'
      };
      const { error } = await supabase.from('trades').upsert([payload]);
      if (error && error.code !== 'PGRST205') {
        console.warn('Lỗi lưu trade lên Supabase:', error.message);
      }
    } catch (e) {
      console.warn('Offline mode - Lưu cục bộ:', e);
    }
  },

  async deleteTradeFromSupabase(id) {
    try {
      await supabase.from('trades').delete().eq('id', id);
    } catch (e) {
      console.warn('Lỗi xóa trade trên Supabase:', e);
    }
  },

  async syncDiaryToSupabase(entry) {
    try {
      await supabase.from('diary').upsert([{
        id: String(entry.id),
        date: String(entry.date),
        title: entry.title || '',
        content: entry.content || '',
        mood: entry.mood || 'CALM',
        disciplineScore: Number(entry.disciplineScore || 5)
      }]);
    } catch (e) {
      console.warn('Lỗi lưu diary lên Supabase:', e);
    }
  }
};
