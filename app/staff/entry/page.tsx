'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState, useMemo } from 'react';
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
import { Wine, LogOut, Plus, Calendar, FileDown } from 'lucide-react';
import { formatCurrency, getTodayDate, getYesterdayDate } from '@/lib/utils';
import ProductModal from '@/components/ProductModal';
import { generateDailyReportPDF, downloadPDF } from '@/lib/pdf-generator';

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
  const [showProductModal, setShowProductModal] = useState(false);
  
  // Stock data
  const [stockEntries, setStockEntries] = useState<(DailyStockEntry & { product?: Product })[]>([]);
  
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

  // Computed values using useMemo for reactivity
  const totalExtraIncome = useMemo(() => {
    return extraTransactions
      .filter(t => t.transaction_type === 'income')
      .reduce((sum, t) => sum + (t.amount || 0), 0);
  }, [extraTransactions]);

  const totalExpenses = useMemo(() => {
    return extraTransactions
      .filter(t => t.transaction_type === 'expense')
      .reduce((sum, t) => sum + (t.amount || 0), 0);
  }, [extraTransactions]);

  const totalCash = useMemo(() => {
    return (
      (cashEntry.denom_500 || 0) * 500 +
      (cashEntry.denom_200 || 0) * 200 +
      (cashEntry.denom_100 || 0) * 100 +
      (cashEntry.denom_50 || 0) * 50 +
      (cashEntry.denom_20 || 0) * 20 +
      (cashEntry.denom_10 || 0) * 10 +
      (cashEntry.denom_5 || 0) * 5 +
      (cashEntry.denom_2 || 0) * 2 +
      (cashEntry.denom_1 || 0) * 1
    );
  }, [cashEntry.denom_500, cashEntry.denom_200, cashEntry.denom_100, cashEntry.denom_50, 
      cashEntry.denom_20, cashEntry.denom_10, cashEntry.denom_5, cashEntry.denom_2, cashEntry.denom_1]);

  const totalUpiBank = useMemo(() => {
    return (cashEntry.google_pay || 0) + (cashEntry.phonepe_paytm || 0) + (cashEntry.bank_transfer || 0);
  }, [cashEntry.google_pay, cashEntry.phonepe_paytm, cashEntry.bank_transfer]);

  const totalSaleValue = useMemo(() => {
    return stockEntries.reduce((sum, e) => sum + (e.sale_value || 0), 0);
  }, [stockEntries]);

  const cashShortage = useMemo(() => {
    return totalSaleValue - totalCash;
  }, [totalSaleValue, totalCash]);

  const totalBottlesSold = useMemo(() => {
    return stockEntries.reduce((sum, e) => sum + (e.sold_qty || 0), 0);
  }, [stockEntries]);

  const counterClosing = useMemo(() => {
    return totalCash + totalUpiBank + totalExtraIncome - totalExpenses;
  }, [totalCash, totalUpiBank, totalExtraIncome, totalExpenses]);

  // Update cashEntry when computed values change
  useEffect(() => {
    setCashEntry(prev => ({
      ...prev,
      total_cash: totalCash,
      total_upi_bank: totalUpiBank,
      total_sale_value: totalSaleValue,
      cash_shortage: cashShortage,
      total_bottles_sold: totalBottlesSold,
      counter_closing: counterClosing,
    }));
  }, [totalCash, totalUpiBank, totalSaleValue, cashShortage, totalBottlesSold, counterClosing]);

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (user && shop) {
      initializeData();
    }
  }, [user, shop, selectedDate]);

  const initializeData = async () => {
    if (!user?.shop_id) return;
    
    // First, carry forward from previous day if needed
    await carryForwardFromPreviousDay(user.shop_id, selectedDate);
    
    // Then load today's data
    await loadData();
  };

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

  const carryForwardFromPreviousDay = async (shopId: string, selectedDate: string) => {
    try {
      // Calculate previous day's date
      const currentDate = new Date(selectedDate);
      const previousDate = new Date(currentDate);
      previousDate.setDate(previousDate.getDate() - 1);
      const previousDateStr = previousDate.toISOString().split('T')[0];
      
      console.log(`[Carry Forward] Checking carry-forward from ${previousDateStr} to ${selectedDate}`);
      
      // ============================================
      // STEP 1: Check if today's stock entries exist
      // ============================================
      const { data: existingStockEntries, error: stockCheckError } = await supabase
        .from('daily_stock_entries')
        .select('id, product_id, opening_stock')
        .eq('shop_id', shopId)
        .eq('entry_date', selectedDate);
      
      if (stockCheckError) {
        console.error('[Carry Forward] Error checking existing entries:', stockCheckError);
        return false;
      }
      
      // Check if entries exist AND have opening stock > 0 (already carried forward)
      const hasCarriedForward = existingStockEntries && 
        existingStockEntries.some(entry => entry.opening_stock > 0);
      
      if (hasCarriedForward) {
        console.log('[Carry Forward] Stock already carried forward for this date');
        return false;
      }
      
      // ============================================
      // STEP 2: Fetch previous day's stock entries
      // ============================================
      const { data: previousStockEntries, error: prevStockError } = await supabase
        .from('daily_stock_entries')
        .select('product_id, closing_stock')
        .eq('shop_id', shopId)
        .eq('entry_date', previousDateStr);
      
      if (prevStockError) {
        console.error('[Carry Forward] Error fetching previous stock:', prevStockError);
        return false;
      }
      
      if (previousStockEntries && previousStockEntries.length > 0) {
        console.log(`[Carry Forward] Found ${previousStockEntries.length} entries from previous day`);
        
        // Update today's entries with carried forward opening stock
        for (const prevEntry of previousStockEntries) {
          // Check if entry exists for this product today
          const existingEntry = existingStockEntries?.find(
            e => e.product_id === prevEntry.product_id
          );
          
          if (existingEntry && existingEntry.opening_stock === 0) {
            // Update existing entry with opening stock
            await supabase
              .from('daily_stock_entries')
              .update({ 
                opening_stock: prevEntry.closing_stock,
                closing_stock: prevEntry.closing_stock // Initialize closing stock same as opening
              })
              .eq('id', existingEntry.id);
          }
        }
        console.log('[Carry Forward] Stock entries carried forward successfully!');
      } else {
        console.log('[Carry Forward] No previous day stock entries found');
      }
      
      // ============================================
      // STEP 3: Fetch previous day's cash entry for Counter Closing
      // ============================================
      const { data: previousCashEntry, error: prevCashError } = await supabase
        .from('daily_cash_entries')
        .select('counter_closing')
        .eq('shop_id', shopId)
        .eq('entry_date', previousDateStr)
        .single();
      
      if (prevCashError && prevCashError.code !== 'PGRST116') {
        console.error('[Carry Forward] Error fetching previous cash entry:', prevCashError);
      }
      
      if (previousCashEntry && previousCashEntry.counter_closing > 0) {
        console.log(`[Carry Forward] Previous counter closing: ₹${previousCashEntry.counter_closing}`);
        
        // Check if today's cash entry exists
        const { data: existingCashEntry } = await supabase
          .from('daily_cash_entries')
          .select('id, counter_opening')
          .eq('shop_id', shopId)
          .eq('entry_date', selectedDate)
          .single();
        
        if (existingCashEntry && existingCashEntry.counter_opening === 0) {
          // Update counter opening if it's 0
          await supabase
            .from('daily_cash_entries')
            .update({ 
              counter_opening: previousCashEntry.counter_closing 
            })
            .eq('id', existingCashEntry.id);
          console.log('[Carry Forward] Counter opening updated!');
        }
      } else {
        console.log('[Carry Forward] No previous day cash entry found or counter closing is 0');
      }
      
      return true;
    } catch (error) {
      console.error('[Carry Forward] Error in carry forward:', error);
      return false;
    }
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

    // Update local state only - don't auto-save to database
    setStockEntries(prev => prev.map(e => 
      e.id === id ? { ...e, ...updates } : e
    ));
  };

  const updateCashDenomination = (field: string, value: number) => {
    setCashEntry(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  const saveAllData = async () => {
    if (!cashEntry.id) return;

    try {
      // Save all stock entries
      for (const entry of stockEntries) {
        await supabase
          .from('daily_stock_entries')
          .update({
            opening_stock: entry.opening_stock,
            purchases: entry.purchases,
            transfer: entry.transfer,
            closing_stock: entry.closing_stock,
            sold_qty: entry.sold_qty,
            sale_value: entry.sale_value,
            closing_stock_value: entry.closing_stock_value,
          })
          .eq('id', entry.id);
      }

      // Save cash entry
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

      alert('✅ Data saved successfully!');
    } catch (error: any) {
      alert('❌ Error saving data: ' + error.message);
      throw error;
    }
  };

  const handleLockAndSend = async () => {
    try {
      setLoading(true);
      
      // Save all data first
      await saveAllData();
      
      // Update daily_cash_entries to set is_locked = true
      const { error: lockError } = await supabase
        .from('daily_cash_entries')
        .update({ 
          is_locked: true, 
          locked_at: new Date().toISOString() 
        })
        .eq('shop_id', user?.shop_id)
        .eq('entry_date', selectedDate);
      
      if (lockError) throw lockError;
      
      // Create approval request
      const { error: approvalError } = await supabase
        .from('approval_requests')
        .insert({
          shop_id: user?.shop_id,
          entry_date: selectedDate,
          request_type: 'lock',
          requested_by: user?.id,
          status: 'pending'
        });
      
      if (approvalError) throw approvalError;
      
      // Update local state
      setCashEntry(prev => ({
        ...prev,
        is_locked: true,
        locked_at: new Date().toISOString(),
      }));
      
      alert('✅ Entry locked and sent for approval successfully!');
      
    } catch (error: any) {
      alert('❌ Error: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRequestUnlock = async () => {
    try {
      setLoading(true);
      
      const { error } = await supabase
        .from('approval_requests')
        .insert({
          shop_id: user?.shop_id,
          entry_date: selectedDate,
          request_type: 'unlock',
          requested_by: user?.id,
          status: 'pending'
        });
      
      if (error) throw error;
      
      // Update the cash entry to mark unlock requested
      await supabase
        .from('daily_cash_entries')
        .update({ unlock_requested: true })
        .eq('shop_id', user?.shop_id)
        .eq('entry_date', selectedDate);
      
      // Update local state
      setCashEntry(prev => ({
        ...prev,
        unlock_requested: true,
      }));
      
      alert('✅ Unlock request sent to admin successfully!');
      
    } catch (error: any) {
      alert('❌ Error: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGeneratePDF = () => {
    try {
      if (!shop || !cashEntry.id) {
        alert('No data available to generate PDF');
        return;
      }
      
      const pdfData = {
        shopName: shop.name,
        entryDate: selectedDate,
        stockEntries: stockEntries,
        cashEntry: cashEntry as DailyCashEntry,
        extraTransactions: extraTransactions as ExtraTransaction[]
      };
      
      const doc = generateDailyReportPDF(pdfData);
      const fileName = `${selectedDate}-${shop.name.replace(/\s+/g, '-')}.pdf`;
      downloadPDF(doc, fileName);
      
      alert('✅ PDF generated successfully!');
    } catch (error: any) {
      console.error('Error generating PDF:', error);
      alert('❌ Error generating PDF: ' + error.message);
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
                onChange={(e) => {
                  setSelectedDate(e.target.value);
                }}
                max={getTodayDate()}
                className="bg-white text-gray-900"
              />
            </div>

            <Button 
              variant="secondary" 
              onClick={async () => {
                if (user?.shop_id && selectedDate) {
                  const success = await carryForwardFromPreviousDay(user.shop_id, selectedDate);
                  if (success) {
                    alert('✅ Stock and Counter Opening carried forward from previous day!');
                    await loadData();
                  } else {
                    alert('ℹ️ No previous day data found or already carried forward.');
                  }
                }
              }}
              className="whitespace-nowrap"
            >
              🔄 Carry Forward
            </Button>

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

            <Button variant="secondary" onClick={() => setShowProductModal(true)}>
              <Plus size={20} className="mr-2" />
              Add/Alter Products
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 space-y-6">
        {/* Product Modal */}
        {user?.shop_id && (
          <ProductModal
            isOpen={showProductModal}
            onClose={() => setShowProductModal(false)}
            shopId={user.shop_id}
            onProductAdded={loadData}
          />
        )}

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
                  {formatCurrency(totalSaleValue)}
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
                  value={cashEntry.google_pay === 0 ? '' : cashEntry.google_pay}
                  placeholder="0"
                  onChange={(e) => updateCashDenomination('google_pay', parseFloat(e.target.value) || 0)}
                  disabled={cashEntry.is_locked}
                  step="0.01"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">PhonePe/Paytm</label>
                <Input
                  type="number"
                  value={cashEntry.phonepe_paytm === 0 ? '' : cashEntry.phonepe_paytm}
                  placeholder="0"
                  onChange={(e) => updateCashDenomination('phonepe_paytm', parseFloat(e.target.value) || 0)}
                  disabled={cashEntry.is_locked}
                  step="0.01"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Bank Transfer</label>
                <Input
                  type="number"
                  value={cashEntry.bank_transfer === 0 ? '' : cashEntry.bank_transfer}
                  placeholder="0"
                  onChange={(e) => updateCashDenomination('bank_transfer', parseFloat(e.target.value) || 0)}
                  disabled={cashEntry.is_locked}
                  step="0.01"
                />
              </div>
              <div className="pt-2 border-t">
                <div className="flex justify-between text-lg font-bold">
                  <span>Total UPI/Bank:</span>
                  <span className="text-secondary">{formatCurrency(totalUpiBank)}</span>
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
                {formatCurrency(cashShortage)}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
            <CardHeader>
              <CardTitle className="text-blue-700">Total Bottles Sold</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-blue-600">
                {totalBottlesSold}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
            <CardHeader>
              <CardTitle className="text-green-700">Counter Closing</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-600">
                {formatCurrency(counterClosing)}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end space-x-4">
          <Button variant="outline" onClick={handleGeneratePDF} size="lg">
            <FileDown size={20} className="mr-2" />
            Generate PDF Report
          </Button>
          <Button onClick={saveAllData} size="lg" disabled={cashEntry.is_locked || loading}>
            Save Changes
          </Button>
          {!cashEntry.is_locked && (
            <Button variant="secondary" size="lg" onClick={handleLockAndSend} disabled={loading}>
              Lock & Send for Approval
            </Button>
          )}
          {cashEntry.is_locked && !cashEntry.unlock_requested && (
            <Button variant="outline" size="lg" onClick={handleRequestUnlock} disabled={loading}>
              Request Unlock
            </Button>
          )}
        </div>
      </main>
    </div>
  );
}
