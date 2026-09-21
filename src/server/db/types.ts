// Типы таблиц Supabase — вручную, по supabase/migrations/0001_orders.sql.
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
    };
    Views: { [_ in never]: never };
    Functions: {
      /** Заказам старше 365 дней стирает имя, телефон, адрес; возвращает число строк */
      anonymize_old_orders: { Args: Record<string, never>; Returns: number };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
