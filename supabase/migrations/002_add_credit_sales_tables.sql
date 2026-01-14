-- Migration: Add Credit Sales / Debtors Tables
-- Description: Add tables to track credit sales (bottles taken without immediate payment)

-- Table to store daily credit entries (debtor transactions)
CREATE TABLE IF NOT EXISTS daily_credit_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  entry_date DATE NOT NULL,
  person_name VARCHAR(255) NOT NULL,
  amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table to store debtor names for auto-suggest functionality
CREATE TABLE IF NOT EXISTS debtors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  person_name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(shop_id, person_name)
);

-- Create indexes for faster queries
CREATE INDEX idx_daily_credit_entries_shop_date 
ON daily_credit_entries(shop_id, entry_date);

CREATE INDEX idx_debtors_shop ON debtors(shop_id);

-- Enable Row Level Security
ALTER TABLE daily_credit_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE debtors ENABLE ROW LEVEL SECURITY;

-- RLS Policies for daily_credit_entries
-- Staff can manage their shop's credit entries, admins can manage all
CREATE POLICY credit_entries_read ON daily_credit_entries FOR SELECT USING (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND (users.role = 'admin' OR users.shop_id = daily_credit_entries.shop_id))
);

CREATE POLICY credit_entries_insert ON daily_credit_entries FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND (users.role = 'admin' OR users.shop_id = daily_credit_entries.shop_id))
);

CREATE POLICY credit_entries_update ON daily_credit_entries FOR UPDATE USING (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND (users.role = 'admin' OR users.shop_id = daily_credit_entries.shop_id))
);

CREATE POLICY credit_entries_delete ON daily_credit_entries FOR DELETE USING (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND (users.role = 'admin' OR users.shop_id = daily_credit_entries.shop_id))
);

-- RLS Policies for debtors
-- Staff can read their shop's debtors, admins can read all
CREATE POLICY debtors_read ON debtors FOR SELECT USING (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND (users.role = 'admin' OR users.shop_id = debtors.shop_id))
);

CREATE POLICY debtors_insert ON debtors FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND (users.role = 'admin' OR users.shop_id = debtors.shop_id))
);
