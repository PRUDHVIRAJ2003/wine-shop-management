'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { User, Shop, ApprovalRequest } from '@/types';
import AdminSidebar from '@/components/AdminSidebar';
import DashboardCharts from '@/components/DashboardCharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Select } from '@/components/ui/Select';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { formatCurrency, formatDate } from '@/lib/utils';
import { TrendingUp, Package, DollarSign, AlertCircle } from 'lucide-react';

export default function AdminDashboard() {
  const router = useRouter();
  const supabase = createClient();
  
  const [user, setUser] = useState<User | null>(null);
  const [shops, setShops] = useState<Shop[]>([]);
  const [selectedShop, setSelectedShop] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(true);
  
  // Dashboard data
  const [summaryData, setSummaryData] = useState({
    counterOpening: 0,
    counterClosing: 0,
    saleValue: 0,
    stockValue: 0,
  });
  
  const [pendingApprovals, setPendingApprovals] = useState<ApprovalRequest[]>([]);
  
  const [chartData, setChartData] = useState({
    brandSales: [] as { name: string; sales: number }[],
    productBreakdown: [] as { name: string; value: number }[],
    dailyTrend: [] as { date: string; sales: number }[],
  });

  useEffect(() => {
    checkAuth();
  }, []);

  // Auto-reload dashboard when shop or date changes
  useEffect(() => {
    if (user && selectedShop && selectedDate) {
      loadDashboardData();
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

  const loadDashboardData = async () => {
    if (!selectedShop) return;

    // Load cash entry for summary
    const { data: cashEntry } = await supabase
      .from('daily_cash_entries')
      .select('*')
      .eq('shop_id', selectedShop)
      .eq('entry_date', selectedDate)
      .single();

    // Load stock entries for summary
    const { data: stockEntries } = await supabase
      .from('daily_stock_entries')
      .select(`
        *,
        product:products(
          *,
          product_type:product_types(*)
        )
      `)
      .eq('shop_id', selectedShop)
      .eq('entry_date', selectedDate);

    if (cashEntry && stockEntries) {
      setSummaryData({
        counterOpening: cashEntry.counter_opening,
        counterClosing: cashEntry.counter_closing,
        saleValue: cashEntry.total_sale_value,
        stockValue: stockEntries.reduce((sum, e) => sum + e.closing_stock_value, 0),
      });

      // Brand sales data
      const brandSalesMap = new Map<string, number>();
      stockEntries.forEach((entry: any) => {
        const brand = entry.product?.brand_name || 'Unknown';
        brandSalesMap.set(brand, (brandSalesMap.get(brand) || 0) + entry.sale_value);
      });
      
      const brandSales = Array.from(brandSalesMap.entries())
        .map(([name, sales]) => ({ name, sales }))
        .sort((a, b) => b.sales - a.sales)
        .slice(0, 10);

      // Product type breakdown
      const typeBreakdownMap = new Map<string, number>();
      stockEntries.forEach((entry: any) => {
        const type = entry.product?.product_type?.name || 'Unknown';
        typeBreakdownMap.set(type, (typeBreakdownMap.get(type) || 0) + entry.sale_value);
      });
      
      const productBreakdown = Array.from(typeBreakdownMap.entries())
        .map(([name, value]) => ({ name, value }));

      setChartData(prev => ({
        ...prev,
        brandSales,
        productBreakdown,
      }));
    }

    // Load daily trend (last 7 days)
    const dates = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      dates.push(date.toISOString().split('T')[0]);
    }

    const trendData = await Promise.all(
      dates.map(async (date) => {
        const { data } = await supabase
          .from('daily_cash_entries')
          .select('total_sale_value')
          .eq('shop_id', selectedShop)
          .eq('entry_date', date)
          .single();

        return {
          date: formatDate(date),
          sales: data?.total_sale_value || 0,
        };
      })
    );

    setChartData(prev => ({
      ...prev,
      dailyTrend: trendData,
    }));

    // Load pending approvals with shop and user info
    const { data: approvals } = await supabase
      .from('approval_requests')
      .select(`
        *,
        shop:shops(name),
        user:users(username)
      `)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (approvals) {
      setPendingApprovals(approvals);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  const handleShopChange = (shopId: string) => {
    setSelectedShop(shopId);
    localStorage.setItem('selectedShopId', shopId);
  };

  const handleApproveRequest = async (requestId: string, shopId: string, entryDate: string, requestType: string) => {
    try {
      // Update approval request status
      const { error: approvalError } = await supabase
        .from('approval_requests')
        .update({ 
          status: 'approved',
          resolved_at: new Date().toISOString()
        })
        .eq('id', requestId);

      if (approvalError) throw approvalError;

      // If it's a lock request, set is_approved = true on daily_cash_entries
      if (requestType === 'lock') {
        const { error: cashError } = await supabase
          .from('daily_cash_entries')
          .update({ 
            is_approved: true,
            approved_at: new Date().toISOString()
          })
          .eq('shop_id', shopId)
          .eq('entry_date', entryDate);

        if (cashError) throw cashError;
      }

      // If it's an unlock request, set is_locked = false
      if (requestType === 'unlock') {
        const { error: unlockError } = await supabase
          .from('daily_cash_entries')
          .update({ 
            is_locked: false,
            is_approved: false,
            unlock_requested: false
          })
          .eq('shop_id', shopId)
          .eq('entry_date', entryDate);

        if (unlockError) throw unlockError;
      }

      alert('✅ Request approved successfully!');
      loadDashboardData(); // Refresh the list

    } catch (error: any) {
      alert('❌ Error approving request: ' + error.message);
    }
  };

  const handleRejectRequest = async (requestId: string) => {
    try {
      const { error } = await supabase
        .from('approval_requests')
        .update({ 
          status: 'rejected',
          resolved_at: new Date().toISOString()
        })
        .eq('id', requestId);

      if (error) throw error;

      alert('✅ Request rejected!');
      loadDashboardData(); // Refresh the list

    } catch (error: any) {
      alert('❌ Error rejecting request: ' + error.message);
    }
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
            <div>
              <h1 className="text-3xl font-bold text-primary mb-2">Dashboard</h1>
              <p className="text-gray-600">Welcome back, {user?.username}</p>
            </div>

            <div className="flex items-center space-x-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Shop</label>
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

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                <Input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-48"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-blue-700">Counter Opening</CardTitle>
              <DollarSign className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-700">
                {formatCurrency(summaryData.counterOpening)}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-green-700">Counter Closing</CardTitle>
              <TrendingUp className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-700">
                {formatCurrency(summaryData.counterClosing)}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-purple-700">Total Sales</CardTitle>
              <TrendingUp className="h-4 w-4 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-700">
                {formatCurrency(summaryData.saleValue)}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-amber-700">Stock Value</CardTitle>
              <Package className="h-4 w-4 text-amber-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-700">
                {formatCurrency(summaryData.stockValue)}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        <DashboardCharts
          brandSalesData={chartData.brandSales}
          productBreakdownData={chartData.productBreakdown}
          dailyTrendData={chartData.dailyTrend}
        />

        {/* Pending Approvals */}
        {pendingApprovals.length > 0 && (
          <Card className="mt-8 border-red-200">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2 text-red-700">
                <AlertCircle size={20} />
                <span>Pending Approval Requests</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {pendingApprovals.map((approval: any) => (
                  <div key={approval.id} className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                    <div>
                      <p className="font-medium">
                        {approval.request_type === 'lock' ? 'Lock Request' : 'Unlock Request'}
                        {approval.shop?.name && ` - ${approval.shop.name}`}
                      </p>
                      <p className="text-sm text-gray-600">Date: {formatDate(approval.entry_date)}</p>
                      {approval.user?.username && (
                        <p className="text-sm text-gray-600">Requested by: {approval.user.username}</p>
                      )}
                    </div>
                    <div className="flex space-x-2">
                      <Button 
                        size="sm" 
                        variant="secondary"
                        onClick={() => handleApproveRequest(approval.id, approval.shop_id, approval.entry_date, approval.request_type)}
                      >
                        Approve
                      </Button>
                      <Button 
                        size="sm" 
                        variant="destructive"
                        onClick={() => handleRejectRequest(approval.id)}
                      >
                        Reject
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
