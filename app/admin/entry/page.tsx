'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { User, Shop, DailyStockEntry, DailyCashEntry, Product, ExtraTransaction } from '@/types';
import AdminSidebar from '@/components/AdminSidebar';
import StockEntryTable from '@/components/StockEntryTable';
import CashDenomination from '@/components/CashDenomination';
import ExtraTransactions from '@/components/ExtraTransactions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Calendar, FileDown, Lock, Unlock } from 'lucide-react';
import { formatCurrency, getTodayDate } from '@/lib/utils';
import { generateDailyReportPDF, downloadPDF } from '@/lib/pdf-generator';

export default function AdminEntryPage() {
  const router = useRouter();
  const supabase = createClient();
  
  const [user, setUser] = useState<User | null>(null);
  const [shops, setShops] = useState<Shop[]>([]);
  const [selectedShop, setSelectedShop] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState(getTodayDate());
  const [loading, setLoading] = useState(true);
  
  // Stock and cash data
  const [stockEntries, setStockEntries] = useState<(DailyStockEntry & { product?: Product })[]>([]);
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
    if (user && selectedShop) {
      loadData();
    }
  }, [user, selectedShop, selectedDate]);

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

    if (!userData || userData.role !== 'admin') {
      router.push('/login');
      return;
    }

    setUser(userData);

    // Load shops
    const { data: shopsData } = await supabase
      .from('shops')
      .select('*')
      .order('name');

    if (shopsData && shopsData.length > 0) {
      setShops(shopsData);
      
      // Check localStorage for saved shop selection
      const savedShopId = localStorage.getItem('selectedShopId');
      if (savedShopId && shopsData.some(s => s.id === savedShopId)) {
        setSelectedShop(savedShopId);
      } else {
        setSelectedShop(shopsData[0].id);
      }
    }

    setLoading(false);
  };

  const loadData = async () => {
    if (!selectedShop) return;

    // Load stock entries
    const { data: stockData } = await supabase
      .from('daily_stock_entries')
      .select(`
        *,
        product:products(
          *,
          product_type:product_types(*),
          product_size:product_sizes(*)
        )
      `)
      .eq('shop_id', selectedShop)
      .eq('entry_date', selectedDate);

    if (stockData) {
      setStockEntries(stockData as any);
    }

    // Load cash entry
    const { data: cashData } = await supabase
      .from('daily_cash_entries')
      .select('*')
      .eq('shop_id', selectedShop)
      .eq('entry_date', selectedDate)
      .single();

    if (cashData) {
      setCashEntry(cashData);
      
      // Load extra transactions
      const { data: extraTrans } = await supabase
        .from('extra_transactions')
        .select('*')
        .eq('cash_entry_id', cashData.id);
      
      if (extraTrans) {
        setExtraTransactions(extraTrans);
      }
    }
  };

  const updateStockEntry = async (id: string, field: string, value: number) => {
    const entry = stockEntries.find(e => e.id === id);
    if (!entry) return;

    const updates: any = { [field]: value };
    
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

  const saveCashEntry = async () => {
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

      await supabase
        .from('daily_cash_entries')
        .update(cashEntry)
        .eq('id', cashEntry.id);

      if (extraTransactions.length > 0) {
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

      alert('✅ Changes saved successfully!');
    } catch (error: any) {
      alert('❌ Error saving changes: ' + error.message);
    }
  };

  const handleApproveAndLock = async () => {
    if (!cashEntry.id) return;

    try {
      await supabase
        .from('daily_cash_entries')
        .update({
          is_locked: true,
          is_approved: true,
          approved_at: new Date().toISOString(),
        })
        .eq('id', cashEntry.id);

      loadData();
      alert('✅ Entry approved and locked successfully!');
    } catch (error: any) {
      alert('❌ Error: ' + error.message);
    }
  };

  const handleUnlock = async () => {
    if (!cashEntry.id) return;

    try {
      await supabase
        .from('daily_cash_entries')
        .update({
          is_locked: false,
          is_approved: false,
          unlock_requested: false,
          approved_at: null,
        })
        .eq('id', cashEntry.id);

      loadData();
      alert('✅ Entry unlocked successfully!');
    } catch (error: any) {
      alert('❌ Error: ' + error.message);
    }
  };

  const handleGeneratePDF = () => {
    const shop = shops.find(s => s.id === selectedShop);
    if (!shop) return;

    const pdf = generateDailyReportPDF({
      shopName: shop.name,
      entryDate: selectedDate,
      stockEntries,
      cashEntry: cashEntry as DailyCashEntry,
      extraTransactions: extraTransactions as ExtraTransaction[],
    });

    const fileName = `${selectedDate.split('-').reverse().join('-')}-${shop.name.replace(/\s+/g, '-')}.pdf`;
    downloadPDF(pdf, fileName);

    // Save to archives
    supabase
      .from('pdf_archives')
      .insert({
        shop_id: selectedShop,
        entry_date: selectedDate,
        file_path: `/archives/${fileName}`,
        file_name: fileName,
        month_year: new Date(selectedDate).toLocaleString('en-US', { month: 'long', year: 'numeric' }),
      });
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  const handleShopChange = (shopId: string) => {
    setSelectedShop(shopId);
    localStorage.setItem('selectedShopId', shopId);
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
    <div className="flex min-h-screen bg-gradient-to-br from-orange-50 to-amber-50">
      <AdminSidebar onSignOut={handleSignOut} />

      <main className="flex-1 p-8">
        {/* Top Bar */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold text-primary">Entry View/Edit</h1>

            <div className="flex items-center space-x-4">
              <div>
                <Select
                  value={selectedShop}
                  onChange={(e) => handleShopChange(e.target.value)}
                  className="w-64"
                >
                  {shops.map((shop) => (
                    <option key={shop.id} value={shop.id}>
                      {shop.name}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="flex items-center space-x-2">
                <Calendar size={20} />
                <Input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  max={getTodayDate()}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Stock Entry Table */}
        <div className="mb-6">
          <StockEntryTable
            entries={stockEntries}
            onUpdate={updateStockEntry}
            isLocked={false}
            brandFilter=""
            sizeFilter=""
          />
        </div>

        {/* Cash Register */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
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
                  value={cashEntry.google_pay || 0}
                  onChange={(e) => updateCashDenomination('google_pay', parseFloat(e.target.value) || 0)}
                  step="0.01"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">PhonePe/Paytm</label>
                <Input
                  type="number"
                  value={cashEntry.phonepe_paytm || 0}
                  onChange={(e) => updateCashDenomination('phonepe_paytm', parseFloat(e.target.value) || 0)}
                  step="0.01"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Bank Transfer</label>
                <Input
                  type="number"
                  value={cashEntry.bank_transfer || 0}
                  onChange={(e) => updateCashDenomination('bank_transfer', parseFloat(e.target.value) || 0)}
                  step="0.01"
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Cash Denomination */}
        <div className="mb-6">
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
            isLocked={false}
          />
        </div>

        {/* Extra Transactions */}
        <div className="mb-6">
          <ExtraTransactions
            transactions={extraTransactions}
            onAdd={() => setExtraTransactions([...extraTransactions, { transaction_type: 'income', description: '', amount: 0 }])}
            onDelete={(index) => setExtraTransactions(extraTransactions.filter((_, i) => i !== index))}
            onUpdate={(index, field, value) => {
              const updated = [...extraTransactions];
              updated[index] = { ...updated[index], [field]: value };
              setExtraTransactions(updated);
            }}
            isLocked={false}
          />
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
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
          <Button onClick={saveCashEntry} size="lg">
            Save Changes
          </Button>
          <Button variant="secondary" onClick={handleGeneratePDF} size="lg">
            <FileDown size={20} className="mr-2" />
            Generate PDF
          </Button>
          {!cashEntry.is_locked && (
            <Button onClick={handleApproveAndLock} size="lg">
              <Lock size={20} className="mr-2" />
              Approve & Lock
            </Button>
          )}
          {cashEntry.is_locked && (
            <Button variant="destructive" onClick={handleUnlock} size="lg">
              <Unlock size={20} className="mr-2" />
              Unlock
            </Button>
          )}
        </div>
      </main>
    </div>
  );
}
