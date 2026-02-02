'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { User, Shop, DailyStockEntry, DailyCashEntry, Product, ExtraTransaction, CreditEntry } from '@/types';
import AdminSidebar from '@/components/AdminSidebar';
import StockEntryTable from '@/components/StockEntryTable';
import CashDenomination from '@/components/CashDenomination';
import ExtraTransactions from '@/components/ExtraTransactions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Calendar, FileDown, Lock, Unlock, RefreshCw } from 'lucide-react';
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
  const [dataLoading, setDataLoading] = useState(false);
  
  // Filter states
  const [brandFilter, setBrandFilter] = useState<string>('');
  const [sizeFilter, setSizeFilter] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('');
  
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
    coins: 0,
    total_cash: 0,
    google_pay: 0,
    phonepe_paytm: 0,
    bank_transfer: 0,
    total_upi_bank: 0,
    bank_deposit: 0,
    cash_to_house: 0,
    cash_shortage: 0,
    total_bottles_sold: 0,
    counter_closing: 0,
    is_locked: false,
    is_approved: false,
  });
  
  const [extraTransactions, setExtraTransactions] = useState<Omit<ExtraTransaction, 'id' | 'cash_entry_id' | 'created_at'>[]>([]);

  // Credit entries state
  const [creditEntries, setCreditEntries] = useState<CreditEntry[]>([]);
  const [previousDebtors, setPreviousDebtors] = useState<string[]>([]);

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

  const totalCredit = useMemo(() => {
    return creditEntries.reduce((sum, entry) => sum + (entry.amount || 0), 0);
  }, [creditEntries]);

  // Physical cash from denominations (NOT including digital payments)
  const physicalCash = useMemo(() => {
    return (
      (cashEntry.denom_500 || 0) * 500 +
      (cashEntry.denom_200 || 0) * 200 +
      (cashEntry.denom_100 || 0) * 100 +
      (cashEntry.denom_50 || 0) * 50 +
      (cashEntry.denom_20 || 0) * 20 +
      (cashEntry.denom_10 || 0) * 10 +
      (cashEntry.coins || 0)
    );
  }, [cashEntry.denom_500, cashEntry.denom_200, cashEntry.denom_100, cashEntry.denom_50, 
      cashEntry.denom_20, cashEntry.denom_10, cashEntry.coins]);

  // Digital payments from CashDenomination component (maps to phonepe_paytm field in DB)
  const digitalPayments = useMemo(() => {
    return (cashEntry.phonepe_paytm || 0);
  }, [cashEntry.phonepe_paytm]);

  // Total cash includes both physical cash and digital payments
  const totalCash = useMemo(() => {
    return physicalCash + digitalPayments;
  }, [physicalCash, digitalPayments]);

  // Total UPI/Bank for database field (now only includes digital payments)
  // Note: bank_transfer field is deprecated but kept in DB for historical data
  const totalUpiBank = useMemo(() => {
    return digitalPayments;
  }, [digitalPayments]);

  const totalSaleValue = useMemo(() => {
    return stockEntries.reduce((sum, e) => sum + (e.sale_value || 0), 0);
  }, [stockEntries]);

  const totalBottlesSold = useMemo(() => {
    return stockEntries.reduce((sum, e) => sum + (e.sold_qty || 0), 0);
  }, [stockEntries]);

  // New business logic: Total Amount calculation
  const totalAmount = useMemo(() => {
    return (cashEntry.counter_opening || 0) + totalSaleValue + totalExtraIncome;
  }, [cashEntry.counter_opening, totalSaleValue, totalExtraIncome]);

  // New business logic: Counter Closing (cash remaining at counter)
  const counterClosing = useMemo(() => {
    return totalAmount - digitalPayments - (cashEntry.cash_to_house || 0) - totalExpenses;
  }, [totalAmount, digitalPayments, cashEntry.cash_to_house, totalExpenses]);

  // New business logic: Cash Status Calculation
  // Step 1: Physical cash after deductions (bank deposit and cash to owner)
  const physicalCashAfterDeductions = useMemo(() => {
    return physicalCash - (cashEntry.bank_deposit || 0) - (cashEntry.cash_to_house || 0);
  }, [physicalCash, cashEntry.bank_deposit, cashEntry.cash_to_house]);

  // Step 2: Cash status = physical cash after deductions + credit sales
  const cashStatus = useMemo(() => {
    return physicalCashAfterDeductions + totalCredit;
  }, [physicalCashAfterDeductions, totalCredit]);

  // Step 3: Determine if excess, shortage, or balanced
  const cashDifference = useMemo(() => {
    return cashStatus - counterClosing;
  }, [cashStatus, counterClosing]);

  const cashShortage = useMemo(() => {
    // Negative difference means shortage
    return cashDifference < 0 ? Math.abs(cashDifference) : 0;
  }, [cashDifference]);

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

  // Initial load when user first becomes available
  useEffect(() => {
    if (user && selectedShop && selectedDate) {
      setDataLoading(true);
      initializeData().finally(() => setDataLoading(false));
    }
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps
  
  // Re-fetch when shop or date changes (after user is loaded)
  useEffect(() => {
    if (user && selectedShop && selectedDate) {
      setDataLoading(true);
      initializeData().finally(() => setDataLoading(false));
    }
  }, [selectedShop, selectedDate]); // eslint-disable-line react-hooks/exhaustive-deps

  const initializeData = async () => {
    if (!selectedShop) return;
    
    // First, carry forward from previous day if needed
    await carryForwardFromPreviousDay(selectedShop, selectedDate);
    
    // Run these in parallel for better performance
    await Promise.all([
      loadData(),
      loadCreditEntries().catch(error => {
        console.warn('Credit entries load skipped:', error.message);
      }),
      loadPreviousDebtors().catch(error => {
        console.warn('Previous debtors load skipped:', error.message);
      })
    ]);
  };

  const handleRefresh = async () => {
    if (!selectedShop || !selectedDate) return;
    setDataLoading(true);
    try {
      await loadData();
      // Load credit entries - don't let it fail the refresh
      try {
        await loadCreditEntries();
        await loadPreviousDebtors();
      } catch (error: any) {
        console.warn('Credit entries load skipped:', error.message);
      }
    } finally {
      setDataLoading(false);
    }
  };

  const loadPreviousDebtors = async () => {
    // Capture selectedShop at the start and validate
    const shopId = selectedShop;
    if (!shopId) return;
    
    const { data } = await supabase
      .from('debtors')
      .select('person_name')
      .eq('shop_id', shopId)
      .order('person_name');
    
    if (data) {
      setPreviousDebtors(data.map(d => d.person_name));
    }
  };

  const loadCreditEntries = async () => {
    // Capture selectedShop at the start and validate
    const shopId = selectedShop;
    if (!shopId) return;
    
    try {
      const { data, error } = await supabase
        .from('daily_credit_entries')
        .select('*')
        .eq('shop_id', shopId)
        .eq('entry_date', selectedDate)
        .order('created_at');
      
      if (error) {
        // Table might not exist - silently fail
        console.warn('Credit entries table not available:', error.message);
        setCreditEntries([]);
        return;
      }
      
      if (data) {
        setCreditEntries(data);
      } else {
        setCreditEntries([]);
      }
    } catch (error: any) {
      console.warn('Credit entries not available:', error?.message || error);
      setCreditEntries([]);
    }
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
    // Capture selectedShop at the start and validate
    const shopId = selectedShop;
    if (!shopId) return;

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
      .eq('shop_id', shopId)
      .eq('entry_date', selectedDate);

    if (stockData) {
      setStockEntries(stockData as any);
    }

    // Load cash entry
    const { data: cashData } = await supabase
      .from('daily_cash_entries')
      .select('*')
      .eq('shop_id', shopId)
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
    // Map 'digital_payments' from UI to 'phonepe_paytm' in database
    const dbField = field === 'digital_payments' ? 'phonepe_paytm' : field;
    setCashEntry(prev => ({
      ...prev,
      [dbField]: value,
    }));
  };

  const handleAddCreditEntry = () => {
    setCreditEntries([
      ...creditEntries,
      { person_name: '', amount: 0 }
    ]);
  };

  const handleCreditEntryChange = (index: number, field: string, value: any) => {
    const updated = [...creditEntries];
    updated[index] = {
      ...updated[index],
      [field]: field === 'amount' ? (parseFloat(value) || 0) : value
    };
    setCreditEntries(updated);
  };

  const handleDeleteCreditEntry = async (index: number) => {
    const entry = creditEntries[index];
    
    if (entry.id) {
      // Delete from database
      const { error } = await supabase
        .from('daily_credit_entries')
        .delete()
        .eq('id', entry.id);
      
      if (error) {
        alert('❌ Error deleting credit entry: ' + error.message);
        return;
      }
    }
    
    // Remove from state
    const updated = creditEntries.filter((_, i) => i !== index);
    setCreditEntries(updated);
  };

  const saveCreditEntries = async () => {
    // Capture selectedShop at the start and validate
    const shopId = selectedShop;
    if (!shopId) return;
    
    try {
      const validEntries = creditEntries.filter(entry => entry.person_name && entry.amount > 0);
      
      if (validEntries.length === 0) {
        await loadPreviousDebtors();
        return;
      }

      // Separate entries into updates and inserts
      const updates = validEntries
        .filter(entry => entry.id)
        .map(entry => ({
          id: entry.id,
          person_name: entry.person_name,
          amount: entry.amount,
          updated_at: new Date().toISOString()
        }));

      const inserts = validEntries
        .filter(entry => !entry.id)
        .map(entry => ({
          shop_id: shopId,
          entry_date: selectedDate,
          person_name: entry.person_name,
          amount: entry.amount
        }));

      // Batch update existing entries
      if (updates.length > 0) {
        const { error } = await supabase
          .from('daily_credit_entries')
          .upsert(updates);
        
        if (error) throw error;
      }

      // Batch insert new entries
      if (inserts.length > 0) {
        const { error } = await supabase
          .from('daily_credit_entries')
          .insert(inserts);
        
        if (error) throw error;
      }
      
      // Batch upsert all debtors
      const debtors = validEntries.map(entry => ({
        shop_id: shopId,
        person_name: entry.person_name
      }));

      if (debtors.length > 0) {
        const { error: debtorError } = await supabase
          .from('debtors')
          .upsert(debtors, {
            onConflict: 'shop_id,person_name'
          });
        
        if (debtorError) throw debtorError;
      }
      
      // Reload previous debtors to update the list
      await loadPreviousDebtors();
    } catch (error: any) {
      // Don't throw - just log warning if table doesn't exist
      if (error.message?.includes('daily_credit_entries') || error.message?.includes('relation') || error.message?.includes('does not exist')) {
        console.warn('Credit entries table not available - skipping save');
        return;
      }
      console.error('Error saving credit entries:', error);
      throw error; // Re-throw other errors
    }
  };

  const saveCashEntry = async () => {
    if (!cashEntry.id) return;

    try {
      // Batch save all stock entries using upsert for efficiency
      const stockUpdates = stockEntries.map(entry => ({
        id: entry.id,
        shop_id: entry.shop_id,
        product_id: entry.product_id,
        entry_date: entry.entry_date,
        opening_stock: entry.opening_stock,
        purchases: entry.purchases,
        transfer: entry.transfer,
        closing_stock: entry.closing_stock,
        sold_qty: entry.sold_qty,
        sale_value: entry.sale_value,
        closing_stock_value: entry.closing_stock_value,
        updated_at: new Date().toISOString(),
      }));

      // Use upsert for batch operation - single database call
      if (stockUpdates.length > 0) {
        const { error: stockError } = await supabase
          .from('daily_stock_entries')
          .upsert(stockUpdates);
        
        if (stockError) throw stockError;
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

      // Save credit entries - don't let it fail the entire save
      try {
        await saveCreditEntries();
      } catch (error: any) {
        console.warn('Credit entries save skipped:', error.message);
      }

      alert('✅ Changes saved successfully!');
    } catch (error: any) {
      alert('❌ Error saving changes: ' + error.message);
    }
  };

  const handleApproveAndLock = async () => {
    // Capture selectedShop at the very start and validate
    const shopId = selectedShop;
    if (!shopId) {
      alert('❌ Please select a shop first');
      return;
    }
    
    if (!cashEntry.id) {
      alert('❌ Cash entry not loaded. Please refresh and try again.');
      return;
    }

    try {
      // Confirm action
      const confirmed = confirm(
        'This will:\n' +
        '1. Save all current data\n' +
        '2. Carry forward stock to next day\n' +
        '3. Lock this entry and approve\n\n' +
        'Continue?'
      );
      
      if (!confirmed) return;
      
      // ============================================
      // ACTION 1: Save current data
      // ============================================
      await saveCashEntry();
      
      // ============================================
      // ACTION 2: Carry forward to NEXT day
      // ============================================
      
      const currentDate = new Date(selectedDate);
      const nextDate = new Date(currentDate);
      nextDate.setDate(nextDate.getDate() + 1);
      const nextDateStr = nextDate.toISOString().split('T')[0];
      
      console.log(`Carrying forward from ${selectedDate} to ${nextDateStr}`);
      
      // Get today's stock entries with closing stock
      const { data: todayStockEntries } = await supabase
        .from('daily_stock_entries')
        .select('product_id, closing_stock, closing_stock_value')
        .eq('shop_id', shopId)
        .eq('entry_date', selectedDate);
      
      if (todayStockEntries && todayStockEntries.length > 0) {
        // Fetch all existing tomorrow's entries in one query
        const { data: existingEntries } = await supabase
          .from('daily_stock_entries')
          .select('id, product_id')
          .eq('shop_id', shopId)
          .eq('entry_date', nextDateStr);
        
        // Create a map of existing entries for quick lookup
        const existingMap = new Map(
          (existingEntries || []).map(e => [e.product_id, e.id])
        );
        
        // Prepare batch operations
        const toUpdate: Array<{ id: string; opening_stock: number }> = [];
        const toInsert: Array<Omit<DailyStockEntry, 'id' | 'created_at' | 'updated_at' | 'product'>> = [];
        
        for (const entry of todayStockEntries) {
          const existingId = existingMap.get(entry.product_id);
          
          if (existingId) {
            // Prepare update
            toUpdate.push({
              id: existingId,
              opening_stock: entry.closing_stock
            });
          } else {
            // Prepare insert
            toInsert.push({
              shop_id: shopId,
              product_id: entry.product_id,
              entry_date: nextDateStr,
              opening_stock: entry.closing_stock,
              purchases: 0,
              transfer: 0,
              closing_stock: entry.closing_stock,
              sold_qty: 0,
              sale_value: 0,
              closing_stock_value: entry.closing_stock_value || 0
            });
          }
        }
        
        // Execute batch operations
        if (toUpdate.length > 0) {
          // Use individual updates since we only have id and opening_stock
          // upsert would fail if row doesn't exist (requires shop_id, product_id, entry_date)
          const updatePromises = toUpdate.map(item => 
            supabase
              .from('daily_stock_entries')
              .update({ opening_stock: item.opening_stock })
              .eq('id', item.id)
          );
          
          const results = await Promise.all(updatePromises);
          const errors = results.filter(r => r.error != null);
          if (errors.length > 0) {
            console.error('Update errors:', errors);
            throw errors[0].error;
          }
        }
        
        if (toInsert.length > 0) {
          const { error: insertError } = await supabase
            .from('daily_stock_entries')
            .insert(toInsert);
          if (insertError) throw insertError;
        }
        
        console.log('Stock entries carried forward successfully!');
      }
      
      // Carry forward Counter Closing → Counter Opening
      const { data: todayCashEntry } = await supabase
        .from('daily_cash_entries')
        .select('counter_closing')
        .eq('shop_id', shopId)
        .eq('entry_date', selectedDate)
        .single();
      
      if (todayCashEntry && todayCashEntry.counter_closing != null) {
        // Check if tomorrow's cash entry exists
        const { data: existingCashEntry } = await supabase
          .from('daily_cash_entries')
          .select('id')
          .eq('shop_id', shopId)
          .eq('entry_date', nextDateStr)
          .single();
        
        if (existingCashEntry) {
          // Update counter opening
          await supabase
            .from('daily_cash_entries')
            .update({ 
              counter_opening: todayCashEntry.counter_closing 
            })
            .eq('id', existingCashEntry.id);
        } else {
          // Insert new cash entry
          await supabase
            .from('daily_cash_entries')
            .insert({
              shop_id: shopId,
              entry_date: nextDateStr,
              counter_opening: todayCashEntry.counter_closing,
              denom_500: 0,
              denom_200: 0,
              denom_100: 0,
              denom_50: 0,
              denom_20: 0,
              denom_10: 0,
              denom_5: 0,
              denom_2: 0,
              denom_1: 0,
              google_pay: 0,
              phonepe_paytm: 0,
              bank_transfer: 0,
              counter_closing: 0,
              cash_shortage: 0
            });
        }
        console.log('Counter opening carried forward successfully!');
      }
      
      // ============================================
      // ACTION 3: Lock entry & approve
      // ============================================
      await supabase
        .from('daily_cash_entries')
        .update({
          is_locked: true,
          is_approved: true,
          approved_at: new Date().toISOString(),
        })
        .eq('id', cashEntry.id);

      // Update local state instead of reloading - prevents race conditions
      if (cashEntry) {
        setCashEntry(prev => ({
          ...(prev || {}),
          is_locked: true,
          is_approved: true,
          approved_at: new Date().toISOString(),
        }));
      }

      alert(
        '✅ Success!\n\n' +
        '• Data saved\n' +
        '• Stock carried forward to ' + nextDateStr + '\n' +
        '• Entry approved and locked'
      );
    } catch (error: any) {
      console.error('Error in approve and lock:', error);
      
      // Improved error handling
      if (error.code === 'PGRST116') {
        alert('❌ Entry not found. Please refresh and try again.');
      } else if (error.message?.includes('timeout') || error.message?.includes('timed out')) {
        alert('❌ Request timeout. Please check your connection and try again.');
      } else if (error.message?.includes('duplicate') || error.code === '23505') {
        alert('❌ Entry already exists. Please refresh the page.');
      } else if (error.message?.includes('network') || error.message?.includes('fetch')) {
        alert('❌ Network error. Please check your internet connection and try again.');
      } else {
        alert(`❌ Error: ${error.message || 'Unknown error occurred'}`);
      }
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

      // Update local state instead of reloading - prevents race conditions
      setCashEntry(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          is_locked: false,
          is_approved: false,
          unlock_requested: false,
          approved_at: null,
        };
      });
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

  const resetFilters = () => {
    setBrandFilter('');
    setSizeFilter('');
    setTypeFilter('');
  };

  // Get unique values for filters
  const uniqueBrands = useMemo(() => {
    const brands = stockEntries
      .map(e => e.product?.brand_name)
      .filter(Boolean) as string[];
    return Array.from(new Set(brands)).sort();
  }, [stockEntries]);

  const uniqueSizes = useMemo(() => {
    const sizes = stockEntries
      .map(e => e.product?.product_size?.size_ml)
      .filter(Boolean) as number[];
    return Array.from(new Set(sizes)).sort((a, b) => a - b);
  }, [stockEntries]);

  const uniqueTypes = useMemo(() => {
    const types = stockEntries
      .map(e => e.product?.product_type?.name)
      .filter(Boolean) as string[];
    return Array.from(new Set(types)).sort();
  }, [stockEntries]);

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
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
            <h1 className="text-3xl font-bold text-primary">Entry View/Edit</h1>

            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4 w-full lg:w-auto">
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

              <Button 
                variant="secondary" 
                onClick={handleRefresh}
                disabled={dataLoading}
                className="whitespace-nowrap"
              >
                <RefreshCw size={16} className={`mr-2 ${dataLoading ? 'animate-spin' : ''}`} />
                {dataLoading ? 'Refreshing...' : 'Refresh Data'}
              </Button>

              <Button 
                variant="secondary" 
                onClick={async () => {
                  if (selectedShop && selectedDate) {
                    const success = await carryForwardFromPreviousDay(selectedShop, selectedDate);
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
            </div>
          </div>
        </div>

        {/* Data Loading Indicator */}
        {dataLoading && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 flex items-center">
            <RefreshCw size={20} className="animate-spin text-blue-600 mr-3" />
            <span className="text-blue-700 font-medium">Loading data...</span>
          </div>
        )}

        {/* Filter Section */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h3 className="text-lg font-semibold mb-3 text-primary">🔍 Filters</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Brand Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Brand</label>
              <Select
                value={brandFilter}
                onChange={(e) => setBrandFilter(e.target.value)}
                className="w-full"
              >
                <option value="">All Brands</option>
                {uniqueBrands.map(brand => (
                  <option key={brand} value={brand}>{brand}</option>
                ))}
              </Select>
            </div>
            
            {/* Size Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Size (ml)</label>
              <Select
                value={sizeFilter}
                onChange={(e) => setSizeFilter(e.target.value)}
                className="w-full"
              >
                <option value="">All Sizes</option>
                {uniqueSizes.map(size => (
                  <option key={size} value={size.toString()}>{size} ml</option>
                ))}
              </Select>
            </div>
            
            {/* Type Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
              <Select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="w-full"
              >
                <option value="">All Types</option>
                {uniqueTypes.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </Select>
            </div>
            
            {/* Reset Button */}
            <div className="flex items-end">
              <Button
                onClick={resetFilters}
                variant="outline"
                className="w-full"
              >
                🔄 Reset Filters
              </Button>
            </div>
          </div>
        </div>

        {/* Stock Entry Table */}
        <div className="mb-6">
          <StockEntryTable
            entries={stockEntries}
            onUpdate={updateStockEntry}
            isLocked={false}
            brandFilter={brandFilter}
            sizeFilter={sizeFilter}
            typeFilter={typeFilter}
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

        </div>

        {/* Bank Deposit / Cash to Counter */}
        <div className="mb-6">
          <Card>
            <CardHeader>
              <CardTitle>Bank Deposit / Cash to Counter</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <label className="text-sm font-medium text-gray-700">Bank Deposit (for Stock Purchase)</label>
                <p className="text-xs text-gray-500 mb-1">Amount deposited to bank - recorded as expense</p>
                <Input
                  type="number"
                  value={cashEntry.bank_deposit === 0 ? '' : cashEntry.bank_deposit}
                  placeholder="0"
                  onChange={(e) => updateCashDenomination('bank_deposit', parseFloat(e.target.value) || 0)}
                  step="0.01"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Cash to Owner</label>
                <p className="text-xs text-gray-500 mb-1">Amount given to owner for personal use</p>
                <Input
                  type="number"
                  value={cashEntry.cash_to_house === 0 ? '' : cashEntry.cash_to_house}
                  placeholder="0"
                  onChange={(e) => updateCashDenomination('cash_to_house', parseFloat(e.target.value) || 0)}
                  step="0.01"
                />
              </div>
              <div className="pt-2 border-t">
                <div className="flex justify-between text-lg font-bold">
                  <span>Total:</span>
                  <span className="text-secondary">{formatCurrency((cashEntry.bank_deposit || 0) + (cashEntry.cash_to_house || 0))}</span>
                </div>
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
              coins: cashEntry.coins || 0,
              digital_payments: cashEntry.phonepe_paytm || 0,
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

        {/* Credit Sales / Debtors Section */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-[#722F37]">
              💳 Credit Sales / Debtors
            </h3>
            <Button
              onClick={handleAddCreditEntry}
              variant="secondary"
              size="sm"
            >
              + Add
            </Button>
          </div>
          
          <p className="text-sm text-gray-500 mb-4">
            Bottles taken without immediate payment (credit/lending)
          </p>
          
          {creditEntries.length === 0 ? (
            <p className="text-gray-400 text-center py-4">No credit sales added</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-[#722F37] text-white">
                  <tr>
                    <th className="px-4 py-2 text-left w-16">S.No</th>
                    <th className="px-4 py-2 text-left">Person Name</th>
                    <th className="px-4 py-2 text-right">Amount (₹)</th>
                    <th className="px-4 py-2 text-center w-20">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {creditEntries.map((entry, index) => (
                    <tr key={index} className="border-b hover:bg-gray-50">
                      <td className="px-4 py-2">{index + 1}</td>
                      <td className="px-4 py-2">
                        <input
                          type="text"
                          list={`debtor-list-${index}`}
                          value={entry.person_name}
                          onChange={(e) => handleCreditEntryChange(index, 'person_name', e.target.value)}
                          placeholder="Enter person name"
                          className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#722F37]"
                        />
                        <datalist id={`debtor-list-${index}`}>
                          {previousDebtors.map((name, i) => (
                            <option key={i} value={name} />
                          ))}
                        </datalist>
                      </td>
                      <td className="px-4 py-2">
                        <input
                          type="number"
                          value={entry.amount || ''}
                          onChange={(e) => handleCreditEntryChange(index, 'amount', e.target.value)}
                          placeholder="0"
                          className="w-full border border-gray-300 rounded px-3 py-2 text-right focus:outline-none focus:ring-2 focus:ring-[#722F37]"
                          step="0.01"
                        />
                      </td>
                      <td className="px-4 py-2 text-center">
                        <button
                          onClick={() => handleDeleteCreditEntry(index)}
                          className="text-red-500 hover:text-red-700"
                          title="Delete"
                        >
                          🗑️
                        </button>
                      </td>
                    </tr>
                  ))}
                  {/* Total Row */}
                  <tr className="bg-yellow-100 font-bold">
                    <td className="px-4 py-3" colSpan={2}>TOTAL CREDIT:</td>
                    <td className="px-4 py-3 text-right text-[#722F37]">
                      {formatCurrency(totalCredit)}
                    </td>
                    <td></td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Summary Cards */}
        <h3 className="text-xl font-bold text-[#722F37] mb-4">Today Trend</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mb-6">
          <Card className={`border-2 ${
            cashDifference === 0 
              ? 'bg-gradient-to-br from-green-50 to-green-100 border-green-300' 
              : cashDifference > 0 
                ? 'bg-gradient-to-br from-green-50 to-green-100 border-green-300' 
                : 'bg-gradient-to-br from-red-50 to-red-100 border-red-300'
          }`}>
            <CardHeader>
              <CardTitle className={
                cashDifference === 0 
                  ? 'text-green-700' 
                  : cashDifference > 0 
                    ? 'text-green-700' 
                    : 'text-red-700'
              }>Cash Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-3xl font-bold ${
                cashDifference === 0 
                  ? 'text-green-600' 
                  : cashDifference > 0 
                    ? 'text-green-600' 
                    : 'text-red-600'
              }`}>
                {cashDifference === 0 
                  ? 'COUNTER CLOSING BALANCED - NO SHORTAGE NOR EXCESS' 
                  : cashDifference > 0 
                    ? `EXCESS CASH = ${formatCurrency(cashDifference)}` 
                    : `SHORTAGE OF CASH = ${formatCurrency(Math.abs(cashDifference))}`
                }
              </div>
              <p className="text-xs text-gray-500 mt-2">
                (Credit {formatCurrency(totalCredit)} + Physical Cash {formatCurrency(physicalCash)}) - Expected Counter Closing ({formatCurrency(counterClosing)})
              </p>
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
              <p className="text-xs text-gray-500 mt-2">
                Total Cash + Total UPI/Bank
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row justify-end gap-3 sm:gap-4">
          <Button onClick={saveCashEntry} size="lg" className="w-full sm:w-auto">
            Save Changes
          </Button>
          <Button variant="secondary" onClick={handleGeneratePDF} size="lg" className="w-full sm:w-auto">
            <FileDown size={20} className="mr-2" />
            Generate PDF
          </Button>
          {/* Show Approve & Lock when NOT approved yet */}
          {(!cashEntry.is_locked || !cashEntry.is_approved) && (
            <Button onClick={handleApproveAndLock} size="lg" className="w-full sm:w-auto">
              <Lock size={20} className="mr-2" />
              Approve & Lock
            </Button>
          )}
          {/* Show Unlock ONLY when both locked AND approved */}
          {cashEntry.is_locked && cashEntry.is_approved && (
            <Button variant="destructive" onClick={handleUnlock} size="lg" className="w-full sm:w-auto">
              <Unlock size={20} className="mr-2" />
              Unlock
            </Button>
          )}
        </div>
      </main>
    </div>
  );
}
