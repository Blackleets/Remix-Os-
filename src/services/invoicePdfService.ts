import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Invoice } from '../types/invoice';
import { formatInvoiceCurrency, getCountryProfile } from '../../shared/invoiceProfiles';

export interface InvoicePdfCompanyContext {
  name?: string;
  taxId?: string;
  address?: string;
  email?: string;
  phone?: string;
  logoDataUrl?: string;
}

function toDate(value: any): Date | null {
  if (!value) return null;
  if (typeof value?.toDate === 'function') return value.toDate();
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatDate(value: any, locale: string): string {
  const date = toDate(value);
  if (!date) return '—';
  try {
    return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(date);
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

export function generateInvoicePdf(invoice: Invoice, company?: InvoicePdfCompanyContext): jsPDF {
  const profile = getCountryProfile(invoice.countryProfile);
  const orientation = 'portrait';
  const format = profile.paperSize === 'letter' ? 'letter' : 'a4';
  const doc = new jsPDF({ orientation, unit: 'pt', format });

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 40;

  // Header bar
  doc.setFillColor(15, 18, 26);
  doc.rect(0, 0, pageWidth, 90, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  const docLabel = labelForType(invoice.type, profile);
  doc.text(docLabel.toUpperCase(), margin, 42);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(180, 188, 202);
  doc.text(invoice.invoiceNumber || 'BORRADOR', margin, 62);

  doc.setFontSize(9);
  doc.setTextColor(120, 130, 145);
  const issuerLine = [company?.name || invoice.issuerName, company?.taxId || invoice.issuerTaxId]
    .filter(Boolean)
    .join('  ·  ');
  doc.text(issuerLine, pageWidth - margin, 42, { align: 'right' });
  if (company?.address || invoice.issuerAddress) {
    doc.text(String(company?.address || invoice.issuerAddress), pageWidth - margin, 56, { align: 'right' });
  }

  // Reset
  doc.setTextColor(20, 22, 28);

  // Meta block
  let y = 120;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('FECHA DE EMISIÓN', margin, y);
  doc.text('VENCIMIENTO', margin + 180, y);
  doc.text('ESTADO', margin + 340, y);
  doc.setFont('helvetica', 'normal');
  doc.text(formatDate(invoice.issueDate, profile.locale), margin, y + 14);
  doc.text(invoice.dueDate ? formatDate(invoice.dueDate, profile.locale) : '—', margin + 180, y + 14);
  doc.text(invoice.status.toUpperCase(), margin + 340, y + 14);

  // Customer block
  y = 170;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('FACTURAR A', margin, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(invoice.customerName || '—', margin, y + 16);
  let lineY = y + 30;
  if (invoice.customerTaxId) {
    doc.setFontSize(9);
    doc.text(`${profile.taxIdLabel}: ${invoice.customerTaxId}`, margin, lineY);
    lineY += 12;
  }
  if (invoice.customerEmail) {
    doc.setFontSize(9);
    doc.text(invoice.customerEmail, margin, lineY);
    lineY += 12;
  }
  if (invoice.customerAddress) {
    doc.setFontSize(9);
    doc.text(invoice.customerAddress, margin, lineY);
    lineY += 12;
  }
  if (invoice.customerCountry) {
    doc.setFontSize(9);
    doc.text(invoice.customerCountry, margin, lineY);
    lineY += 12;
  }

  // Items table
  const tableStart = Math.max(lineY + 16, 250);
  autoTable(doc, {
    startY: tableStart,
    margin: { left: margin, right: margin },
    head: [['#', 'Concepto', 'Cant.', 'Precio', 'Dto. %', `${profile.taxName} %`, 'Total']],
    body: invoice.items.map((it, idx) => [
      String(idx + 1),
      [it.name, it.description].filter(Boolean).join('\n'),
      String(it.quantity),
      formatInvoiceCurrency(it.unitPrice, profile),
      `${((it.discountRate ?? 0) * 100).toFixed(0)}%`,
      `${(it.taxRate ?? 0).toFixed(0)}%`,
      formatInvoiceCurrency(it.total, profile),
    ]),
    styles: {
      font: 'helvetica',
      fontSize: 9,
      cellPadding: 6,
      textColor: [30, 32, 38],
      lineColor: [225, 228, 235],
    },
    headStyles: {
      fillColor: [20, 24, 34],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
    },
    alternateRowStyles: { fillColor: [248, 249, 252] },
    columnStyles: {
      0: { cellWidth: 28, halign: 'center' },
      2: { halign: 'right', cellWidth: 50 },
      3: { halign: 'right' },
      4: { halign: 'right', cellWidth: 50 },
      5: { halign: 'right', cellWidth: 60 },
      6: { halign: 'right' },
    },
  });

  // Totals block (right aligned)
  const lastY = (doc as any).lastAutoTable?.finalY || tableStart + 100;
  const totalsX = pageWidth - margin - 180;
  let ty = lastY + 16;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  totalRow(doc, 'Subtotal', formatInvoiceCurrency(invoice.subtotal, profile), totalsX, pageWidth - margin, ty);
  ty += 16;
  if (invoice.discountTotal > 0) {
    totalRow(doc, 'Descuento', `-${formatInvoiceCurrency(invoice.discountTotal, profile)}`, totalsX, pageWidth - margin, ty);
    ty += 16;
  }
  totalRow(doc, profile.taxName, formatInvoiceCurrency(invoice.taxTotal, profile), totalsX, pageWidth - margin, ty);
  ty += 18;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  totalRow(doc, 'Total', formatInvoiceCurrency(invoice.total, profile), totalsX, pageWidth - margin, ty);
  ty += 20;
  if (invoice.amountPaid > 0 || invoice.amountDue !== invoice.total) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    totalRow(doc, 'Pagado', formatInvoiceCurrency(invoice.amountPaid, profile), totalsX, pageWidth - margin, ty);
    ty += 16;
    totalRow(doc, 'Pendiente', formatInvoiceCurrency(invoice.amountDue, profile), totalsX, pageWidth - margin, ty);
    ty += 16;
  }

  // Notes + terms
  let footerY = ty + 30;
  if (invoice.notes) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('NOTAS', margin, footerY);
    doc.setFont('helvetica', 'normal');
    const split = doc.splitTextToSize(invoice.notes, pageWidth - margin * 2);
    doc.text(split, margin, footerY + 14);
    footerY += 14 + split.length * 12;
  }
  if (invoice.terms) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('TÉRMINOS', margin, footerY);
    doc.setFont('helvetica', 'normal');
    const split = doc.splitTextToSize(invoice.terms, pageWidth - margin * 2);
    doc.text(split, margin, footerY + 14);
    footerY += 14 + split.length * 12;
  }

  // Compliance warning at the bottom
  const pageHeight = doc.internal.pageSize.getHeight();
  doc.setDrawColor(225, 228, 235);
  doc.setLineWidth(0.5);
  doc.line(margin, pageHeight - 50, pageWidth - margin, pageHeight - 50);
  doc.setFontSize(8);
  doc.setTextColor(110, 120, 135);
  const warning = doc.splitTextToSize(profile.warning, pageWidth - margin * 2);
  doc.text(warning, margin, pageHeight - 36);

  return doc;
}

function totalRow(doc: jsPDF, label: string, value: string, leftX: number, rightX: number, y: number) {
  doc.text(label, leftX, y);
  doc.text(value, rightX, y, { align: 'right' });
}

function labelForType(type: Invoice['type'], profile: ReturnType<typeof getCountryProfile>): string {
  if (type === 'quote') return profile.quoteLabel;
  if (type === 'receipt') return profile.receiptLabel;
  if (type === 'sales_note') return profile.salesNoteLabel;
  return profile.invoiceLabel;
}

export function downloadInvoicePdf(invoice: Invoice, company?: InvoicePdfCompanyContext): void {
  const doc = generateInvoicePdf(invoice, company);
  const filename = `${(invoice.invoiceNumber || 'borrador').replace(/[^A-Za-z0-9_-]/g, '-')}.pdf`;
  doc.save(filename);
}
