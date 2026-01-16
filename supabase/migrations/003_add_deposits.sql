-- ============================================
-- Migration: Add Bank Deposit & Cash to House
-- Date: 2026-01-16
-- Description: Add new columns and optimize performance
-- ============================================

-- 1. Add new columns to daily_cash_entries
ALTER TABLE daily_cash_entries
ADD COLUMN IF NOT EXISTS bank_deposit NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS cash_to_house NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS coins NUMERIC DEFAULT 0;

-- 2. Add comments for documentation
COMMENT ON COLUMN daily_cash_entries.bank_deposit IS 'Amount deposited to bank for purchasing new stock';
COMMENT ON COLUMN daily_cash_entries.cash_to_house IS 'Amount given to owner for personal use';
COMMENT ON COLUMN daily_cash_entries.coins IS 'Total coins amount (replaces ₹5, ₹2, ₹1)';

-- 3. Migrate existing coin denominations to new coins field
UPDATE daily_cash_entries
SET coins = COALESCE((denom_5 * 5 + denom_2 * 2 + denom_1 * 1), 0)
WHERE coins = 0;

-- 4. Add performance indexes
CREATE INDEX IF NOT EXISTS idx_daily_cash_bank_deposit 
ON daily_cash_entries(shop_id, entry_date, bank_deposit) 
WHERE bank_deposit > 0;

CREATE INDEX IF NOT EXISTS idx_daily_cash_cash_to_house 
ON daily_cash_entries(shop_id, entry_date, cash_to_house) 
WHERE cash_to_house > 0;

CREATE INDEX IF NOT EXISTS idx_deposits_tracking 
ON daily_cash_entries(shop_id, entry_date, bank_deposit, cash_to_house);

-- 5. Verify the changes
SELECT 
  column_name, 
  data_type, 
  column_default 
FROM information_schema.columns 
WHERE table_name = 'daily_cash_entries' 
  AND column_name IN ('bank_deposit', 'cash_to_house', 'coins');
