
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
  discountPercent?: number;
  tax: number;
  taxPercent?: number;
  total: number;
  items: POSReceiptItem[];
  logoURL?: string;
  footerMessage?: string;
  operator?: string;
  cashSessionId?: string;
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

async function imageUrlToDataUrl(url: string) {
  const response = await fetch(url);
  const blob = await response.blob();

  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export async function exportPOSReceiptToPDF(data: POSReceiptPDFData) {
  const doc = new jsPDF();
  const safeCompanyName = data.companyName.toLowerCase().replace(/\s+/g, '_');
  const accent = [59, 130, 246] as const;
  const silver = [163, 163, 163] as const;
  const ivory = [245, 245, 245] as const;

  doc.setFillColor(8, 8, 8);
  doc.rect(0, 0, 210, 297, 'F');

  doc.setFillColor(accent[0], accent[1], accent[2]);
  doc.roundedRect(14, 14, 182, 26, 6, 6, 'F');

  if (data.logoURL) {
    try {
      const image = await imageUrlToDataUrl(data.logoURL);
      doc.addImage(image, 'PNG', 18, 18, 12, 12);
    } catch (error) {
      console.warn('Receipt logo skipped:', error);
    }
  }

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(11);
  doc.text(data.companyName.toUpperCase(), 34, 23);
  doc.setFontSize(20);
  doc.text('POS RECEIPT', 34, 31);

  doc.setFontSize(10);
  doc.setTextColor(silver[0], silver[1], silver[2]);
  doc.text(`Order: ${data.orderId}`, 14, 52);
  doc.text(`Generated: ${data.createdAt.toLocaleString()}`, 14, 58);

  doc.setDrawColor(60, 60, 60);
  doc.line(14, 64, 196, 64);

  doc.setFontSize(11);
  doc.setTextColor(ivory[0], ivory[1], ivory[2]);
  doc.text(`Customer: ${data.customerName}`, 14, 74);
  doc.text(`Payment: ${data.paymentMethod}`, 14, 81);

  let metaY = 88;
  doc.setFontSize(9);
  doc.setTextColor(silver[0], silver[1], silver[2]);
  if (data.operator) {
    doc.text(`Operator: ${data.operator}`, 14, metaY);
    metaY += 6;
  }
  if (data.cashSessionId) {
    doc.text(`Cash Session: ${data.cashSessionId}`, 14, metaY);
    metaY += 6;
  }
  const tableStartY = data.operator || data.cashSessionId ? metaY + 4 : 90;

  autoTable(doc, {
    startY: tableStartY,
    head: [['Item', 'SKU', 'Qty', 'Unit', 'Line Total']],
    body: data.items.map((item) => [
      item.name,
      item.sku || '-',
      item.quantity.toString(),
      `$${item.price.toFixed(2)}`,
      `$${(item.price * item.quantity).toFixed(2)}`,
    ]),
    theme: 'grid',
    headStyles: { fillColor: [20, 20, 20], textColor: [255, 255, 255], fontSize: 9 },
    bodyStyles: { fillColor: [8, 8, 8], textColor: [220, 220, 220], fontSize: 8 },
    alternateRowStyles: { fillColor: [12, 12, 12] },
    margin: { left: 14, right: 14 },
  });

  // @ts-ignore
  const summaryStart = doc.lastAutoTable.finalY + 12;
  doc.setFontSize(10);
  doc.setTextColor(silver[0], silver[1], silver[2]);
  const discountLabel =
    typeof data.discountPercent === 'number' && data.discountPercent > 0
      ? `Discount (${data.discountPercent}%): -$${data.discount.toFixed(2)}`
      : `Discount: -$${data.discount.toFixed(2)}`;
  const taxLabel =
    typeof data.taxPercent === 'number' && data.taxPercent > 0
      ? `Tax (${data.taxPercent}%): +$${data.tax.toFixed(2)}`
      : `Tax: +$${data.tax.toFixed(2)}`;
  doc.text(`Subtotal: $${data.subtotal.toFixed(2)}`, 130, summaryStart);
  doc.text(discountLabel, 130, summaryStart + 7);
  doc.text(taxLabel, 130, summaryStart + 14);

  doc.setFillColor(14, 14, 14);
  doc.roundedRect(120, summaryStart + 18, 76, 16, 4, 4, 'F');
  doc.setFontSize(14);
  doc.setTextColor(accent[0], accent[1], accent[2]);
  doc.text(`Total: $${data.total.toFixed(2)}`, 126, summaryStart + 29);

  doc.setFontSize(8);
  doc.setTextColor(silver[0], silver[1], silver[2]);
  doc.text(data.footerMessage || 'Thank you for choosing Remix OS. Print connector pending future hardware rollout.', 14, 278, {
    maxWidth: 182,
  });

  doc.save(`${safeCompanyName}_pos_receipt_${data.orderId}.pdf`);
}
