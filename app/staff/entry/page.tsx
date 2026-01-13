'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { DailyStockEntry, DailyCashEntry, Product, ExtraTransaction, User, Shop } from '@/types';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import StockEntryTable from '@/components/StockEntryTable';
import CashDenomination from '@/components/CashDenomination';
import ExtraTransactions from '@/components/ExtraTransactions';
import { Wine, LogOut, Plus, Calendar } from 'lucide-react';
import { formatCurrency, getTodayDate, getYesterdayDate, formatDateForInput } from '@/lib/utils';

export default function StaffEntryPage() {
  const router = useRouter();
  const supabase = createClient();
  
  const [user, setUser] = useState<User | null>(null);
  const [shop, setShop] = useState<Shop | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(getTodayDate());
  const [brandFilter, setBrandFilter] = useState('');
  const [sizeFilter, setSizeFilter] = useState('');
  const [productSizes, setProductSizes] = useState<number[]>([]);
  
  // Stock data
  const [stockEntries, setStockEntries] = useState<(DailyStockEntry & { product?: Product })[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  
  // Cash data
  const [cashEntry, setCashEntry] = useState<Partial<DailyCashEntry>>({
    counter_opening: 0,
    total_sale_value: 0,
    denom_500: 0,
    denom_200: 0,
    denom_100: 0,
    denom_50: 0,
    denom_20: 0,
    denom_10: 0,
    denom_5: 0,
    denom_2: 0,
    denom_1: 0,
    total_cash: 0,
    google_pay: 0,
    phonepe_paytm: 0,
    bank_transfer: 0,
    total_upi_bank: 0,
    cash_shortage: 0,
    total_bottles_sold: 0,
    counter_closing: 0,
    is_locked: false,
    is_approved: false,
    unlock_requested: false,
  });
  
  const [extraTransactions, setExtraTransactions] = useState<Omit<ExtraTransaction, 'id' | 'cash_entry_id' | 'created_at'>[]>([]);

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (user && shop) {
      loadData();
    }
  }, [user, shop, selectedDate]);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      router.push('/login');
      return;
    }

    const { data: userData } = await supabase
      .from('users')
      .select('*')
      .eq('id', session.user.id)
      .single();

    if (!userData || userData.role !== 'staff') {
      router.push('/login');
      return;
    }

    setUser(userData);

    if (userData.shop_id) {
      const { data: shopData } = await supabase
        .from('shops')
        .select('*')
        .eq('id', userData.shop_id)
        .single();
      
      setShop(shopData);
    }

    setLoading(false);
  };

  const loadData = async () => {
    if (!user?.shop_id) return;

    // Load products for this shop
    const { data: productsData } = await supabase
      .from('products')
      .select(`
        *,
        product_type:product_types(*),
        product_size:product_sizes(*)
      `)
      .eq('shop_id', user.shop_id)
      .eq('is_active', true)
      .order('brand_name');

    if (productsData) {
      setProducts(productsData);
      
      // Get unique sizes
      const sizes = Array.from(new Set(productsData.map(p => p.product_size?.size_ml).filter(Boolean))) as number[];
      setProductSizes(sizes.sort((a, b) => a - b));
    }

    // Load or create stock entries
    await loadStockEntries(productsData || []);
    
    // Load cash entry
    await loadCashEntry();
  };

  const loadStockEntries = async (prods: Product[]) => {
    if (!user?.shop_id) return;

    const { data: existingEntries } = await supabase
      .from('daily_stock_entries')
      .select(`
        *,
        product:products(
          *,
          product_type:product_types(*),
          product_size:product_sizes(*)
        )
      `)
      .eq('shop_id', user.shop_id)
      .eq('entry_date', selectedDate);

    if (existingEntries && existingEntries.length > 0) {
      setStockEntries(existingEntries as any);
    } else {
      // Create new entries for today with yesterday's closing stock as opening
      const yesterday = getYesterdayDate(new Date(selectedDate));
      
      const { data: yesterdayEntries } = await supabase
        .from('daily_stock_entries')
        .select('product_id, closing_stock')
        .eq('shop_id', user.shop_id)
        .eq('entry_date', yesterday);

      const yesterdayMap = new Map(yesterdayEntries?.map(e => [e.product_id, e.closing_stock]) || []);

      const newEntries = await Promise.all(
        prods.map(async (product) => {
          const opening_stock = yesterdayMap.get(product.id) || 0;
          
          const { data: newEntry } = await supabase
            .from('daily_stock_entries')
            .insert({
              shop_id: user.shop_id,
              product_id: product.id,
              entry_date: selectedDate,
              opening_stock,
              purchases: 0,
              transfer: 0,
              closing_stock: opening_stock,
              sold_qty: 0,
              sale_value: 0,
              closing_stock_value: opening_stock * product.mrp,
            })
            .select(`
              *,
              product:products(
                *,
                product_type:product_types(*),
                product_size:product_sizes(*)
              )
            `)
            .single();

          return newEntry;
        })
      );

      setStockEntries(newEntries.filter(Boolean) as any);
    }
  };

  const loadCashEntry = async () => {
    if (!user?.shop_id) return;

    const { data: existingCash } = await supabase
      .from('daily_cash_entries')
      .select('*')
      .eq('shop_id', user.shop_id)
      .eq('entry_date', selectedDate)
      .single();

    if (existingCash) {
      setCashEntry(existingCash);
      
      // Load extra transactions
      const { data: extraTrans } = await supabase
        .from('extra_transactions')
        .select('*')
        .eq('cash_entry_id', existingCash.id);
      
      if (extraTrans) {
        setExtraTransactions(extraTrans);
      }
    } else {
      // Get yesterday's counter closing
      const yesterday = getYesterdayDate(new Date(selectedDate));
      const { data: yesterdayCash } = await supabase
        .from('daily_cash_entries')
        .select('counter_closing')
        .eq('shop_id', user.shop_id)
        .eq('entry_date', yesterday)
        .single();

      const counter_opening = yesterdayCash?.counter_closing || 0;
      
      // Create new cash entry
      const { data: newCash } = await supabase
        .from('daily_cash_entries')
        .insert({
          shop_id: user.shop_id,
          entry_date: selectedDate,
          counter_opening,
        })
        .select()
        .single();

      if (newCash) {
        setCashEntry(newCash);
      }
    }
  };

  const updateStockEntry = async (id: string, field: string, value: number) => {
    const entry = stockEntries.find(e => e.id === id);
    if (!entry) return;

    const updates: any = { [field]: value };
    
    // Recalculate fields
    const opening_stock = entry.opening_stock;
    const purchases = field === 'purchases' ? value : entry.purchases;
    const transfer = field === 'transfer' ? value : entry.transfer;
    const closing_stock = field === 'closing_stock' ? value : entry.closing_stock;
    
    const sold_qty = opening_stock + purchases - closing_stock - transfer;
    const sale_value = sold_qty * (entry.product?.mrp || 0);
    const closing_stock_value = closing_stock * (entry.product?.mrp || 0);

    updates.sold_qty = sold_qty;
    updates.sale_value = sale_value;
    updates.closing_stock_value = closing_stock_value;

    await supabase
      .from('daily_stock_entries')
      .update(updates)
      .eq('id', id);

    setStockEntries(prev => prev.map(e => 
      e.id === id ? { ...e, ...updates } : e
    ));
  };

  const updateCashDenomination = (field: string, value: number) => {
    setCashEntry(prev => {
      const updated = { ...prev, [field]: value };
      
      // Calculate total cash
      const total_cash = 
        (updated.denom_500 || 0) * 500 +
        (updated.denom_200 || 0) * 200 +
        (updated.denom_100 || 0) * 100 +
        (updated.denom_50 || 0) * 50 +
        (updated.denom_20 || 0) * 20 +
        (updated.denom_10 || 0) * 10 +
        (updated.denom_5 || 0) * 5 +
        (updated.denom_2 || 0) * 2 +
        (updated.denom_1 || 0) * 1;

      updated.total_cash = total_cash;
      
      // Calculate cash shortage and counter closing
      const total_sale_value = stockEntries.reduce((sum, e) => sum + e.sale_value, 0);
      const cash_shortage = total_sale_value - total_cash;
      const total_upi_bank = (updated.google_pay || 0) + (updated.phonepe_paytm || 0) + (updated.bank_transfer || 0);
      
      const extraIncome = extraTransactions
        .filter(t => t.transaction_type === 'income')
        .reduce((sum, t) => sum + t.amount, 0);
      
      const extraExpense = extraTransactions
        .filter(t => t.transaction_type === 'expense')
        .reduce((sum, t) => sum + t.amount, 0);

      const counter_closing = total_cash + total_upi_bank + extraIncome - extraExpense;

      updated.total_sale_value = total_sale_value;
      updated.cash_shortage = cash_shortage;
      updated.total_upi_bank = total_upi_bank;
      updated.counter_closing = counter_closing;
      updated.total_bottles_sold = stockEntries.reduce((sum, e) => sum + e.sold_qty, 0);

      return updated;
    });
  };

  const saveCashEntry = async () => {
    if (!cashEntry.id) return;

    await supabase
      .from('daily_cash_entries')
      .update(cashEntry)
      .eq('id', cashEntry.id);

    // Save extra transactions
    if (extraTransactions.length > 0) {
      // Delete existing and insert new
      await supabase
        .from('extra_transactions')
        .delete()
        .eq('cash_entry_id', cashEntry.id);

      await supabase
        .from('extra_transactions')
        .insert(
          extraTransactions.map(t => ({
            ...t,
            cash_entry_id: cashEntry.id,
          }))
        );
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-50">
      {/* Header */}
      <header className="bg-primary text-white shadow-lg">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Wine size={32} />
              <div>
                <h1 className="text-2xl font-bold">Wine Shop Management</h1>
                <p className="text-sm text-primary-100">{shop?.name}</p>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <div className="text-right">
                <p className="text-sm text-primary-100">Logged in as</p>
                <p className="font-medium">{user?.username}</p>
              </div>
              <Button variant="outline" onClick={handleSignOut} className="text-white border-white hover:bg-primary-600">
                <LogOut size={20} className="mr-2" />
                Sign Out
              </Button>
            </div>
          </div>

          <div className="flex items-center space-x-4 mt-4">
            <div className="flex items-center space-x-2">
              <Calendar size={20} />
              <Input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                max={getTodayDate()}
                className="bg-white text-gray-900"
              />
            </div>

            <Input
              type="text"
              placeholder="Filter by brand..."
              value={brandFilter}
              onChange={(e) => setBrandFilter(e.target.value)}
              className="bg-white text-gray-900 max-w-xs"
            />

            <Select
              value={sizeFilter}
              onChange={(e) => setSizeFilter(e.target.value)}
              className="bg-white text-gray-900 max-w-xs"
            >
              <option value="">All Sizes</option>
              {productSizes.map(size => (
                <option key={size} value={size}>{size} ml</option>
              ))}
            </Select>

            <Button variant="secondary">
              <Plus size={20} className="mr-2" />
              Add/Alter Products
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 space-y-6">
        {/* Stock Entry Table */}
        <StockEntryTable
          entries={stockEntries}
          onUpdate={updateStockEntry}
          isLocked={cashEntry.is_locked || false}
          brandFilter={brandFilter}
          sizeFilter={sizeFilter}
        />

        {/* Cash Register Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Cash Register</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700">Counter Opening</label>
                <div className="mt-1 text-2xl font-bold text-primary">
                  {formatCurrency(cashEntry.counter_opening || 0)}
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Today Total Sale Value</label>
                <div className="mt-1 text-2xl font-bold text-green-600">
                  {formatCurrency(stockEntries.reduce((sum, e) => sum + e.sale_value, 0))}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Digital Payments</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <label className="text-sm font-medium text-gray-700">Google Pay</label>
                <Input
                  type="number"
                  value={cashEntry.google_pay || 0}
                  onChange={(e) => updateCashDenomination('google_pay', parseFloat(e.target.value) || 0)}
                  disabled={cashEntry.is_locked}
                  step="0.01"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">PhonePe/Paytm</label>
                <Input
                  type="number"
                  value={cashEntry.phonepe_paytm || 0}
                  onChange={(e) => updateCashDenomination('phonepe_paytm', parseFloat(e.target.value) || 0)}
                  disabled={cashEntry.is_locked}
                  step="0.01"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Bank Transfer</label>
                <Input
                  type="number"
                  value={cashEntry.bank_transfer || 0}
                  onChange={(e) => updateCashDenomination('bank_transfer', parseFloat(e.target.value) || 0)}
                  disabled={cashEntry.is_locked}
                  step="0.01"
                />
              </div>
              <div className="pt-2 border-t">
                <div className="flex justify-between text-lg font-bold">
                  <span>Total UPI/Bank:</span>
                  <span className="text-secondary">{formatCurrency(cashEntry.total_upi_bank || 0)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Cash Denomination */}
        <CashDenomination
          denominations={{
            denom_500: cashEntry.denom_500 || 0,
            denom_200: cashEntry.denom_200 || 0,
            denom_100: cashEntry.denom_100 || 0,
            denom_50: cashEntry.denom_50 || 0,
            denom_20: cashEntry.denom_20 || 0,
            denom_10: cashEntry.denom_10 || 0,
            denom_5: cashEntry.denom_5 || 0,
            denom_2: cashEntry.denom_2 || 0,
            denom_1: cashEntry.denom_1 || 0,
          }}
          onUpdate={updateCashDenomination}
          isLocked={cashEntry.is_locked || false}
        />

        {/* Extra Transactions */}
        <ExtraTransactions
          transactions={extraTransactions}
          onAdd={() => setExtraTransactions([...extraTransactions, { transaction_type: 'income', description: '', amount: 0 }])}
          onDelete={(index) => setExtraTransactions(extraTransactions.filter((_, i) => i !== index))}
          onUpdate={(index, field, value) => {
            const updated = [...extraTransactions];
            updated[index] = { ...updated[index], [field]: value };
            setExtraTransactions(updated);
          }}
          isLocked={cashEntry.is_locked || false}
        />

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="bg-gradient-to-br from-red-50 to-red-100 border-red-200">
            <CardHeader>
              <CardTitle className="text-red-700">Cash Shortage</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-red-600">
                {formatCurrency(cashEntry.cash_shortage || 0)}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
            <CardHeader>
              <CardTitle className="text-blue-700">Total Bottles Sold</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-blue-600">
                {stockEntries.reduce((sum, e) => sum + e.sold_qty, 0)}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
            <CardHeader>
              <CardTitle className="text-green-700">Counter Closing</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-600">
                {formatCurrency(cashEntry.counter_closing || 0)}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end space-x-4">
          <Button onClick={saveCashEntry} size="lg">
            Save Changes
          </Button>
          {!cashEntry.is_locked && (
            <Button variant="secondary" size="lg">
              Lock & Send for Approval
            </Button>
          )}
          {cashEntry.is_locked && !cashEntry.unlock_requested && (
            <Button variant="outline" size="lg">
              Request Unlock
            </Button>
          )}
        </div>
      </main>
    </div>
  );
}
