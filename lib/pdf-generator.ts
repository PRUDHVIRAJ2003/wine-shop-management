import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { DailyStockEntry, DailyCashEntry, ExtraTransaction, Product } from '@/types';
import { formatCurrency, formatDate } from './utils';

interface PDFData {
  shopName: string;
  entryDate: string;
  stockEntries: (DailyStockEntry & { product?: Product })[];
  cashEntry: DailyCashEntry;
  extraTransactions: ExtraTransaction[];
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
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.text('🍷 WINE SHOP MANAGEMENT 🍷', pageWidth / 2, 15, { align: 'center' });
  
  doc.setFontSize(18);
  doc.text(data.shopName.toUpperCase(), pageWidth / 2, 28, { align: 'center' });
  
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text(`Daily Stock Report - ${formatDate(data.entryDate)}`, pageWidth / 2, 40, { align: 'center' });
  
  let yPos = 55;
  
  // ===== STOCK ENTRY DETAILS =====
  doc.setTextColor(...burgundy);
  doc.setFontSize(14);
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
    head: [['S.No', 'Brand Name', 'Type', 'Size (ml)', 'MRP', 'Opening', 'Purchases', 'Transfer', 'Closing', 'Sold', 'Sale Value', 'Stock Value']],
    body: data.stockEntries.map((entry, index) => [
      (index + 1).toString(),
      entry.product?.brand_name || 'N/A',
      entry.product?.product_type?.name || 'N/A',
      entry.product?.product_size?.size_ml?.toString() || 'N/A',
      `₹${entry.product?.mrp?.toFixed(2) || '0.00'}`,
      entry.opening_stock.toString(),
      entry.purchases.toString(),
      entry.transfer.toString(),
      entry.closing_stock.toString(),
      entry.sold_qty.toString(),
      `₹${entry.sale_value.toFixed(2)}`,
      `₹${entry.closing_stock_value.toFixed(2)}`
    ]),
    foot: [['', 'TOTALS', '', '', '', totalOpening.toString(), totalPurchases.toString(), totalTransfer.toString(), totalClosing.toString(), totalSold.toString(), `₹${totalSaleValue.toFixed(2)}`, `₹${totalStockValue.toFixed(2)}`]],
    headStyles: { 
      fillColor: burgundy, 
      textColor: [255, 255, 255],
      fontSize: 8,
      fontStyle: 'bold',
      halign: 'center'
    },
    footStyles: { 
      fillColor: gold, 
      textColor: [0, 0, 0],
      fontSize: 8,
      fontStyle: 'bold',
      halign: 'center'
    },
    alternateRowStyles: { fillColor: [245, 245, 245] },
    styles: { 
      fontSize: 7, 
      cellPadding: 2,
      halign: 'center',
      valign: 'middle'
    },
    columnStyles: {
      0: { cellWidth: 10 },
      1: { cellWidth: 25, halign: 'left' },
      2: { cellWidth: 15, halign: 'left' },
      3: { cellWidth: 12 },
      4: { cellWidth: 15 },
      5: { cellWidth: 13 },
      6: { cellWidth: 15 },
      7: { cellWidth: 13 },
      8: { cellWidth: 13 },
      9: { cellWidth: 10 },
      10: { cellWidth: 18 },
      11: { cellWidth: 18 }
    },
    margin: { left: 14, right: 14 },
    theme: 'grid'
  });
  
  yPos = (doc as any).lastAutoTable.finalY + 10;
  
  // ===== CASH REGISTER =====
  doc.setTextColor(...burgundy);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('CASH REGISTER', 14, yPos);
  yPos += 7;
  
  doc.setTextColor(...darkGray);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Counter Opening: ${formatCurrency(data.cashEntry.counter_opening)}`, 14, yPos);
  yPos += 6;
  doc.text(`Today Total Sale Value: ${formatCurrency(data.cashEntry.total_sale_value)}`, 14, yPos);
  yPos += 10;
  
  // ===== CASH DENOMINATIONS =====
  doc.setTextColor(...burgundy);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('CASH DENOMINATIONS', 14, yPos);
  yPos += 5;
  
  const denominations = [
    { label: '₹500 ×', count: data.cashEntry.denom_500, amount: data.cashEntry.denom_500 * 500 },
    { label: '₹200 ×', count: data.cashEntry.denom_200, amount: data.cashEntry.denom_200 * 200 },
    { label: '₹100 ×', count: data.cashEntry.denom_100, amount: data.cashEntry.denom_100 * 100 },
    { label: '₹50 ×', count: data.cashEntry.denom_50, amount: data.cashEntry.denom_50 * 50 },
    { label: '₹20 ×', count: data.cashEntry.denom_20, amount: data.cashEntry.denom_20 * 20 },
    { label: '₹10 ×', count: data.cashEntry.denom_10, amount: data.cashEntry.denom_10 * 10 },
    { label: '₹5 ×', count: data.cashEntry.denom_5, amount: data.cashEntry.denom_5 * 5 },
    { label: '₹2 ×', count: data.cashEntry.denom_2, amount: data.cashEntry.denom_2 * 2 },
    { label: '₹1 ×', count: data.cashEntry.denom_1, amount: data.cashEntry.denom_1 * 1 }
  ];
  
  autoTable(doc, {
    startY: yPos,
    head: [['Denomination', 'Count', 'Amount']],
    body: denominations.map(d => [d.label, d.count.toString(), formatCurrency(d.amount)]),
    foot: [['TOTAL CASH', '', formatCurrency(data.cashEntry.total_cash)]],
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
    styles: { fontSize: 9, cellPadding: 3 },
    columnStyles: {
      0: { cellWidth: 40 },
      1: { cellWidth: 30, halign: 'center' },
      2: { cellWidth: 40, halign: 'right' }
    },
    margin: { left: 14, right: 14 },
    theme: 'grid'
  });
  
  yPos = (doc as any).lastAutoTable.finalY + 10;
  
  // Check if we need a new page
  if (yPos > 240) {
    doc.addPage();
    yPos = 20;
  }
  
  // ===== DIGITAL PAYMENTS =====
  doc.setTextColor(...burgundy);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('DIGITAL PAYMENTS', 14, yPos);
  yPos += 7;
  
  doc.setTextColor(...darkGray);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Google Pay: ${formatCurrency(data.cashEntry.google_pay)}`, 14, yPos);
  yPos += 6;
  doc.text(`PhonePe/Paytm: ${formatCurrency(data.cashEntry.phonepe_paytm)}`, 14, yPos);
  yPos += 6;
  doc.text(`Bank Transfer: ${formatCurrency(data.cashEntry.bank_transfer)}`, 14, yPos);
  yPos += 6;
  
  doc.setFont('helvetica', 'bold');
  doc.text(`Total UPI/Bank: ${formatCurrency(data.cashEntry.total_upi_bank)}`, 14, yPos);
  yPos += 10;
  
  // ===== EXTRA TRANSACTIONS =====
  if (data.extraTransactions.length > 0) {
    doc.setTextColor(...burgundy);
    doc.setFontSize(14);
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
        t.description,
        formatCurrency(t.amount)
      ]),
      headStyles: { 
        fillColor: burgundy, 
        textColor: [255, 255, 255],
        fontSize: 9,
        fontStyle: 'bold'
      },
      styles: { fontSize: 9, cellPadding: 3 },
      columnStyles: {
        0: { cellWidth: 30 },
        1: { cellWidth: 80 },
        2: { cellWidth: 30, halign: 'right' }
      },
      margin: { left: 14, right: 14 },
      theme: 'grid'
    });
    
    yPos = (doc as any).lastAutoTable.finalY + 7;
    
    doc.setTextColor(...darkGray);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Total Extra Income: ${formatCurrency(totalExtraIncome)}`, 14, yPos);
    yPos += 6;
    doc.text(`Total Expenses: ${formatCurrency(totalExpenses)}`, 14, yPos);
    yPos += 10;
  }
  
  // Check if we need a new page for summary
  if (yPos > 240) {
    doc.addPage();
    yPos = 20;
  }
  
  // ===== DAILY SUMMARY (Highlighted Box) =====
  doc.setTextColor(...burgundy);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('DAILY SUMMARY', 14, yPos);
  yPos += 5;
  
  // Draw box
  const boxX = 14;
  const boxWidth = pageWidth - 28;
  const boxHeight = 35;
  
  doc.setDrawColor(...burgundy);
  doc.setLineWidth(1);
  doc.rect(boxX, yPos, boxWidth, boxHeight);
  
  yPos += 8;
  
  doc.setTextColor(...darkGray);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(`Cash Shortage: ${formatCurrency(data.cashEntry.cash_shortage)}`, boxX + 5, yPos);
  yPos += 8;
  doc.text(`Total Bottles Sold: ${data.cashEntry.total_bottles_sold}`, boxX + 5, yPos);
  yPos += 8;
  doc.text(`Counter Closing: ${formatCurrency(data.cashEntry.counter_closing)}`, boxX + 5, yPos);
  
  yPos += 15;
  
  // ===== FOOTER =====
  const footerY = doc.internal.pageSize.getHeight() - 15;
  doc.setTextColor(...darkGray);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(`Generated on: ${new Date().toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'medium' })}`, pageWidth / 2, footerY, { align: 'center' });
  doc.text('Wine Shop Management System v1.0', pageWidth / 2, footerY + 5, { align: 'center' });

  return doc;
}

export function downloadPDF(doc: jsPDF, filename: string): void {
  doc.save(filename);
}
