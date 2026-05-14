import type { Timestamp } from 'firebase/firestore';
import type {
  ComplianceMode,
  CountryProfileId,
  FiscalProvider,
  FiscalStatus,
  InvoiceStatus,
  InvoiceType,
} from '../../shared/invoices';

export interface InvoiceLineItem {
  id: string;
  productId?: string;
  name: string;
  description?: string;
  quantity: number;
  unitPrice: number;
  discountRate?: number;
  taxRate?: number;
  taxName?: string;
  subtotal: number;
  taxTotal: number;
  total: number;
}

export interface Invoice {
  id: string;
  companyId: string;
  type: InvoiceType;
  status: InvoiceStatus;

  invoiceNumber: string;
  series: string;
  sequentialNumber: number;

  customerId?: string;
  customerName: string;
  customerEmail?: string;
  customerTaxId?: string;
  customerAddress?: string;
  customerCountry?: string;

  issuerName: string;
  issuerTaxId?: string;
  issuerAddress?: string;
  issuerCountry?: string;

  currency: string;
  locale: string;
  countryProfile: CountryProfileId;

  issueDate: Timestamp | Date;
  dueDate?: Timestamp | Date | null;

  items: InvoiceLineItem[];

  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  total: number;
  amountPaid: number;
  amountDue: number;

  notes?: string;
  terms?: string;

  pdfUrl?: string;
  pdfPath?: string;

  orderId?: string;

  complianceMode: ComplianceMode;
  fiscalProvider?: FiscalProvider;
  fiscalStatus?: FiscalStatus;

  createdBy: string;
  createdAt: Timestamp | Date;
  updatedAt: Timestamp | Date;
}

export type { InvoiceStatus, InvoiceType, CountryProfileId } from '../../shared/invoices';
