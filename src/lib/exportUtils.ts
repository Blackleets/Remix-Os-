
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
      const escaped = ('' + processedVal).replace(/"/g, '""');
      return `"${escaped}"`;
    });
    csvRows.push(values.join(','));
  }

  const csvContent = csvRows.join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  saveAs(blob, `${filename}_${new Date().toISOString().split('T')[0]}.csv`);
}

interface PDFModule {
  title: string;
  data: any[];
  columns: string[];
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
