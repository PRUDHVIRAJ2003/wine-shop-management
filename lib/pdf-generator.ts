import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { DailyStockEntry, DailyCashEntry, ExtraTransaction, Product } from '@/types';
import { formatDate } from './utils';

interface PDFData {
  shopName: string;
  entryDate: string;
  stockEntries: (DailyStockEntry & { product?: Product })[];
  cashEntry: DailyCashEntry;
  extraTransactions: ExtraTransaction[];
}

// PDF-safe currency formatter - uses "Rs." instead of "₹" for better compatibility
function formatCurrencyPDF(amount: number): string {
  return `Rs. ${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// Clean text - remove any special/invisible characters for PDF compatibility
function cleanText(text: string): string {
  return text.replace(/[^\x20-\x7E]/g, '').trim();
}

export function generateDailyReportPDF(data: PDFData): jsPDF {
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();
  
  // Color scheme
  const burgundy: [number, number, number] = [114, 47, 55]; // #722F37
  const gold: [number, number, number] = [212, 175, 55]; // #D4AF37
  const darkGray: [number, number, number] = [60, 60, 60];
  
  // ===== HEADER =====
  doc.setFillColor(...burgundy);
  doc.rect(0, 0, pageWidth, 45, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text('WINE SHOP MANAGEMENT SYSTEM', pageWidth / 2, 15, { align: 'center' });
  
  // Decorative line
  doc.setDrawColor(...gold);
  doc.setLineWidth(1);
  doc.line(50, 20, pageWidth - 50, 20);
  
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(cleanText(data.shopName.toUpperCase()), pageWidth / 2, 30, { align: 'center' });
  
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text(`Daily Stock Report - ${formatDate(data.entryDate)}`, pageWidth / 2, 40, { align: 'center' });
  
  let yPos = 55;
  
  // ===== STOCK ENTRY DETAILS =====
  doc.setTextColor(...burgundy);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('STOCK ENTRY DETAILS', 14, yPos);
  yPos += 5;
  
  // Calculate totals
  const totalOpening = data.stockEntries.reduce((sum, e) => sum + e.opening_stock, 0);
  const totalPurchases = data.stockEntries.reduce((sum, e) => sum + e.purchases, 0);
  const totalTransfer = data.stockEntries.reduce((sum, e) => sum + e.transfer, 0);
  const totalClosing = data.stockEntries.reduce((sum, e) => sum + e.closing_stock, 0);
  const totalSold = data.stockEntries.reduce((sum, e) => sum + e.sold_qty, 0);
  const totalSaleValue = data.stockEntries.reduce((sum, e) => sum + e.sale_value, 0);
  const totalStockValue = data.stockEntries.reduce((sum, e) => sum + e.closing_stock_value, 0);
  
  // Stock table
  autoTable(doc, {
    startY: yPos,
    head: [['S.No', 'Brand Name', 'Type', 'Size', 'MRP', 'Open', 'Purch', 'Trans', 'Close', 'Sold', 'Sale Val', 'Stock Val']],
    body: data.stockEntries.map((entry, index) => [
      (index + 1).toString(),
      cleanText(entry.product?.brand_name || 'N/A'),
      cleanText(entry.product?.product_type?.name || 'N/A'),
      entry.product?.product_size?.size_ml?.toString() || 'N/A',
      formatCurrencyPDF(entry.product?.mrp || 0),
      entry.opening_stock.toString(),
      entry.purchases.toString(),
      entry.transfer.toString(),
      entry.closing_stock.toString(),
      entry.sold_qty.toString(),
      formatCurrencyPDF(entry.sale_value),
      formatCurrencyPDF(entry.closing_stock_value)
    ]),
    foot: [['', 'TOTALS', '', '', '', totalOpening.toString(), totalPurchases.toString(), totalTransfer.toString(), totalClosing.toString(), totalSold.toString(), formatCurrencyPDF(totalSaleValue), formatCurrencyPDF(totalStockValue)]],
    headStyles: { 
      fillColor: burgundy, 
      textColor: [255, 255, 255],
      fontSize: 7,
      fontStyle: 'bold',
      halign: 'center',
      cellPadding: 2
    },
    footStyles: { 
      fillColor: gold, 
      textColor: [0, 0, 0],
      fontSize: 7,
      fontStyle: 'bold',
      halign: 'center'
    },
    alternateRowStyles: { fillColor: [245, 245, 245] },
    styles: { 
      fontSize: 7, 
      cellPadding: 2,
      halign: 'center',
      valign: 'middle',
      textColor: darkGray
    },
    columnStyles: {
      0: { cellWidth: 9, halign: 'center' },
      1: { cellWidth: 22, halign: 'left' },
      2: { cellWidth: 16, halign: 'center' },
      3: { cellWidth: 12, halign: 'center' },
      4: { cellWidth: 18, halign: 'right' },
      5: { cellWidth: 11, halign: 'center' },
      6: { cellWidth: 11, halign: 'center' },
      7: { cellWidth: 11, halign: 'center' },
      8: { cellWidth: 11, halign: 'center' },
      9: { cellWidth: 11, halign: 'center' },
      10: { cellWidth: 18, halign: 'right' },
      11: { cellWidth: 18, halign: 'right' }
    },
    margin: { left: 14, right: 14 },
    tableWidth: 'wrap',
    theme: 'grid'
  });
  
  yPos = (doc as any).lastAutoTable.finalY + 15;
  
  // ===== CASH REGISTER =====
  doc.setTextColor(...burgundy);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('CASH REGISTER', 14, yPos);
  yPos += 8;
  
  doc.setTextColor(...darkGray);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Counter Opening: ${formatCurrencyPDF(data.cashEntry.counter_opening)}`, 14, yPos);
  yPos += 6;
  doc.text(`Today Total Sale Value: ${formatCurrencyPDF(data.cashEntry.total_sale_value)}`, 14, yPos);
  yPos += 12;
  
  // ===== CASH DENOMINATIONS =====
  doc.setTextColor(...burgundy);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('CASH DENOMINATIONS', 14, yPos);
  yPos += 5;
  
  const denominations = [
    { label: 'Rs. 500', count: data.cashEntry.denom_500, amount: data.cashEntry.denom_500 * 500 },
    { label: 'Rs. 200', count: data.cashEntry.denom_200, amount: data.cashEntry.denom_200 * 200 },
    { label: 'Rs. 100', count: data.cashEntry.denom_100, amount: data.cashEntry.denom_100 * 100 },
    { label: 'Rs. 50', count: data.cashEntry.denom_50, amount: data.cashEntry.denom_50 * 50 },
    { label: 'Rs. 20', count: data.cashEntry.denom_20, amount: data.cashEntry.denom_20 * 20 },
    { label: 'Rs. 10', count: data.cashEntry.denom_10, amount: data.cashEntry.denom_10 * 10 },
    { label: 'Rs. 5', count: data.cashEntry.denom_5, amount: data.cashEntry.denom_5 * 5 },
    { label: 'Rs. 2', count: data.cashEntry.denom_2, amount: data.cashEntry.denom_2 * 2 },
    { label: 'Rs. 1', count: data.cashEntry.denom_1, amount: data.cashEntry.denom_1 * 1 }
  ];
  
  autoTable(doc, {
    startY: yPos,
    head: [['Denomination', 'Count', 'Amount']],
    body: denominations.map(d => [d.label, d.count.toString(), formatCurrencyPDF(d.amount)]),
    foot: [['TOTAL CASH', '', formatCurrencyPDF(data.cashEntry.total_cash)]],
    headStyles: { 
      fillColor: burgundy, 
      textColor: [255, 255, 255],
      fontSize: 9,
      fontStyle: 'bold'
    },
    footStyles: { 
      fillColor: gold, 
      textColor: [0, 0, 0],
      fontSize: 9,
      fontStyle: 'bold'
    },
    styles: { fontSize: 9, cellPadding: 3, textColor: darkGray },
    columnStyles: {
      0: { cellWidth: 40, halign: 'left' },
      1: { cellWidth: 30, halign: 'center' },
      2: { cellWidth: 40, halign: 'right' }
    },
    margin: { left: 14, right: 14 },
    tableWidth: 110,
    theme: 'grid'
  });
  
  yPos = (doc as any).lastAutoTable.finalY + 15;
  
  // Check if we need a new page
  if (yPos > 240) {
    doc.addPage();
    yPos = 20;
  }
  
  // ===== DIGITAL PAYMENTS =====
  doc.setTextColor(...burgundy);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('DIGITAL PAYMENTS', 14, yPos);
  yPos += 8;
  
  doc.setTextColor(...darkGray);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Google Pay: ${formatCurrencyPDF(data.cashEntry.google_pay)}`, 14, yPos);
  yPos += 6;
  doc.text(`PhonePe/Paytm: ${formatCurrencyPDF(data.cashEntry.phonepe_paytm)}`, 14, yPos);
  yPos += 6;
  doc.text(`Bank Transfer: ${formatCurrencyPDF(data.cashEntry.bank_transfer)}`, 14, yPos);
  yPos += 6;
  
  doc.setFont('helvetica', 'bold');
  doc.text(`Total UPI/Bank: ${formatCurrencyPDF(data.cashEntry.total_upi_bank)}`, 14, yPos);
  yPos += 15;
  
  // ===== EXTRA TRANSACTIONS =====
  if (data.extraTransactions.length > 0) {
    doc.setTextColor(...burgundy);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('EXTRA TRANSACTIONS', 14, yPos);
    yPos += 5;
    
    const totalExtraIncome = data.extraTransactions
      .filter(t => t.transaction_type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);
    const totalExpenses = data.extraTransactions
      .filter(t => t.transaction_type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);
    
    autoTable(doc, {
      startY: yPos,
      head: [['Type', 'Description', 'Amount']],
      body: data.extraTransactions.map(t => [
        t.transaction_type === 'income' ? '(+) Income' : '(-) Expense',
        cleanText(t.description),
        formatCurrencyPDF(t.amount)
      ]),
      headStyles: { 
        fillColor: burgundy, 
        textColor: [255, 255, 255],
        fontSize: 9,
        fontStyle: 'bold'
      },
      styles: { fontSize: 9, cellPadding: 3, textColor: darkGray },
      columnStyles: {
        0: { cellWidth: 30, halign: 'left' },
        1: { cellWidth: 80, halign: 'left' },
        2: { cellWidth: 35, halign: 'right' }
      },
      margin: { left: 14, right: 14 },
      tableWidth: 145,
      theme: 'grid'
    });
    
    yPos = (doc as any).lastAutoTable.finalY + 8;
    
    doc.setTextColor(...darkGray);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Total Extra Income: ${formatCurrencyPDF(totalExtraIncome)}`, 14, yPos);
    yPos += 6;
    doc.text(`Total Expenses: ${formatCurrencyPDF(totalExpenses)}`, 14, yPos);
    yPos += 15;
  }
  
  // Check if we need a new page for summary
  if (yPos > 230) {
    doc.addPage();
    yPos = 20;
  }
  
  // ===== DAILY SUMMARY (Highlighted Box) =====
  doc.setTextColor(...burgundy);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('DAILY SUMMARY', 14, yPos);
  yPos += 5;
  
  // Draw box
  const boxX = 14;
  const boxWidth = 180;
  const boxHeight = 45;
  
  doc.setDrawColor(...burgundy);
  doc.setLineWidth(1.5);
  doc.rect(boxX, yPos, boxWidth, boxHeight, 'S');
  
  yPos += 12;
  
  doc.setTextColor(...darkGray);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(`Cash Shortage: ${formatCurrencyPDF(data.cashEntry.cash_shortage)}`, boxX + 10, yPos);
  yPos += 12;
  doc.text(`Total Bottles Sold: ${data.cashEntry.total_bottles_sold}`, boxX + 10, yPos);
  yPos += 12;
  doc.text(`Counter Closing: ${formatCurrencyPDF(data.cashEntry.counter_closing)}`, boxX + 10, yPos);
  
  // ===== FOOTER =====
  const pageHeight = doc.internal.pageSize.getHeight();
  doc.setTextColor(100, 100, 100);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  
  const now = new Date();
  const formattedDate = now.toLocaleDateString('en-IN');
  const formattedTime = now.toLocaleTimeString('en-IN');
  
  doc.text(`Generated on: ${formattedDate} at ${formattedTime}`, pageWidth / 2, pageHeight - 15, { align: 'center' });
  doc.text('Wine Shop Management System v1.0', pageWidth / 2, pageHeight - 10, { align: 'center' });

  return doc;
}

export function downloadPDF(doc: jsPDF, filename: string): void {
  doc.save(filename);
}
