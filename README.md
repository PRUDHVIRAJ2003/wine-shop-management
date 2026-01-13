# Wine Shop Management System

A complete real-time, modern web-based Wine Shop Management System built with Next.js 14 and Supabase. This system manages daily stock and cash operations for multiple liquor shops with automated carry-forward functionality.

## Features

- 🔐 **Authentication**: Secure login with role-based access (Staff/Admin)
- 📊 **Staff Entry Page**: Daily stock and cash entry with real-time calculations
- 🎯 **Auto Carry-Forward**: Opening stock and counter amounts automatically from previous day
- 💰 **Cash Management**: Detailed denomination tracking and digital payment recording
- 📈 **Admin Dashboard**: Analytics with charts and summary cards
- 👥 **User Management**: Create and manage staff and admin users
- 📦 **Product Management**: Manage products, types, and sizes
- 📄 **PDF Generation**: Daily reports with complete transaction details
- 🔒 **Approval System**: Lock/unlock entries with approval workflow
- 🎨 **Modern UI**: Beautiful wine-themed design with Tailwind CSS

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Database**: Supabase (PostgreSQL + Auth + Realtime)
- **Styling**: Tailwind CSS
- **Charts**: Recharts
- **PDF Generation**: jsPDF
- **TypeScript**: Full type safety

## Color Theme

- Primary: #722F37 (Burgundy)
- Secondary: #D4AF37 (Gold)
- Background: Warm cream/beige tones

## Prerequisites

- Node.js 18+ installed
- A Supabase account (free tier available at [supabase.com](https://supabase.com))
- npm or yarn package manager

## Setup Instructions

### 1. Clone the Repository

```bash
git clone <repository-url>
cd wine-shop-management
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Setup Supabase

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to Project Settings > API to get your credentials
3. Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

4. Update `.env.local` with your Supabase credentials:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### 4. Initialize Database

1. Go to your Supabase project dashboard
2. Navigate to SQL Editor
3. Run the migration file `supabase/migrations/001_initial_schema.sql`
4. Run the seed file `supabase/seed.sql`

This will create:
- All necessary tables
- Row Level Security (RLS) policies
- Initial data (shops, product types, sizes)

### 5. Create Admin User

1. In Supabase dashboard, go to Authentication > Users
2. Click "Add user" and create with:
   - Email: `admin@wineshop.local`
   - Password: `admin123` (change this!)
3. Note the User ID
4. In SQL Editor, run:

```sql
INSERT INTO users (id, username, role, shop_id)
VALUES ('paste-user-id-here', 'admin', 'admin', NULL);
```

### 6. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### 7. Login

- Username: `admin`
- Password: `admin123`

## Project Structure

```
├── app/                      # Next.js app directory
│   ├── login/               # Login page
│   ├── staff/entry/         # Staff entry page
│   ├── admin/               # Admin pages
│   │   ├── dashboard/       # Analytics dashboard
│   │   ├── entry/           # Entry view/edit
│   │   ├── archives/        # PDF archives
│   │   ├── users/           # User management
│   │   └── products/        # Product management
│   ├── layout.tsx           # Root layout
│   └── globals.css          # Global styles
├── components/              # React components
│   ├── ui/                  # Reusable UI components
│   ├── LoginForm.tsx
│   ├── StockEntryTable.tsx
│   ├── CashDenomination.tsx
│   ├── ExtraTransactions.tsx
│   ├── AdminSidebar.tsx
│   └── DashboardCharts.tsx
├── lib/                     # Utility functions
│   ├── supabase/           # Supabase clients
│   ├── utils.ts            # Helper functions
│   └── pdf-generator.ts    # PDF generation
├── types/                   # TypeScript type definitions
├── supabase/               # Database files
│   ├── migrations/         # SQL migrations
│   └── seed.sql            # Seed data
└── public/                 # Static assets
```

## Database Schema

### Main Tables

1. **shops**: Store information (Jayalakshmi, Shiva Ganga, Victory Wines)
2. **users**: System users with roles
3. **products**: Product catalog with brand, type, size, MRP
4. **product_types**: Beer, Brandy, Rum, Vodka, Whiskey, YN
5. **product_sizes**: 90ml to 2000ml variants
6. **daily_stock_entries**: Daily stock movements per product
7. **daily_cash_entries**: Daily cash and digital payment tracking
8. **extra_transactions**: Additional income/expense entries
9. **approval_requests**: Lock/unlock approval workflow
10. **pdf_archives**: Generated PDF storage metadata

## Key Features Explained

### Auto Carry-Forward

- Opening stock automatically filled from previous day's closing stock
- Counter opening from previous day's counter closing
- Defaults to 0 for first-time entries

### Stock Calculations

- **Sold QTY** = Opening Stock + Purchases - Closing Stock - Transfer
- **Sale Value** = MRP × Sold QTY
- **Closing Stock Value** = Closing Stock × MRP

### Cash Calculations

- **Total Cash** = Sum of all denominations
- **Cash Shortage** = Total Sale Value - Total Cash
- **Counter Closing** = Total Cash + Total UPI/Bank + Extra Income - Expenses

### Role-Based Access

- **Staff**: Can only view/edit their assigned shop's data
- **Admin**: Full access to all shops, can approve/lock entries, manage users and products

## Deployment

### Deploy to Vercel

1. Push code to GitHub
2. Import project to Vercel
3. Add environment variables in Vercel dashboard
4. Deploy

```bash
vercel --prod
```

### Environment Variables for Production

Ensure these are set in your deployment platform:

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
```

## Security Features

- Row Level Security (RLS) on all tables
- Role-based access control
- Locked entries prevent unauthorized changes
- Approval workflow for sensitive operations

## Support & Maintenance

### Common Issues

1. **Can't login**: Verify user exists in both auth.users and users table
2. **No data showing**: Check RLS policies and user role
3. **PDF not generating**: Ensure jsPDF is properly installed

### Adding New Products

1. Login as admin
2. Go to Product Management
3. Add new type/size if needed
4. Create product with brand, type, size, MRP, and shop

### Creating Staff Users

1. Login as admin
2. Go to User Management
3. Click "Add User"
4. Note: Requires proper Supabase Auth setup for production

## License

This project is proprietary software for wine shop management.

## Version

v1.0.0 - Initial Release

---

Built with ❤️ using Next.js 14 and Supabase
