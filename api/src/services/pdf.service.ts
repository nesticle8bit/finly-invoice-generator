import puppeteer, { Browser } from 'puppeteer';
import fs from 'fs';
import path from 'path';

interface InvoiceItem {
  description: string;
  hours: number;
  rate: number;
  amount: number;
}

interface InvoiceData {
  invoice_number: string;
  date: string;
  due_date?: string | null;
  client_name: string;
  client_address: string;
  client_city: string;
  client_postal_code: string;
  client_vat: string;
  user_name: string;
  user_email: string;
  user_vat: string;
  user_phone: string;
  logo_path: string;
  signature_path: string;
  swift: string;
  iban: string;
  notes: string;
  period_start: string;
  period_end: string;
  total: number;
  currency: string;
  items: InvoiceItem[];
}

/**
 * Every value below is user-supplied and lands inside an HTML template. A task
 * description holding `<` or `&` used to break the layout outright, and a
 * `<script>` in one would have run inside the rendering page.
 */
function esc(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Notes are a textarea: newlines are meaningful, so they survive escaping. */
function escMultiline(value: unknown): string {
  return esc(value).replace(/\r?\n/g, '<br>');
}

function toBase64Image(filePath: string): string {
  if (!filePath) return '';
  try {
    const uploadsDir = process.env.UPLOAD_DIR || 'uploads';
    const fullPath = path.join(process.cwd(), uploadsDir, filePath);
    if (!fs.existsSync(fullPath)) return '';
    const buffer = fs.readFileSync(fullPath);
    const ext = path.extname(filePath).slice(1).toLowerCase();
    const mime = ext === 'svg' ? 'svg+xml' : ext;
    return `data:image/${mime};base64,${buffer.toString('base64')}`;
  } catch {
    return '';
  }
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: '2-digit' });
}

/**
 * Mirrors the UI's `money` pipe (Angular `CurrencyPipe`, en-US, 'symbol',
 * '1.0-2'). The PDF used to format de-DE with a trailing symbol, so the same
 * invoice read `1.234,56 €` on paper and `€1,234.56` on screen.
 */
function formatCurrency(amount: number, currency: string = 'EUR'): string {
  const code = (currency || 'EUR').toUpperCase();
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: code,
      currencyDisplay: 'symbol',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    // Unknown/invalid ISO code — Intl throws rather than falling back.
    return `${amount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ${code}`;
  }
}

function buildInvoiceHTML(data: InvoiceData): string {
  const logoBase64 = toBase64Image(data.logo_path);
  const signatureBase64 = toBase64Image(data.signature_path);
  const itemsRows = data.items.map((item, i) => `
    <tr style="background: ${i % 2 === 0 ? '#f9fafb' : '#ffffff'};">
      <td style="padding: 10px 16px; font-size: 12px; color: #374151; border-bottom: 1px solid #f3f4f6;">${escMultiline(item.description)}</td>
      <td style="padding: 10px 16px; font-size: 12px; color: #374151; text-align: center; border-bottom: 1px solid #f3f4f6;">${esc(item.hours)}</td>
      <td style="padding: 10px 16px; font-size: 12px; color: #374151; text-align: center; white-space: nowrap; border-bottom: 1px solid #f3f4f6;">${formatCurrency(item.rate, data.currency)}</td>
      <td style="padding: 10px 16px; font-size: 12px; color: #374151; text-align: right; border-bottom: 1px solid #f3f4f6;">${formatCurrency(item.amount, data.currency)}</td>
    </tr>
  `).join('');

  // Escaped per part, then joined with the <br> markup — escaping the joined
  // string would print the separator literally.
  const clientAddress = [
    esc(data.client_address),
    esc([data.client_postal_code, data.client_city].filter(Boolean).join(' ')),
    data.client_vat ? `VAT: ${esc(data.client_vat)}` : ''
  ].filter(Boolean).join('<br>');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #1f2937; background: white; }
    .page { padding: 48px 52px; min-height: 297mm; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; }
    .logo-wrap img { width: 80px; height: auto; }
    .logo-initials { font-size: 52px; font-weight: 900; color: #06b6d4; letter-spacing: -2px; line-height: 1; }
    .user-info { text-align: right; font-size: 12px; color: #374151; line-height: 1.7; }
    .user-info strong { font-size: 14px; font-weight: 700; color: #111827; }
    .meta-section { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 48px; }
    .bill-to h3 { font-size: 11px; font-weight: 700; color: #9ca3af; letter-spacing: 1.5px; text-transform: uppercase; margin-bottom: 8px; }
    .bill-to p { font-size: 13px; color: #374151; line-height: 1.7; }
    .bill-to p strong { font-weight: 700; color: #111827; font-size: 14px; }
    .invoice-info { text-align: right; }
    .invoice-info h2 { font-size: 28px; font-weight: 800; color: #111827; margin-bottom: 12px; }
    .invoice-info .field { margin-bottom: 4px; }
    .invoice-info .label { font-size: 10px; color: #9ca3af; letter-spacing: 1px; text-transform: uppercase; }
    .invoice-info .value { font-size: 15px; font-weight: 700; color: #111827; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 32px; }
    thead tr { background: transparent; }
    thead th { padding: 10px 16px; font-size: 10px; font-weight: 700; color: #9ca3af; letter-spacing: 1.5px; text-transform: uppercase; border-bottom: 2px solid #e5e7eb; text-align: left; }
    thead th:last-child { text-align: right; }
    thead th:nth-child(2), thead th:nth-child(3) { text-align: center; }
    .total-section { display: flex; justify-content: flex-end; margin-bottom: 48px; }
    .total-box { display: flex; align-items: center; gap: 24px; }
    .total-box .label { font-size: 11px; font-weight: 700; color: #9ca3af; letter-spacing: 1.5px; text-transform: uppercase; }
    .total-box .amount { font-size: 28px; font-weight: 900; color: #6366f1; }
    .payment-section { border-top: 1px solid #e5e7eb; padding-top: 28px; margin-bottom: 28px; }
    .payment-section p { font-size: 12px; color: #6b7280; margin-bottom: 8px; }
    .payment-section .bank-details { font-size: 13px; font-weight: 700; color: #111827; margin-bottom: 4px; }
    .bank-row { display: flex; gap: 32px; margin-top: 8px; }
    .bank-field .bk-label { font-size: 10px; color: #9ca3af; letter-spacing: 1px; text-transform: uppercase; }
    .bank-field .bk-value { font-size: 13px; font-weight: 700; color: #111827; }
    .notes-section { margin-bottom: 40px; }
    .notes-section h4 { font-size: 11px; font-weight: 700; color: #9ca3af; letter-spacing: 1.5px; text-transform: uppercase; margin-bottom: 8px; }
    .notes-section p { font-size: 12px; color: #6b7280; line-height: 1.6; }
    .signature-section img { height: 60px; width: auto; }
  </style>
</head>
<body>
  <div class="page">
    <!-- Header -->
    <div class="header">
      <div class="logo-wrap">
        ${logoBase64
          ? `<img src="${logoBase64}" alt="Logo">`
          : `<div class="logo-initials">${esc((data.user_name || 'JP').split(' ').map(n => n[0]).join(''))}</div>`
        }
      </div>
      <div class="user-info">
        <strong>${esc(data.user_name)}</strong><br>
        ${data.user_vat ? `VAT: ${esc(data.user_vat)}<br>` : ''}
        ${esc(data.user_email)}<br>
        ${esc(data.user_phone)}
      </div>
    </div>

    <!-- Bill To + Invoice Info -->
    <div class="meta-section">
      <div class="bill-to">
        <h3>Bill To</h3>
        <p>
          <strong>${esc(data.client_name)}</strong><br>
          ${clientAddress}
        </p>
      </div>
      <div class="invoice-info">
        <h2>Invoice</h2>
        <div class="field">
          <div class="label">N°</div>
          <div class="value">${esc(data.invoice_number)}</div>
        </div>
        <div class="field">
          <div class="label">Date</div>
          <div class="value">${formatDate(data.date)}</div>
        </div>
        ${data.due_date ? `
        <div class="field">
          <div class="label">Due</div>
          <div class="value">${formatDate(data.due_date)}</div>
        </div>` : ''}
      </div>
    </div>

    <!-- Items Table -->
    <table>
      <thead>
        <tr>
          <th>Task Description</th>
          <th style="text-align:center;">Hours</th>
          <th style="text-align:center; white-space:nowrap;">Rate</th>
          <th style="text-align:right;">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${itemsRows}
      </tbody>
    </table>

    <!-- Total -->
    <div class="total-section">
      <div class="total-box">
        <span class="label">Total</span>
        <span class="amount">${formatCurrency(data.total, data.currency)}</span>
      </div>
    </div>

    <!-- Payment Info -->
    ${(data.swift || data.iban) ? `
    <div class="payment-section">
      <p>Transfer the amount to the account below</p>
      <div class="bank-row">
        ${data.swift ? `<div class="bank-field"><div class="bk-label">SWIFT/BIC</div><div class="bk-value">${esc(data.swift)}</div></div>` : ''}
        ${data.iban ? `<div class="bank-field"><div class="bk-label">IBAN</div><div class="bk-value">${esc(data.iban)}</div></div>` : ''}
      </div>
    </div>` : ''}

    <!-- Notes -->
    ${data.notes ? `
    <div class="notes-section">
      <h4>Notes</h4>
      <p>${escMultiline(data.notes)}</p>
    </div>` : ''}

    <!-- Signature -->
    ${signatureBase64 ? `
    <div class="signature-section">
      <img src="${signatureBase64}" alt="Signature">
    </div>` : ''}
  </div>
</body>
</html>`;
}

/**
 * Chromium is reused across requests: launching one per PDF costs ~1-2s and
 * ~150MB. `launching` dedupes concurrent cold starts.
 */
let browserInstance: Browser | null = null;
let launching: Promise<Browser> | null = null;

async function getBrowser(): Promise<Browser> {
  if (browserInstance?.connected) return browserInstance;
  if (launching) return launching;

  launching = puppeteer
    .launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
    })
    .then((browser) => {
      browserInstance = browser;
      // Reset the handle if Chromium dies so the next call relaunches it.
      browser.on('disconnected', () => {
        if (browserInstance === browser) browserInstance = null;
      });
      return browser;
    })
    .finally(() => {
      launching = null;
    });

  return launching;
}

export async function closeBrowser(): Promise<void> {
  const browser = browserInstance;
  browserInstance = null;
  await browser?.close().catch(() => undefined);
}

/**
 * Each open page costs Chromium ~50-80MB, and the container is capped at 1GB.
 * Unbounded concurrent renders used to get the whole process OOM-killed, which
 * takes the API down with it — so requests queue instead.
 */
const MAX_CONCURRENT_RENDERS = Number(process.env.PDF_CONCURRENCY || 3);
let activeRenders = 0;
const renderQueue: (() => void)[] = [];

async function acquireRenderSlot(): Promise<void> {
  if (activeRenders < MAX_CONCURRENT_RENDERS) {
    activeRenders++;
    return;
  }
  await new Promise<void>((resolve) => renderQueue.push(resolve));
  activeRenders++;
}

function releaseRenderSlot(): void {
  activeRenders--;
  renderQueue.shift()?.();
}

export async function generateInvoicePDF(data: InvoiceData): Promise<Buffer> {
  const html = buildInvoiceHTML(data);

  await acquireRenderSlot();
  try {
    const browser = await getBrowser();
    const page = await browser.newPage();

    try {
      await page.setContent(html, { waitUntil: 'load' });

      const pdf = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '0', right: '0', bottom: '0', left: '0' },
      });

      return Buffer.from(pdf);
    } finally {
      await page.close().catch(() => undefined);
    }
  } finally {
    releaseRenderSlot();
  }
}

/**
 * The on-screen preview renders this same HTML in an iframe. Two hand-kept
 * copies of the invoice layout — one here, one in the Angular template — drifted
 * every time either side was touched.
 */
export function renderInvoiceHTML(data: InvoiceData): string {
  return buildInvoiceHTML(data);
}

export type { InvoiceData };
