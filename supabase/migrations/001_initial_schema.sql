-- Create tables for Wine Shop Management System

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Shops table
CREATE TABLE shops (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Product types table
CREATE TABLE product_types (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Product sizes table
CREATE TABLE product_sizes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    size_ml INTEGER NOT NULL UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Products table
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    brand_name TEXT NOT NULL,
    type_id UUID NOT NULL REFERENCES product_types(id) ON DELETE CASCADE,
    size_id UUID NOT NULL REFERENCES product_sizes(id) ON DELETE CASCADE,
    mrp DECIMAL(10,2) NOT NULL,
    shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(brand_name, type_id, size_id, shop_id)
);

-- Users table (extends Supabase auth)
CREATE TABLE users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username TEXT NOT NULL UNIQUE,
    role TEXT NOT NULL CHECK (role IN ('staff', 'admin')),
    shop_id UUID REFERENCES shops(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Daily stock entries table
CREATE TABLE daily_stock_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    entry_date DATE NOT NULL,
    opening_stock INTEGER DEFAULT 0,
    purchases INTEGER DEFAULT 0,
    transfer INTEGER DEFAULT 0,
    closing_stock INTEGER DEFAULT 0,
    sold_qty INTEGER DEFAULT 0,
    sale_value DECIMAL(10,2) DEFAULT 0,
    closing_stock_value DECIMAL(10,2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(shop_id, product_id, entry_date)
);

-- Daily cash entries table
CREATE TABLE daily_cash_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    entry_date DATE NOT NULL,
    counter_opening DECIMAL(10,2) DEFAULT 0,
    total_sale_value DECIMAL(10,2) DEFAULT 0,
    denom_500 INTEGER DEFAULT 0,
    denom_200 INTEGER DEFAULT 0,
    denom_100 INTEGER DEFAULT 0,
    denom_50 INTEGER DEFAULT 0,
    denom_20 INTEGER DEFAULT 0,
    denom_10 INTEGER DEFAULT 0,
    denom_5 INTEGER DEFAULT 0,
    denom_2 INTEGER DEFAULT 0,
    denom_1 INTEGER DEFAULT 0,
    total_cash DECIMAL(10,2) DEFAULT 0,
    google_pay DECIMAL(10,2) DEFAULT 0,
    phonepe_paytm DECIMAL(10,2) DEFAULT 0,
    bank_transfer DECIMAL(10,2) DEFAULT 0,
    total_upi_bank DECIMAL(10,2) DEFAULT 0,
    cash_shortage DECIMAL(10,2) DEFAULT 0,
    total_bottles_sold INTEGER DEFAULT 0,
    counter_closing DECIMAL(10,2) DEFAULT 0,
    is_locked BOOLEAN DEFAULT FALSE,
    is_approved BOOLEAN DEFAULT FALSE,
    unlock_requested BOOLEAN DEFAULT FALSE,
    locked_at TIMESTAMPTZ,
    approved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(shop_id, entry_date)
);

-- Extra transactions table
CREATE TABLE extra_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cash_entry_id UUID NOT NULL REFERENCES daily_cash_entries(id) ON DELETE CASCADE,
    transaction_type TEXT NOT NULL CHECK (transaction_type IN ('income', 'expense')),
    description TEXT NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Approval requests table
CREATE TABLE approval_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    entry_date DATE NOT NULL,
    request_type TEXT NOT NULL CHECK (request_type IN ('lock', 'unlock')),
    requested_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    resolved_at TIMESTAMPTZ
);

-- PDF archives table
CREATE TABLE pdf_archives (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    entry_date DATE NOT NULL,
    file_path TEXT NOT NULL,
    file_name TEXT NOT NULL,
    month_year TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX idx_products_shop ON products(shop_id);
CREATE INDEX idx_products_type ON products(type_id);
CREATE INDEX idx_products_size ON products(size_id);
CREATE INDEX idx_daily_stock_shop_date ON daily_stock_entries(shop_id, entry_date);
CREATE INDEX idx_daily_stock_product ON daily_stock_entries(product_id);
CREATE INDEX idx_daily_cash_shop_date ON daily_cash_entries(shop_id, entry_date);
CREATE INDEX idx_extra_trans_cash_entry ON extra_transactions(cash_entry_id);
CREATE INDEX idx_approval_shop_date ON approval_requests(shop_id, entry_date);
CREATE INDEX idx_pdf_archives_shop ON pdf_archives(shop_id, month_year);

-- Enable Row Level Security (RLS)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE shops ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_sizes ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_stock_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_cash_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE extra_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE approval_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE pdf_archives ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can read their own data, admins can read all
CREATE POLICY users_read ON users FOR SELECT USING (
    auth.uid() = id OR 
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin')
);

-- All authenticated users can read shops, types, sizes
CREATE POLICY shops_read ON shops FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY product_types_read ON product_types FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY product_sizes_read ON product_sizes FOR SELECT USING (auth.uid() IS NOT NULL);

-- Products: staff can read their shop's products, admins can read all
CREATE POLICY products_read ON products FOR SELECT USING (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND (users.role = 'admin' OR users.shop_id = products.shop_id))
);

-- Stock entries: staff can manage their shop's entries, admins can manage all
CREATE POLICY stock_entries_read ON daily_stock_entries FOR SELECT USING (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND (users.role = 'admin' OR users.shop_id = daily_stock_entries.shop_id))
);

CREATE POLICY stock_entries_insert ON daily_stock_entries FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND (users.role = 'admin' OR users.shop_id = daily_stock_entries.shop_id))
);

CREATE POLICY stock_entries_update ON daily_stock_entries FOR UPDATE USING (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND (users.role = 'admin' OR users.shop_id = daily_stock_entries.shop_id))
);

-- Cash entries: similar to stock entries
CREATE POLICY cash_entries_read ON daily_cash_entries FOR SELECT USING (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND (users.role = 'admin' OR users.shop_id = daily_cash_entries.shop_id))
);

CREATE POLICY cash_entries_insert ON daily_cash_entries FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND (users.role = 'admin' OR users.shop_id = daily_cash_entries.shop_id))
);

CREATE POLICY cash_entries_update ON daily_cash_entries FOR UPDATE USING (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND (users.role = 'admin' OR users.shop_id = daily_cash_entries.shop_id))
);

-- Extra transactions
CREATE POLICY extra_trans_read ON extra_transactions FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM daily_cash_entries dce
        JOIN users u ON u.id = auth.uid()
        WHERE dce.id = extra_transactions.cash_entry_id 
        AND (u.role = 'admin' OR u.shop_id = dce.shop_id)
    )
);

CREATE POLICY extra_trans_insert ON extra_transactions FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1 FROM daily_cash_entries dce
        JOIN users u ON u.id = auth.uid()
        WHERE dce.id = extra_transactions.cash_entry_id 
        AND (u.role = 'admin' OR u.shop_id = dce.shop_id)
    )
);

-- Approval requests
CREATE POLICY approval_read ON approval_requests FOR SELECT USING (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND (users.role = 'admin' OR users.shop_id = approval_requests.shop_id))
);

CREATE POLICY approval_insert ON approval_requests FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND (users.role = 'admin' OR users.shop_id = approval_requests.shop_id))
);

-- PDF archives: admin only
CREATE POLICY pdf_archives_read ON pdf_archives FOR SELECT USING (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin')
);

-- Admin policies for managing data
CREATE POLICY admin_manage_users ON users FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin')
);

CREATE POLICY admin_manage_products ON products FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin')
);

CREATE POLICY admin_manage_types ON product_types FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin')
);

CREATE POLICY admin_manage_sizes ON product_sizes FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin')
);
