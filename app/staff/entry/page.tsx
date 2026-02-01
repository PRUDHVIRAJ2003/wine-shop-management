'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { DailyStockEntry, DailyCashEntry, Product, ExtraTransaction, User, Shop, CreditEntry } from '@/types';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import StockEntryTable from '@/components/StockEntryTable';
import CashDenomination from '@/components/CashDenomination';
import ExtraTransactions from '@/components/ExtraTransactions';
import { Wine, LogOut, Plus, Calendar } from 'lucide-react';
import { formatCurrency, getTodayDate, getYesterdayDate } from '@/lib/utils';
import ProductModal from '@/components/ProductModal';

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
    unlock_requested: false,
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

  // New business logic: Cash Shortage/Excess
  // Compare expected counter_closing with actual cash + credit sales
  const actualCashAtCounter = physicalCash;
  const cashDifference = useMemo(() => {
    return (totalCredit + actualCashAtCounter) - counterClosing;
  }, [totalCredit, actualCashAtCounter, counterClosing]);

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

  useEffect(() => {
    if (user && shop) {
      initializeData();
      loadPreviousDebtors();
    }
  }, [user, shop, selectedDate]);

  const initializeData = async () => {
    if (!user?.shop_id) return;
    
    // First, carry forward from previous day if needed
    await carryForwardFromPreviousDay(user.shop_id, selectedDate);
    
    // Then load today's data
    await loadData();
    
    // Load credit entries - don't let it fail the entire load
    try {
      await loadCreditEntries();
    } catch (error: any) {
      console.warn('Credit entries load skipped:', error.message);
    }
  };

  const loadPreviousDebtors = async () => {
    // Capture shop_id at the start and validate
    const shopId = user?.shop_id;
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
    // Capture shop_id at the start and validate
    const shopId = user?.shop_id;
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
    // Capture shop_id at the start and validate
    const shopId = user?.shop_id;
    if (!shopId) return;

    // Load products for this shop
    const { data: productsData } = await supabase
      .from('products')
      .select(`
        *,
        product_type:product_types(*),
        product_size:product_sizes(*)
      `)
      .eq('shop_id', shopId)
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
    // Capture shop_id at the start and validate
    const shopId = user?.shop_id;
    if (!shopId) return;

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
      .eq('shop_id', shopId)
      .eq('entry_date', selectedDate);

    if (existingEntries && existingEntries.length > 0) {
      setStockEntries(existingEntries as any);
    } else {
      // Validate again before inserting - prevent race conditions
      if (!shopId || prods.length === 0) {
        console.warn('[loadStockEntries] Skipping insert - shopId or prods invalid');
        return;
      }
      
      // Create new entries for today with yesterday's closing stock as opening
      const yesterday = getYesterdayDate(new Date(selectedDate));
      
      const { data: yesterdayEntries } = await supabase
        .from('daily_stock_entries')
        .select('product_id, closing_stock')
        .eq('shop_id', shopId)
        .eq('entry_date', yesterday);

      const yesterdayMap = new Map(yesterdayEntries?.map(e => [e.product_id, e.closing_stock]) || []);

      const newEntries = await Promise.all(
        prods.map(async (product) => {
          try {
            // Final validation before each insert - prevent race conditions
            const insertShopId = user?.shop_id;
            if (!insertShopId) {
              console.warn('[loadStockEntries] shopId null at insert time, skipping');
              return null;
            }
            
            const opening_stock = yesterdayMap.get(product.id) || 0;
            
            const { data: newEntry, error } = await supabase
              .from('daily_stock_entries')
              .insert({
                shop_id: insertShopId,
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

            if (error) {
              console.error('[loadStockEntries] Insert error:', error);
              return null;
            }
            return newEntry;
          } catch (err) {
            console.error('[loadStockEntries] Unexpected error:', err);
            return null;
          }
        })
      );

      const validEntries = newEntries.filter(Boolean);
      if (validEntries.length < prods.length) {
        console.warn(`[loadStockEntries] ${prods.length - validEntries.length} product(s) failed to create entries`);
      }
      setStockEntries(validEntries as any);
    }
  };

  const loadCashEntry = async () => {
    // Capture shop_id at the start and validate
    const shopId = user?.shop_id;
    if (!shopId) return;

    const { data: existingCash } = await supabase
      .from('daily_cash_entries')
      .select('*')
      .eq('shop_id', shopId)
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
      // Validate again before inserting - prevent race conditions
      if (!shopId) {
        console.warn('[loadCashEntry] Skipping insert - shopId invalid');
        return;
      }
      
      // Get yesterday's counter closing
      const yesterday = getYesterdayDate(new Date(selectedDate));
      const { data: yesterdayCash } = await supabase
        .from('daily_cash_entries')
        .select('counter_closing')
        .eq('shop_id', shopId)
        .eq('entry_date', yesterday)
        .single();

      const counter_opening = yesterdayCash?.counter_closing || 0;
      
      try {
        // Final validation before insert - prevent race conditions
        const insertShopId = user?.shop_id;
        if (!insertShopId) {
          console.warn('[loadCashEntry] shopId became null during async, skipping insert');
          return;
        }
        
        // Create new cash entry
        const { data: newCash, error } = await supabase
          .from('daily_cash_entries')
          .insert({
            shop_id: insertShopId,
            entry_date: selectedDate,
            counter_opening,
          })
          .select()
          .single();

        if (error) {
          console.error('[loadCashEntry] Insert error:', error);
          return;
        }

        if (newCash) {
          setCashEntry(newCash);
        }
      } catch (err) {
        console.error('[loadCashEntry] Unexpected error:', err);
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
    // Capture shop_id at the start and validate
    const shopId = user?.shop_id;
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

  const saveAllData = async () => {
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

      // Save credit entries - don't let it fail the entire save
      try {
        await saveCreditEntries();
      } catch (error: any) {
        console.warn('Credit entries save skipped:', error.message);
      }

      alert('✅ Data saved successfully!');
    } catch (error: any) {
      alert('❌ Error saving data: ' + error.message);
      throw error;
    }
  };

  const handleLockAndSend = async () => {
    // Capture shop_id at the very start and validate
    const shopId = user?.shop_id;
    if (!shopId) {
      alert('❌ Shop ID not found. Please log out and log in again.');
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
        '3. Lock this entry for approval\n\n' +
        'Continue?'
      );
      
      if (!confirmed) return;
      
      setLoading(true);
      
      // ============================================
      // ACTION 1: Save current data
      // ============================================
      await saveAllData();
      
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
            // Prepare insert - shop_id is validated above, safe to use
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
          const { error: updateError } = await supabase
            .from('daily_stock_entries')
            .upsert(toUpdate);
          if (updateError) throw updateError;
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
      // ACTION 3: Lock entry & send for approval
      // ============================================
      // Update daily_cash_entries to set is_locked = true
      const { error: lockError } = await supabase
        .from('daily_cash_entries')
        .update({ 
          is_locked: true, 
          locked_at: new Date().toISOString() 
        })
        .eq('shop_id', shopId)
        .eq('entry_date', selectedDate);
      
      if (lockError) throw lockError;
      
      // Create approval request
      const { error: approvalError } = await supabase
        .from('approval_requests')
        .insert({
          shop_id: shopId,
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
      
      alert(
        '✅ Success!\n\n' +
        '• Data saved\n' +
        '• Stock carried forward to ' + nextDateStr + '\n' +
        '• Entry locked and sent for approval'
      );
      
    } catch (error: any) {
      console.error('Error in lock and approve:', error);
      
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

        </div>

        {/* Bank Deposit / Cash to Counter */}
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
                disabled={cashEntry.is_locked}
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
                disabled={cashEntry.is_locked}
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

        {/* Cash Denomination */}
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

        {/* Credit Sales / Debtors Section */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-[#722F37]">
              💳 Credit Sales / Debtors
            </h3>
            <Button
              onClick={handleAddCreditEntry}
              disabled={cashEntry.is_locked}
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
                          disabled={cashEntry.is_locked}
                          placeholder="Enter person name"
                          className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#722F37] disabled:bg-gray-100"
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
                          disabled={cashEntry.is_locked}
                          placeholder="0"
                          className="w-full border border-gray-300 rounded px-3 py-2 text-right focus:outline-none focus:ring-2 focus:ring-[#722F37] disabled:bg-gray-100"
                          step="0.01"
                        />
                      </td>
                      <td className="px-4 py-2 text-center">
                        <button
                          onClick={() => handleDeleteCreditEntry(index)}
                          disabled={cashEntry.is_locked}
                          className="text-red-500 hover:text-red-700 disabled:opacity-50"
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
                  ? 'NO EXCESS/SHORTAGE' 
                  : cashDifference > 0 
                    ? `EXCESS CASH = ${formatCurrency(cashDifference)}` 
                    : `CASH SHORTAGE = ${formatCurrency(Math.abs(cashDifference))}`
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
        <div className="flex justify-end space-x-4">
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
