-- ==============================================================================
-- MY PNL - SUPABASE DATABASE SCHEMA & REALTIME SYNC
-- Copy và dán toàn bộ đoạn code này vào Supabase -> SQL Editor -> Bấm RUN
-- ==============================================================================

-- 1. BẢNG TRADES (Giao dịch & PnL hàng ngày)
CREATE TABLE IF NOT EXISTS public.trades (
    id TEXT PRIMARY KEY,
    date TEXT NOT NULL,
    time TEXT DEFAULT '12:00',
    symbol TEXT DEFAULT 'XAUUSD',
    side TEXT DEFAULT 'PROFIT',
    entry NUMERIC DEFAULT 0,
    exit NUMERIC DEFAULT 0,
    lots NUMERIC DEFAULT 1,
    pnl NUMERIC NOT NULL,
    strategy TEXT DEFAULT '',
    notes TEXT DEFAULT '',
    account TEXT DEFAULT 'acc_main',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. BẢNG ACCOUNTS (Tài khoản vốn giao dịch)
CREATE TABLE IF NOT EXISTS public.accounts (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    "initialBalance" NUMERIC DEFAULT 100000,
    "currentBalance" NUMERIC DEFAULT 100000,
    "activeGain" NUMERIC DEFAULT 0,
    currency TEXT DEFAULT '$',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. BẢNG DIARY (Nhật ký tâm lý giao dịch)
CREATE TABLE IF NOT EXISTS public.diary (
    id TEXT PRIMARY KEY,
    date TEXT NOT NULL,
    title TEXT DEFAULT '',
    content TEXT DEFAULT '',
    mood TEXT DEFAULT 'CALM',
    "disciplineScore" NUMERIC DEFAULT 5,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- KÍCH HOẠT ROW LEVEL SECURITY (RLS)
ALTER TABLE public.trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.diary ENABLE ROW LEVEL SECURITY;

-- CHÍNH SÁCH ĐỌC / GHI CÔNG KHAI BẰNG PUBLISHABLE KEY
DROP POLICY IF EXISTS "Public access trades" ON public.trades;
CREATE POLICY "Public access trades" ON public.trades FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public access accounts" ON public.accounts;
CREATE POLICY "Public access accounts" ON public.accounts FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public access diary" ON public.diary;
CREATE POLICY "Public access diary" ON public.diary FOR ALL USING (true) WITH CHECK (true);

-- BẬT REALTIME REPLICATION (ĐỒNG BỘ TỨC THÌ GIỮA ĐIỆN THOẠI & MÁY TÍNH)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'trades'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.trades;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'accounts'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.accounts;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'diary'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.diary;
  END IF;
END $$;
