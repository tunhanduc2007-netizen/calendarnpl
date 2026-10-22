//+------------------------------------------------------------------+
//|                                              tnduck_sync.mq5    |
//|                        Tự Động Đồng Bộ MT5 Với tnduck PnL        |
//|               https://calendarnpl.netlify.app                    |
//+------------------------------------------------------------------+
#property copyright "tnduck PnL"
#property link      "https://calendarnpl.netlify.app"
#property version   "1.00"
#property description "EA tự động đồng bộ kết quả giao dịch từ MT5 lên ứng dụng tnduck PnL theo thời gian thực"

//--- Inputs cấu hình
input group "=== CẤU HÌNH SUPABASE CLOUD ==="
input string InpSupabaseUrl = "https://pkjudunvgziaumnpbrbz.supabase.co/rest/v1/trades"; // Supabase REST URL
input string InpApiKey      = "sb_publishable_5Ozxo5EvjFtnqrGzGLecHg_iUL5LiRK";         // Publishable Key
input string InpAccountId   = "acc_main";                                               // Mã tài khoản (acc_main)
input int    InpSyncDaysBack = 30;                                                      // Số ngày lịch sử đồng bộ lúc khởi động

//--- Global variables
string g_headers = "";

//+------------------------------------------------------------------+
//| Expert initialization function                                   |
//+------------------------------------------------------------------+
int OnInit()
{
   Print("🚀 [tnduck PnL Sync] Đang khởi tạo kết nối MT5 -> Cloud...");
   
   // Thiết lập Headers cho Supabase REST API
   g_headers = "Content-Type: application/json\r\n" +
               "apikey: " + InpApiKey + "\r\n" +
               "Authorization: Bearer " + InpApiKey + "\r\n" +
               "Prefer: resolution=merge-duplicates\r\n";

   // Quét và đồng bộ lịch sử các ngày gần đây
   SyncPastDeals(InpSyncDaysBack);

   Print("✅ [tnduck PnL Sync] Sẵn sàng! Mọi lệnh chốt sẽ tự động gửi lên điện thoại.");
   return(INIT_SUCCEEDED);
}

//+------------------------------------------------------------------+
//| Expert deinitialization function                                 |
//+------------------------------------------------------------------+
void OnDeinit(const int reason)
{
   Print("🛑 [tnduck PnL Sync] Đã dừng.");
}

//+------------------------------------------------------------------+
//| Trade Transaction handler (Bắt sự kiện chốt lệnh thời gian thực)  |
//+------------------------------------------------------------------+
void OnTradeTransaction(const MqlTradeTransaction& trans,
                        const MqlTradeRequest& request,
                        const MqlTradeResult& result)
{
   // Chỉ xử lý khi có Deal được ghi nhận vào lịch sử
   if(trans.type == TRADE_TRANSACTION_DEAL_ADD)
   {
      ulong dealTicket = trans.deal;
      if(dealTicket > 0 && HistoryDealSelect(dealTicket))
      {
         long entry = HistoryDealGetInteger(dealTicket, DEAL_ENTRY);
         // Chỉ gửi khi lệnh đóng (DEAL_ENTRY_OUT) hoặc đóng một phần
         if(entry == DEAL_ENTRY_OUT || entry == DEAL_ENTRY_INOUT || entry == DEAL_ENTRY_OUT_BY)
         {
            SendDealToSupabase(dealTicket);
         }
      }
   }
}

//+------------------------------------------------------------------+
//| Đồng bộ lịch sử các lệnh cũ                                       |
//+------------------------------------------------------------------+
void SyncPastDeals(int daysBack)
{
   datetime fromTime = TimeCurrent() - (daysBack * 86400);
   datetime toTime   = TimeCurrent() + 86400;

   if(!HistorySelect(fromTime, toTime))
   {
      Print("⚠️ [tnduck PnL Sync] Không thể đọc lịch sử deals.");
      return;
   }

   int totalDeals = HistoryDealsTotal();
   int syncedCount = 0;
   PrintFormat("🔄 [tnduck PnL Sync] Đang quét %d deals trong %d ngày qua...", totalDeals, daysBack);

   for(int i = 0; i < totalDeals; i++)
   {
      ulong ticket = HistoryDealGetTicket(i);
      if(ticket > 0)
      {
         long entry = HistoryDealGetInteger(ticket, DEAL_ENTRY);
         if(entry == DEAL_ENTRY_OUT || entry == DEAL_ENTRY_INOUT || entry == DEAL_ENTRY_OUT_BY)
         {
            if(SendDealToSupabase(ticket))
            {
               syncedCount++;
            }
         }
      }
   }

   PrintFormat("✨ [tnduck PnL Sync] Hoàn tất đồng bộ %d lệnh cũ lên Cloud!", syncedCount);
}

//+------------------------------------------------------------------+
//| Gửi một Deal lên Supabase qua WebRequest REST API                |
//+------------------------------------------------------------------+
bool SendDealToSupabase(ulong ticket)
{
   if(!HistoryDealSelect(ticket)) return false;

   string symbol = HistoryDealGetString(ticket, DEAL_SYMBOL);
   if(StringLen(symbol) == 0) symbol = "TRADE";

   double profit     = HistoryDealGetDouble(ticket, DEAL_PROFIT);
   double swap       = HistoryDealGetDouble(ticket, DEAL_SWAP);
   double commission = HistoryDealGetDouble(ticket, DEAL_COMMISSION);
   double netPnL     = profit + swap + commission; // Lãi/Lỗ ròng thực tế

   double volume     = HistoryDealGetDouble(ticket, DEAL_VOLUME);
   double price      = HistoryDealGetDouble(ticket, DEAL_PRICE);
   datetime dealTime = (datetime)HistoryDealGetInteger(ticket, DEAL_TIME);
   long dealType     = HistoryDealGetInteger(ticket, DEAL_TYPE);

   // Tách Ngày và Giờ
   MqlDateTime dt;
   TimeToStruct(dealTime, dt);
   string dateStr = StringFormat("%04d-%02d-%02d", dt.year, dt.mon, dt.day);
   string timeStr = StringFormat("%02d:%02d", dt.hour, dt.min);

   string sideStr = (dealType == DEAL_TYPE_BUY) ? "BUY" : "SELL";
   string idStr   = "mt5_" + IntegerToString(ticket);
   string noteStr = StringFormat("Auto MT5 #%I64u | %s %.2f lot | Giá: %.2f", ticket, sideStr, volume, price);

   // Tạo JSON Body
   string json = StringFormat(
      "{"
      "\"id\":\"%s\","
      "\"date\":\"%s\","
      "\"time\":\"%s\","
      "\"symbol\":\"%s\","
      "\"side\":\"%s\","
      "\"entry\":%.5f,"
      "\"exit\":%.5f,"
      "\"lots\":%.2f,"
      "\"pnl\":%.2f,"
      "\"strategy\":\"MT5 Auto Sync\","
      "\"notes\":\"%s\","
      "\"account\":\"%s\""
      "}",
      idStr, dateStr, timeStr, symbol, (netPnL >= 0 ? "PROFIT" : "LOSS"),
      price, price, volume, netPnL, noteStr, InpAccountId
   );

   char postData[];
   StringToCharArray(json, postData, 0, WHOLE_ARRAY, CP_UTF8);
   // Bỏ ký tự null terminator ở cuối mảng char
   int dataSize = ArraySize(postData) - 1;
   if(dataSize <= 0) return false;
   ArrayResize(postData, dataSize);

   char resultData[];
   string resultHeaders;

   // Gửi WebRequest lên Supabase
   ResetLastError();
   int httpCode = WebRequest("POST", InpSupabaseUrl, g_headers, 5000, postData, resultData, resultHeaders);

   if(httpCode == 200 || httpCode == 201)
   {
      PrintFormat("✅ [tnduck PnL Sync] Đã gửi lệnh MT5 #%I64u (%s PnL: %+.2f$) lên Cloud!", ticket, symbol, netPnL);
      return true;
   }
   else if(httpCode == -1)
   {
      int err = GetLastError();
      if(err == 4014) // ERR_FUNCTION_NOT_ALLOWED
      {
         Print("❌ LỖI MT5: Bạn chưa bật Allow WebRequest!");
         Print("👉 Vào MT5: Tools -> Options -> Expert Advisors -> Tích 'Allow WebRequest for listed URL'");
         Print("👉 Thêm URL: https://pkjudunvgziaumnpbrbz.supabase.co");
      }
      else
      {
         PrintFormat("❌ [tnduck PnL Sync] Lỗi WebRequest (Mã lỗi: %d)", err);
      }
      return false;
   }
   else
   {
      string resp = CharArrayToString(resultData, 0, WHOLE_ARRAY, CP_UTF8);
      PrintFormat("⚠️ [tnduck PnL Sync] Supabase HTTP %d: %s", httpCode, resp);
      return false;
   }
}
//+------------------------------------------------------------------+
