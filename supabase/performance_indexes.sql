-- Performance Optimization Indexes for Wine Shop Management
-- Run these in Supabase SQL Editor to improve query performance

-- Index for daily_stock_entries by shop and date (most common query pattern)
CREATE INDEX IF NOT EXISTS idx_daily_stock_entries_shop_date 
ON daily_stock_entries(shop_id, entry_date);

-- Index for daily_cash_entries by shop and date (most common query pattern)
CREATE INDEX IF NOT EXISTS idx_daily_cash_entries_shop_date 
ON daily_cash_entries(shop_id, entry_date);

-- Index for products by shop and active status (for filtering active products)
CREATE INDEX IF NOT EXISTS idx_products_shop_active 
ON products(shop_id, is_active);

-- Index for credit_entries by cash_entry_id (for joining credit entries with cash entries)
CREATE INDEX IF NOT EXISTS idx_credit_entries_cash_entry 
ON credit_entries(cash_entry_id);

-- Index for extra_transactions by cash_entry_id (for joining extra transactions with cash entries)
CREATE INDEX IF NOT EXISTS idx_extra_transactions_cash_entry 
ON extra_transactions(cash_entry_id);

-- Note: These indexes will significantly improve query performance, especially when:
-- 1. Loading daily entries for a specific shop and date
-- 2. Carrying forward from previous day
-- 3. Filtering active products
-- 4. Loading related credit entries and extra transactions
