export interface User {
  id: string;
  username: string;
  role: 'staff' | 'admin';
  shop_id: string | null;
  created_at: string;
}

export interface Shop {
  id: string;
  name: string;
  created_at: string;
}

export interface ProductType {
  id: string;
  name: string;
  created_at: string;
}

export interface ProductSize {
  id: string;
  size_ml: number;
  created_at: string;
}

export interface Product {
  id: string;
  brand_name: string;
  type_id: string;
  size_id: string;
  mrp: number;
  shop_id: string;
  is_active: boolean;
  created_at: string;
  product_type?: ProductType;
  product_size?: ProductSize;
}

export interface DailyStockEntry {
  id: string;
  shop_id: string;
  product_id: string;
  entry_date: string;
  opening_stock: number;
  purchases: number;
  transfer: number;
  closing_stock: number;
  sold_qty: number;
  sale_value: number;
  closing_stock_value: number;
  created_at: string;
  updated_at: string;
  product?: Product;
}

export interface DailyCashEntry {
  id: string;
  shop_id: string;
  entry_date: string;
  counter_opening: number;
  total_sale_value: number;
  denom_500: number;
  denom_200: number;
  denom_100: number;
  denom_50: number;
  denom_20: number;
  denom_10: number;
  denom_5: number;
  denom_2: number;
  denom_1: number;
  coins: number;
  total_cash: number;
  google_pay: number;
  phonepe_paytm: number;
  bank_transfer: number;
  total_upi_bank: number;
  bank_deposit: number;
  cash_to_house: number;
  cash_shortage: number;
  total_bottles_sold: number;
  counter_closing: number;
  is_locked: boolean;
  is_approved: boolean;
  unlock_requested: boolean;
  locked_at: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ExtraTransaction {
  id: string;
  cash_entry_id: string;
  transaction_type: 'income' | 'expense';
  description: string;
  amount: number;
  created_at: string;
}

export interface ApprovalRequest {
  id: string;
  shop_id: string;
  entry_date: string;
  request_type: 'lock' | 'unlock';
  requested_by: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  resolved_at: string | null;
}

export interface PDFArchive {
  id: string;
  shop_id: string;
  entry_date: string;
  file_path: string;
  file_name: string;
  month_year: string;
  created_at: string;
}

export interface CreditEntry {
  id?: string;
  shop_id?: string;
  entry_date?: string;
  person_name: string;
  amount: number;
  created_at?: string;
  updated_at?: string;
}

export interface Debtor {
  id: string;
  shop_id: string;
  person_name: string;
  created_at: string;
}
