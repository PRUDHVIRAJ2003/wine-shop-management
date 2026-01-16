'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { User, Shop } from '@/types';
import AdminSidebar from '@/components/AdminSidebar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { FileDown, Wallet } from 'lucide-react';
import { formatCurrency, getTodayDate } from '@/lib/utils';

interface DepositEntry {
  id: string;
  entry_date: string;
  shop_id: string;
  shop_name: string;
  bank_deposit: number;
  cash_to_house: number;
  total: number;
  is_locked: boolean;
  is_approved: boolean;
}

export default function DepositsPage() {
  const router = useRouter();
  const supabase = createClient();
  
  const [user, setUser] = useState<User | null>(null);
  const [shops, setShops] = useState<Shop[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filter states
  const [selectedShop, setSelectedShop] = useState<string>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState(getTodayDate());
  const [selectedMonth, setSelectedMonth] = useState('');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  
  // Data state
  const [deposits, setDeposits] = useState<DepositEntry[]>([]);
  
  // Totals
  const [dailyTotal, setDailyTotal] = useState({ bank_deposit: 0, cash_to_house: 0, total: 0 });
  const [monthlyTotal, setMonthlyTotal] = useState({ bank_deposit: 0, cash_to_house: 0, total: 0 });
  const [grandTotal, setGrandTotal] = useState({ bank_deposit: 0, cash_to_house: 0, total: 0 });

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (user) {
      loadShops();
    }
  }, [user]);

  useEffect(() => {
    if (shops.length > 0) {
      loadDeposits();
    }
  }, [shops, selectedShop, startDate, endDate, selectedMonth, selectedYear]);

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
    setLoading(false);
  };

  const loadShops = async () => {
    const { data } = await supabase
      .from('shops')
      .select('*')
      .order('name');
    
    if (data) {
      setShops(data);
    }
  };

  const loadDeposits = async () => {
    let query = supabase
      .from('daily_cash_entries')
      .select('id, entry_date, shop_id, bank_deposit, cash_to_house, is_locked, is_approved')
      .order('entry_date', { ascending: false });

    // Filter by shop
    if (selectedShop && selectedShop !== 'all') {
      query = query.eq('shop_id', selectedShop);
    }

    // Filter by date range
    if (startDate) {
      query = query.gte('entry_date', startDate);
    }
    if (endDate) {
      query = query.lte('entry_date', endDate);
    }

    // Filter by month/year
    if (selectedMonth && selectedYear) {
      const monthStart = `${selectedYear}-${selectedMonth.padStart(2, '0')}-01`;
      const lastDay = new Date(parseInt(selectedYear), parseInt(selectedMonth), 0).getDate();
      const monthEnd = `${selectedYear}-${selectedMonth.padStart(2, '0')}-${lastDay}`;
      query = query.gte('entry_date', monthStart).lte('entry_date', monthEnd);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error loading deposits:', error);
      return;
    }

    if (data) {
      // Map data and add shop names
      const depositEntries: DepositEntry[] = data
        .filter(entry => (entry.bank_deposit && entry.bank_deposit > 0) || (entry.cash_to_house && entry.cash_to_house > 0))
        .map(entry => {
          const shop = shops.find(s => s.id === entry.shop_id);
          return {
            ...entry,
            shop_name: shop?.name || 'Unknown',
            bank_deposit: entry.bank_deposit || 0,
            cash_to_house: entry.cash_to_house || 0,
            total: (entry.bank_deposit || 0) + (entry.cash_to_house || 0)
          };
        });

      setDeposits(depositEntries);

      // Calculate totals
      calculateTotals(depositEntries);
    }
  };

  const calculateTotals = (entries: DepositEntry[]) => {
    // Grand total (all filtered entries)
    const grand = entries.reduce((acc, entry) => ({
      bank_deposit: acc.bank_deposit + entry.bank_deposit,
      cash_to_house: acc.cash_to_house + entry.cash_to_house,
      total: acc.total + entry.total
    }), { bank_deposit: 0, cash_to_house: 0, total: 0 });

    setGrandTotal(grand);

    // Daily total (today's date)
    const today = getTodayDate();
    const daily = entries
      .filter(e => e.entry_date === today)
      .reduce((acc, entry) => ({
        bank_deposit: acc.bank_deposit + entry.bank_deposit,
        cash_to_house: acc.cash_to_house + entry.cash_to_house,
        total: acc.total + entry.total
      }), { bank_deposit: 0, cash_to_house: 0, total: 0 });

    setDailyTotal(daily);

    // Monthly total (current month)
    const currentMonth = new Date().getMonth() + 1;
    const currentYear = new Date().getFullYear();
    const monthly = entries
      .filter(e => {
        const entryDate = new Date(e.entry_date);
        return entryDate.getMonth() + 1 === currentMonth && entryDate.getFullYear() === currentYear;
      })
      .reduce((acc, entry) => ({
        bank_deposit: acc.bank_deposit + entry.bank_deposit,
        cash_to_house: acc.cash_to_house + entry.cash_to_house,
        total: acc.total + entry.total
      }), { bank_deposit: 0, cash_to_house: 0, total: 0 });

    setMonthlyTotal(monthly);
  };

  const handleExportPDF = () => {
    alert('PDF export feature coming soon!');
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  const resetFilters = () => {
    setSelectedShop('all');
    setStartDate('');
    setEndDate(getTodayDate());
    setSelectedMonth('');
    setSelectedYear(new Date().getFullYear().toString());
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
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-6">
            <div className="flex items-center mb-2">
              <Wallet className="mr-3 text-primary" size={32} />
              <h1 className="text-3xl font-bold text-primary">Deposits & Cash Tracking</h1>
            </div>
            <p className="text-gray-600">Track bank deposits and cash given to owner</p>
          </div>

          {/* Filters */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Filters</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
                {/* Shop Filter */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Shop</label>
                  <Select
                    value={selectedShop}
                    onChange={(e) => setSelectedShop(e.target.value)}
                    className="w-full"
                  >
                    <option value="all">All Shops</option>
                    {shops.map(shop => (
                      <option key={shop.id} value={shop.id}>{shop.name}</option>
                    ))}
                  </Select>
                </div>

                {/* Start Date */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full"
                  />
                </div>

                {/* End Date */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    max={getTodayDate()}
                    className="w-full"
                  />
                </div>

                {/* Month */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Month</label>
                  <Select
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    className="w-full"
                  >
                    <option value="">All Months</option>
                    <option value="1">January</option>
                    <option value="2">February</option>
                    <option value="3">March</option>
                    <option value="4">April</option>
                    <option value="5">May</option>
                    <option value="6">June</option>
                    <option value="7">July</option>
                    <option value="8">August</option>
                    <option value="9">September</option>
                    <option value="10">October</option>
                    <option value="11">November</option>
                    <option value="12">December</option>
                  </Select>
                </div>

                {/* Year */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Year</label>
                  <Select
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(e.target.value)}
                    className="w-full"
                  >
                    {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map(year => (
                      <option key={year} value={year.toString()}>{year}</option>
                    ))}
                  </Select>
                </div>
              </div>

              <div className="flex justify-end mt-4 space-x-2">
                <Button variant="outline" onClick={resetFilters}>
                  Reset Filters
                </Button>
                <Button variant="secondary" onClick={handleExportPDF}>
                  <FileDown size={20} className="mr-2" />
                  Export PDF
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
              <CardHeader>
                <CardTitle className="text-blue-700">Daily Total (Today)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm">Bank Deposit:</span>
                    <span className="font-bold">{formatCurrency(dailyTotal.bank_deposit)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Cash to Owner:</span>
                    <span className="font-bold">{formatCurrency(dailyTotal.cash_to_house)}</span>
                  </div>
                  <div className="flex justify-between border-t pt-2">
                    <span className="font-bold">Total:</span>
                    <span className="text-xl font-bold text-blue-600">{formatCurrency(dailyTotal.total)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
              <CardHeader>
                <CardTitle className="text-green-700">Monthly Total</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm">Bank Deposit:</span>
                    <span className="font-bold">{formatCurrency(monthlyTotal.bank_deposit)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Cash to Owner:</span>
                    <span className="font-bold">{formatCurrency(monthlyTotal.cash_to_house)}</span>
                  </div>
                  <div className="flex justify-between border-t pt-2">
                    <span className="font-bold">Total:</span>
                    <span className="text-xl font-bold text-green-600">{formatCurrency(monthlyTotal.total)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
              <CardHeader>
                <CardTitle className="text-purple-700">Grand Total (Filtered)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm">Bank Deposit:</span>
                    <span className="font-bold">{formatCurrency(grandTotal.bank_deposit)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Cash to Owner:</span>
                    <span className="font-bold">{formatCurrency(grandTotal.cash_to_house)}</span>
                  </div>
                  <div className="flex justify-between border-t pt-2">
                    <span className="font-bold">Total:</span>
                    <span className="text-xl font-bold text-purple-600">{formatCurrency(grandTotal.total)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Deposits Table */}
          <Card>
            <CardHeader>
              <CardTitle>Deposits Records ({deposits.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {deposits.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No deposits found for the selected filters
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-primary text-white">
                      <tr>
                        <th className="px-4 py-3 text-left">Date</th>
                        <th className="px-4 py-3 text-left">Shop Name</th>
                        <th className="px-4 py-3 text-right">Bank Deposit</th>
                        <th className="px-4 py-3 text-right">Cash to Owner</th>
                        <th className="px-4 py-3 text-right">Total</th>
                        <th className="px-4 py-3 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {deposits.map((deposit, index) => (
                        <tr key={deposit.id} className={index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                          <td className="px-4 py-3">{new Date(deposit.entry_date).toLocaleDateString('en-IN')}</td>
                          <td className="px-4 py-3">{deposit.shop_name}</td>
                          <td className="px-4 py-3 text-right">{formatCurrency(deposit.bank_deposit)}</td>
                          <td className="px-4 py-3 text-right">{formatCurrency(deposit.cash_to_house)}</td>
                          <td className="px-4 py-3 text-right font-bold">{formatCurrency(deposit.total)}</td>
                          <td className="px-4 py-3 text-center">
                            {deposit.is_approved ? (
                              <span className="px-2 py-1 text-xs rounded bg-green-100 text-green-700">Approved</span>
                            ) : deposit.is_locked ? (
                              <span className="px-2 py-1 text-xs rounded bg-yellow-100 text-yellow-700">Locked</span>
                            ) : (
                              <span className="px-2 py-1 text-xs rounded bg-gray-100 text-gray-700">Unlocked</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
