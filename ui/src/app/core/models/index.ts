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
  created_at: string;
}

export interface InvoiceItem {
  id?: number;
  description: string;
  hours: number;
  rate: number;
  amount: number;
  item_order?: number;
}

export interface Invoice {
  id: number;
  invoice_number: string;
  date: string;
  status: 'draft' | 'sent' | 'paid';
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
  items: InvoiceItem[];
  created_at: string;
}

export interface DashboardStats {
  total_invoices: number;
  paid_invoices: number;
  sent_invoices: number;
  draft_invoices: number;
  total_revenue: number;
  month_revenue: number;
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
