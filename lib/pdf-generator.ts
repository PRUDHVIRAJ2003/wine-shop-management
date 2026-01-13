import jsPDF from 'jspdf';
import { DailyStockEntry, DailyCashEntry, ExtraTransaction } from '@/types';
import { formatCurrency, formatDate } from './utils';

interface PDFData {
  shopName: string;
  entryDate: string;
  stockEntries: DailyStockEntry[];
  cashEntry: DailyCashEntry;
  extraTransactions: ExtraTransaction[];
}

export function generateDailyReportPDF(data: PDFData): jsPDF {
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();
  let yPos = 20;

  // Header
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('Wine Shop Daily Report', pageWidth / 2, yPos, { align: 'center' });
  
  yPos += 10;
  doc.setFontSize(12);
  doc.text(data.shopName, pageWidth / 2, yPos, { align: 'center' });
  
  yPos += 8;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Date: ${formatDate(data.entryDate)}`, pageWidth / 2, yPos, { align: 'center' });

  yPos += 15;

  // Stock Summary
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Stock Summary', 14, yPos);
  yPos += 8;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');

  const totalSaleValue = data.stockEntries.reduce((sum, entry) => sum + entry.sale_value, 0);
  const totalBottlesSold = data.stockEntries.reduce((sum, entry) => sum + entry.sold_qty, 0);
  const totalStockValue = data.stockEntries.reduce((sum, entry) => sum + entry.closing_stock_value, 0);

  doc.text(`Total Bottles Sold: ${totalBottlesSold}`, 14, yPos);
  yPos += 6;
  doc.text(`Total Sale Value: ${formatCurrency(totalSaleValue)}`, 14, yPos);
  yPos += 6;
  doc.text(`Closing Stock Value: ${formatCurrency(totalStockValue)}`, 14, yPos);

  yPos += 12;

  // Cash Summary
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Cash Summary', 14, yPos);
  yPos += 8;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');

  doc.text(`Counter Opening: ${formatCurrency(data.cashEntry.counter_opening)}`, 14, yPos);
  yPos += 6;
  doc.text(`Total Cash: ${formatCurrency(data.cashEntry.total_cash)}`, 14, yPos);
  yPos += 6;
  doc.text(`Total UPI/Bank: ${formatCurrency(data.cashEntry.total_upi_bank)}`, 14, yPos);
  yPos += 6;
  doc.text(`Cash Shortage: ${formatCurrency(data.cashEntry.cash_shortage)}`, 14, yPos);
  yPos += 6;
  doc.text(`Counter Closing: ${formatCurrency(data.cashEntry.counter_closing)}`, 14, yPos);

  yPos += 12;

  // Extra Transactions
  if (data.extraTransactions.length > 0) {
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Extra Transactions', 14, yPos);
    yPos += 8;

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');

    data.extraTransactions.forEach((trans) => {
      const type = trans.transaction_type === 'income' ? '(+)' : '(-)';
      doc.text(`${type} ${trans.description}: ${formatCurrency(trans.amount)}`, 14, yPos);
      yPos += 6;
    });
  }

  // Footer
  yPos = doc.internal.pageSize.getHeight() - 20;
  doc.setFontSize(8);
  doc.text(`Generated on ${new Date().toLocaleString('en-IN')}`, pageWidth / 2, yPos, { align: 'center' });

  return doc;
}

export function downloadPDF(doc: jsPDF, filename: string): void {
  doc.save(filename);
}
