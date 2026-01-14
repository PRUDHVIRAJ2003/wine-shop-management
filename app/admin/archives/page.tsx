'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { User, Shop, DailyStockEntry, DailyCashEntry, ExtraTransaction, Product } from '@/types';
import AdminSidebar from '@/components/AdminSidebar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { Download, Calendar, Loader2 } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { generateDailyReportPDF, downloadPDF } from '@/lib/pdf-generator';

interface AvailableReport {
  date: string;
  shopId: string;
  shopName: string;
}

interface GroupedReports {
  month: string;
  year: string;
  reports: AvailableReport[];
}

export default function PDFArchivesPage() {
  const router = useRouter();
  const supabase = createClient();
  
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [shops, setShops] = useState<Shop[]>([]);
  const [selectedShop, setSelectedShop] = useState<string>('');
  const [groupedReports, setGroupedReports] = useState<GroupedReports[]>([]);
  const [downloadingPDF, setDownloadingPDF] = useState<string | null>(null);

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (user && selectedShop) {
      loadAvailableReports();
    }
  }, [user, selectedShop]);

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
      setSelectedShop(shopsData[0].id);
    }
    
    setLoading(false);
  };

  const loadAvailableReports = async () => {
    if (!selectedShop) return;
    
    // Get all dates that have daily_cash_entries for the selected shop
    const { data: cashEntries } = await supabase
      .from('daily_cash_entries')
      .select(`
        entry_date,
        shop_id
      `)
      .eq('shop_id', selectedShop)
      .order('entry_date', { ascending: false })
      .limit(90); // Last 90 entries (approx 3 months)

    if (cashEntries) {
      const shop = shops.find(s => s.id === selectedShop);
      const shopName = shop?.name || 'Unknown Shop';
      
      // Create available reports
      const reports: AvailableReport[] = cashEntries.map(entry => ({
        date: entry.entry_date,
        shopId: entry.shop_id,
        shopName: shopName
      }));
      
      // Group by month/year
      const grouped = new Map<string, GroupedReports>();
      
      reports.forEach(report => {
        const date = new Date(report.date);
        const month = date.toLocaleString('en-US', { month: 'long' });
        const year = date.getFullYear().toString();
        const key = `${month}-${year}`;

        if (!grouped.has(key)) {
          grouped.set(key, {
            month,
            year,
            reports: [],
          });
        }

        grouped.get(key)!.reports.push(report);
      });

      setGroupedReports(Array.from(grouped.values()));
    }
  };

  const handleDownloadPDF = async (report: AvailableReport) => {
    try {
      setDownloadingPDF(report.date);
      
      // Fetch all data for the selected date and shop
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
        .eq('shop_id', report.shopId)
        .eq('entry_date', report.date);
      
      const { data: cashData } = await supabase
        .from('daily_cash_entries')
        .select('*')
        .eq('shop_id', report.shopId)
        .eq('entry_date', report.date)
        .single();
      
      if (!cashData) {
        alert('No cash entry found for this date');
        return;
      }
      
      const { data: extraData } = await supabase
        .from('extra_transactions')
        .select('*')
        .eq('cash_entry_id', cashData.id);
      
      // Generate PDF
      const pdfData = {
        shopName: report.shopName,
        entryDate: report.date,
        stockEntries: (stockData || []) as (DailyStockEntry & { product?: Product })[],
        cashEntry: cashData as DailyCashEntry,
        extraTransactions: (extraData || []) as ExtraTransaction[]
      };
      
      const doc = generateDailyReportPDF(pdfData);
      
      // Download
      const fileName = `${report.date}-${report.shopName.replace(/\s+/g, '-')}.pdf`;
      downloadPDF(doc, fileName);
      
    } catch (error: any) {
      console.error('Error generating PDF:', error);
      alert('❌ Error generating PDF: ' + error.message);
    } finally {
      setDownloadingPDF(null);
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
    <div className="flex min-h-screen bg-gradient-to-br from-orange-50 to-amber-50">
      <AdminSidebar onSignOut={handleSignOut} />

      <main className="flex-1 p-8">
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-primary mb-2">PDF Archives</h1>
              <p className="text-gray-600">Download archived daily reports</p>
            </div>
            <div className="w-64">
              <label className="block text-sm font-medium text-gray-700 mb-2">Select Shop</label>
              <Select
                value={selectedShop}
                onChange={(e) => setSelectedShop(e.target.value)}
                className="w-full"
              >
                {shops.map(shop => (
                  <option key={shop.id} value={shop.id}>{shop.name}</option>
                ))}
              </Select>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          {groupedReports.map((group) => (
            <Card key={`${group.month}-${group.year}`}>
              <CardHeader className="bg-primary-50">
                <CardTitle className="flex items-center space-x-2 text-primary">
                  <Calendar size={20} />
                  <span>{group.month} {group.year}</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {group.reports.map((report, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <div>
                        <p className="font-medium text-gray-900">{formatDate(report.date)}</p>
                        <p className="text-sm text-gray-600">{report.shopName}</p>
                      </div>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => handleDownloadPDF(report)}
                        disabled={downloadingPDF === report.date}
                      >
                        {downloadingPDF === report.date ? (
                          <>
                            <Loader2 size={16} className="mr-2 animate-spin" />
                            Loading...
                          </>
                        ) : (
                          <>
                            <Download size={16} className="mr-2" />
                            Download
                          </>
                        )}
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}

          {groupedReports.length === 0 && selectedShop && (
            <Card>
              <CardContent className="py-12 text-center text-gray-500">
                No reports found for this shop
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}
