export interface User {
  id: number;
  name: string;
  email: string;
  created_at: string;
}

export interface Profile {
  id: number;
  name: string;
  email: string;
  vat: string | null;
  phone: string | null;
  logo_path: string | null;
  signature_path: string | null;
  swift: string | null;
  iban: string | null;
  bank_name: string | null;
  default_rate: number;
  currency: string;
  notes_template: string | null;
}

export interface Client {
  id: number;
  user_id: number;
  name: string;
  address: string | null;
  city: string | null;
  postal_code: string | null;
  country: string | null;
  vat: string | null;
  email: string | null;
  currency: string | null;
  created_at: string;
}

export type InvoiceStatus = 'draft' | 'sent' | 'paid';

export interface InvoiceItem {
  id?: number;
  description: string;
  hours: number;
  rate: number;
  amount: number;
  item_order?: number;
}

/** What the item form produces before amounts are computed. */
export interface InvoiceItemInput {
  description: string;
  hours: number;
  rate: number;
  amount: number;
}

/**
 * Payload accepted by POST/PUT /invoices. Every field is optional so a partial
 * update (a status change, an autosave) is expressible without casting.
 */
export interface InvoiceInput {
  invoice_number?: string;
  date?: string;
  due_date?: string | null;
  status?: InvoiceStatus;
  notes?: string | null;
  period_start?: string | null;
  period_end?: string | null;
  client_id?: number | null;
  is_template?: boolean;
  items?: InvoiceItemInput[];
}

export interface Invoice {
  id: number;
  invoice_number: string;
  date: string;
  due_date: string | null;
  /** Derived server-side from due_date and status — never stored. */
  is_overdue?: boolean;
  status: InvoiceStatus;
  total: number;
  subtotal: number;
  notes: string;
  period_start: string;
  period_end: string;
  client_id: number;
  client_name: string;
  client_address?: string;
  client_city?: string;
  client_postal_code?: string;
  client_vat?: string;
  /** Overrides the profile default when the client bills in another currency. */
  client_currency?: string | null;
  items: InvoiceItem[];
  sent_at?: string;
  is_template?: boolean;
  created_at: string;
}

export interface MonthStat {
  month: string;
  revenue: number;
  count: number;
}

export interface DashboardStats {
  total_invoices: number;
  paid_invoices: number;
  sent_invoices: number;
  draft_invoices: number;
  total_revenue: number;
  paid_revenue: number;
  pending_revenue: number;
  overdue_invoices: number;
  overdue_revenue: number;
  avg_invoice: number;
  month_revenue: number;
  last_month_revenue: number;
  recent_invoices: Partial<Invoice>[];
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

export interface AuthResponse {
  token: string;
  user: User;
}
