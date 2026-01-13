'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { User } from '@/types';
import AdminSidebar from '@/components/AdminSidebar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Download, Calendar } from 'lucide-react';
import { formatDate } from '@/lib/utils';

interface PDFArchive {
  month: string;
  year: string;
  files: {
    date: string;
    fileName: string;
    shopName: string;
  }[];
}

export default function PDFArchivesPage() {
  const router = useRouter();
  const supabase = createClient();
  
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [archives, setArchives] = useState<PDFArchive[]>([]);

  useEffect(() => {
    checkAuth();
  }, []);

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
    loadArchives();
    setLoading(false);
  };

  const loadArchives = async () => {
    // Load last 3 months of archives
    const { data: pdfArchives } = await supabase
      .from('pdf_archives')
      .select(`
        *,
        shop:shops(name)
      `)
      .order('entry_date', { ascending: false })
      .limit(90);

    if (pdfArchives) {
      // Group by month/year
      const grouped = new Map<string, PDFArchive>();
      
      pdfArchives.forEach((archive: any) => {
        const date = new Date(archive.entry_date);
        const month = date.toLocaleString('en-US', { month: 'long' });
        const year = date.getFullYear().toString();
        const key = `${month}-${year}`;

        if (!grouped.has(key)) {
          grouped.set(key, {
            month,
            year,
            files: [],
          });
        }

        grouped.get(key)!.files.push({
          date: archive.entry_date,
          fileName: archive.file_name,
          shopName: archive.shop.name,
        });
      });

      setArchives(Array.from(grouped.values()));
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
          <h1 className="text-3xl font-bold text-primary mb-2">PDF Archives</h1>
          <p className="text-gray-600">Download archived daily reports</p>
        </div>

        <div className="space-y-6">
          {archives.map((archive) => (
            <Card key={`${archive.month}-${archive.year}`}>
              <CardHeader className="bg-primary-50">
                <CardTitle className="flex items-center space-x-2 text-primary">
                  <Calendar size={20} />
                  <span>{archive.month} {archive.year}</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {archive.files.map((file, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <div>
                        <p className="font-medium text-gray-900">{formatDate(file.date)}</p>
                        <p className="text-sm text-gray-600">{file.shopName}</p>
                      </div>
                      <Button size="sm" variant="outline">
                        <Download size={16} className="mr-2" />
                        Download
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}

          {archives.length === 0 && (
            <Card>
              <CardContent className="py-12 text-center text-gray-500">
                No archived PDFs found
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}
