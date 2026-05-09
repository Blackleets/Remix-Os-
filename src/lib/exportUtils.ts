
import { saveAs } from 'file-saver';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export function exportToCSV(data: any[], filename: string) {
  if (!data || data.length === 0) return;

  const headers = Object.keys(data[0]);
  const csvRows = [];

  // Add header row
  csvRows.push(headers.join(','));

  // Add data rows
  for (const row of data) {
    const values = headers.map(header => {
      const val = row[header];
      // Handle timestamps or nested objects if needed, but for now simple stringify
      const processedVal = val && typeof val === 'object' && val.toDate ? val.toDate().toISOString() : val;
      // Replace embedded line breaks with spaces so Excel doesn't split rows,
      // and double-up quotes per RFC 4180.
      const escaped = ('' + processedVal).replace(/\r?\n/g, ' ').replace(/"/g, '""');
      return `"${escaped}"`;
    });
    csvRows.push(values.join(','));
  }

  // Prepend a UTF-8 BOM so Excel/Numbers render non-ASCII names correctly.
  const csvContent = '﻿' + csvRows.join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  saveAs(blob, `${filename}_${new Date().toISOString().split('T')[0]}.csv`);
}

interface PDFModule {
  title: string;
  data: any[];
  columns: string[];
}

interface POSReceiptItem {
  name: string;
  sku?: string;
  quantity: number;
  price: number;
}

interface POSReceiptPDFData {
  companyName: string;
  orderId: string;
  createdAt: Date;
  customerName: string;
  paymentMethod: string;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  items: POSReceiptItem[];
}

export function exportDashboardToPDF(companyName: string, modules: PDFModule[]) {
  const doc = new jsPDF();
  const date = new Date().toLocaleDateString();

  // Primary Header
  doc.setFontSize(22);
  doc.setTextColor(40);
  doc.text('REMIX OS • OPERATIONAL REPORT', 14, 22);
  
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`Entity: ${companyName.toUpperCase()}`, 14, 30);
  doc.text(`Generated: ${date}`, 14, 35);
  doc.line(14, 40, 196, 40);

  let currentY = 50;

  modules.forEach((module) => {
    // Check for page overflow
    if (currentY > 240) {
      doc.addPage();
      currentY = 20;
    }

    doc.setFontSize(14);
    doc.setTextColor(60);
    doc.text(module.title.toUpperCase(), 14, currentY);
    
    autoTable(doc, {
      startY: currentY + 5,
      head: [module.columns],
      body: module.data.map(item => module.columns.map(col => {
        const val = item[col];
         // Process Firebase timestamps
         if (val && typeof val === 'object' && val.toDate) {
            return val.toDate().toLocaleDateString();
         }
         return val === undefined || val === null ? '-' : String(val);
      })),
      theme: 'grid',
      headStyles: { fillColor: [40, 40, 40], fontSize: 8 },
      bodyStyles: { fontSize: 8 },
      margin: { left: 14, right: 14 },
    });

    // @ts-ignore
    currentY = doc.lastAutoTable.finalY + 15;
  });

  // Footer on all pages
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(`Page ${i} of ${pageCount} • Confidential Operational Data`, 14, 285);
  }

  doc.save(`${companyName.toLowerCase().replace(/\s+/g, '_')}_operational_report.pdf`);
}

export function exportPOSReceiptToPDF(data: POSReceiptPDFData) {
  const doc = new jsPDF();
  const safeCompanyName = data.companyName.toLowerCase().replace(/\s+/g, '_');

  doc.setFillColor(8, 8, 8);
  doc.rect(0, 0, 210, 297, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.text('REMIX POS RECEIPT', 14, 20);

  doc.setFontSize(10);
  doc.setTextColor(160, 160, 160);
  doc.text(`Entity: ${data.companyName}`, 14, 28);
  doc.text(`Order: ${data.orderId}`, 14, 34);
  doc.text(`Generated: ${data.createdAt.toLocaleString()}`, 14, 40);

  doc.setDrawColor(60, 60, 60);
  doc.line(14, 46, 196, 46);

  doc.setFontSize(11);
  doc.setTextColor(230, 230, 230);
  doc.text(`Customer: ${data.customerName}`, 14, 56);
  doc.text(`Payment: ${data.paymentMethod}`, 14, 63);

  autoTable(doc, {
    startY: 72,
    head: [['Item', 'SKU', 'Qty', 'Unit', 'Line Total']],
    body: data.items.map((item) => [
      item.name,
      item.sku || '-',
      item.quantity.toString(),
      `$${item.price.toFixed(2)}`,
      `$${(item.price * item.quantity).toFixed(2)}`,
    ]),
    theme: 'grid',
    headStyles: { fillColor: [22, 22, 22], textColor: [255, 255, 255], fontSize: 9 },
    bodyStyles: { fillColor: [8, 8, 8], textColor: [220, 220, 220], fontSize: 8 },
    alternateRowStyles: { fillColor: [12, 12, 12] },
    margin: { left: 14, right: 14 },
  });

  // @ts-ignore
  const summaryStart = doc.lastAutoTable.finalY + 12;
  doc.setFontSize(10);
  doc.setTextColor(160, 160, 160);
  doc.text(`Subtotal: $${data.subtotal.toFixed(2)}`, 140, summaryStart);
  doc.text(`Discount: -$${data.discount.toFixed(2)}`, 140, summaryStart + 7);
  doc.text(`Tax: +$${data.tax.toFixed(2)}`, 140, summaryStart + 14);

  doc.setFontSize(14);
  doc.setTextColor(255, 255, 255);
  doc.text(`Total: $${data.total.toFixed(2)}`, 140, summaryStart + 24);

  doc.setFontSize(8);
  doc.setTextColor(120, 120, 120);
  doc.text('Prepared for digital download. Print connector pending future hardware rollout.', 14, 285);

  doc.save(`${safeCompanyName}_pos_receipt_${data.orderId}.pdf`);
}
