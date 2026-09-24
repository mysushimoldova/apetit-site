// Типы таблиц Supabase — вручную, по supabase/migrations/000*.sql.
// Кодогенерации нет (CLI Supabase не ставим): меняешь схему — меняй здесь.
// type, а не interface: supabase-js требует Record<string, unknown>, а у
// interface нет индексной сигнатуры.
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type OrderStatus = "new" | "accepted" | "cancelled";

export type OrderRow = {
  id: string;
  /** Сквозной номер, с 1001 (sequence) */
  number: number;
  point_id: string;
  city: string;
  lang: string;
  name: string;
  /** Нормализованный: +373XXXXXXXX; после анонимизации — '' */
  phone: string;
  address: string | null;
  /** Снимок позиций (ReceiptLine[]) на момент заказа */
  items: Json;
  /** Лей, посчитано сервером */
  total: number;
  status: OrderStatus;
  created_at: string;
  accepted_at: string | null;
  ip_hash: string | null;
  dedup_hash: string;
  telegram_message_id: number | null;
  /** Заказ оставлен прогоном тестов (0005): Telegram и напоминания его не видят */
  is_test: boolean;
  /** Сколько напоминаний «⏰ ждёт» ушло точке, до reminderMax (0002) */
  reminders_sent: number;
  last_reminder_at: string | null;
  /** Почему заказ не ушёл в Telegram (null — ушёл или ещё не пробовали) */
  telegram_error: string | null;
  /** Сколько сообщений владельцам ушло (0003) */
  owner_alerts_sent: number;
  last_owner_alert_at: string | null;
};

export type OrderInsert = {
  id?: string;
  number?: number;
  point_id: string;
  city: string;
  lang: string;
  name: string;
  phone: string;
  address?: string | null;
  items: Json;
  total: number;
  status?: OrderStatus;
  created_at?: string;
  accepted_at?: string | null;
  ip_hash?: string | null;
  dedup_hash: string;
  telegram_message_id?: number | null;
  is_test?: boolean;
  reminders_sent?: number;
  last_reminder_at?: string | null;
  telegram_error?: string | null;
  owner_alerts_sent?: number;
  last_owner_alert_at?: string | null;
};

export type TelegramChatRow = {
  point_id: string;
  chat_id: number;
  title: string | null;
  linked_at: string;
};

export type OwnerChatRow = {
  chat_id: number;
  label: string | null;
  linked_at: string;
};

export type TelegramCodeRow = {
  code: string;
  kind: "point" | "owner";
  point_id: string | null;
  label: string;
  created_at: string;
};

export type SettingRow = {
  key: string;
  value: Json;
  updated_at: string;
};

export type Database = {
  public: {
    Tables: {
      orders: {
        Row: OrderRow;
        Insert: OrderInsert;
        Update: Partial<OrderInsert>;
        Relationships: [];
      };
      settings: {
        Row: SettingRow;
        Insert: { key: string; value: Json; updated_at?: string };
        Update: { key?: string; value?: Json; updated_at?: string };
        Relationships: [];
      };
      telegram_chats: {
        Row: TelegramChatRow;
        Insert: {
          point_id: string;
          chat_id: number;
          title?: string | null;
          linked_at?: string;
        };
        Update: Partial<TelegramChatRow>;
        Relationships: [];
      };
      owner_chats: {
        Row: OwnerChatRow;
        Insert: { chat_id: number; label?: string | null; linked_at?: string };
        Update: Partial<OwnerChatRow>;
        Relationships: [];
      };
      telegram_codes: {
        Row: TelegramCodeRow;
        Insert: {
          code: string;
          kind: "point" | "owner";
          point_id?: string | null;
          label: string;
          created_at?: string;
        };
        Update: Partial<TelegramCodeRow>;
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      /** Заказам старше 365 дней стирает имя, телефон, адрес; возвращает число строк */
      anonymize_old_orders: { Args: Record<string, never>; Returns: number };
      /** Дубль → лимиты → INSERT в одной транзакции; jsonb с outcome
       *  (0002, параметр p_is_test добавлен в 0006) */
      place_order: {
        Args: {
          p_point_id: string;
          p_city: string;
          p_lang: string;
          p_name: string;
          p_phone: string;
          p_address: string | null;
          p_items: Json;
          p_total: number;
          p_ip_hash: string | null;
          p_dedup_hash: string;
          p_now: string;
          p_dedup_seconds: number;
          p_phone_limit: number;
          p_phone_window_seconds: number;
          p_ip_limit: number;
          p_ip_window_seconds: number;
          /** Пометка «заказ из прогона тестов». Передаётся только когда
           *  true — обычный заказ зовёт функцию без этого параметра, как до
           *  миграции 0006 (см. src/server/orders/store.ts). */
          p_is_test?: boolean;
        };
        Returns: Json;
      };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
