-- Seed data for Wine Shop Management System

-- Insert shops
INSERT INTO shops (name) VALUES 
    ('Jayalakshmi Wines'),
    ('Shiva Ganga Wines'),
    ('Victory Wines');

-- Insert product types
INSERT INTO product_types (name) VALUES 
    ('Beer'),
    ('Brandy'),
    ('Rum'),
    ('Vodka'),
    ('Whiskey'),
    ('YN');

-- Insert product sizes (in ml)
INSERT INTO product_sizes (size_ml) VALUES 
    (90),
    (180),
    (275),
    (330),
    (375),
    (500),
    (650),
    (700),
    (750),
    (1000),
    (2000);

-- Note: Admin user needs to be created through Supabase Auth
-- After creating the admin user in Supabase Auth dashboard, insert into users table:
-- INSERT INTO users (id, username, role, shop_id) 
-- VALUES ('[auth-user-id]', 'admin', 'admin', NULL);
