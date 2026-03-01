import puppeteer from 'puppeteer';
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

function formatCurrency(amount: number, currency: string = 'EUR'): string {
  const sym = currency === 'EUR' ? '€' : currency === 'USD' ? '$' : currency;
  return `${amount.toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ${sym}`;
}

function buildInvoiceHTML(data: InvoiceData): string {
  const logoBase64 = toBase64Image(data.logo_path);
  const signatureBase64 = toBase64Image(data.signature_path);
  const sym = data.currency === 'EUR' ? '€' : data.currency === 'USD' ? '$' : data.currency || '€';

  const itemsRows = data.items.map((item, i) => `
    <tr style="background: ${i % 2 === 0 ? '#f9fafb' : '#ffffff'};">
      <td style="padding: 10px 16px; font-size: 12px; color: #374151; border-bottom: 1px solid #f3f4f6;">${item.description}</td>
      <td style="padding: 10px 16px; font-size: 12px; color: #374151; text-align: center; border-bottom: 1px solid #f3f4f6;">${item.hours}</td>
      <td style="padding: 10px 16px; font-size: 12px; color: #374151; text-align: center; border-bottom: 1px solid #f3f4f6;">${item.rate} ${sym}</td>
      <td style="padding: 10px 16px; font-size: 12px; color: #374151; text-align: right; border-bottom: 1px solid #f3f4f6;">${formatCurrency(item.amount, data.currency)}</td>
    </tr>
  `).join('');

  const clientAddress = [
    data.client_address,
    [data.client_postal_code, data.client_city].filter(Boolean).join(' '),
    data.client_vat ? `VAT: ${data.client_vat}` : ''
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
          : `<div class="logo-initials">${(data.user_name || 'JP').split(' ').map(n => n[0]).join('')}</div>`
        }
      </div>
      <div class="user-info">
        <strong>${data.user_name || ''}</strong><br>
        ${data.user_vat ? `VAT: ${data.user_vat}<br>` : ''}
        ${data.user_email || ''}<br>
        ${data.user_phone || ''}
      </div>
    </div>

    <!-- Bill To + Invoice Info -->
    <div class="meta-section">
      <div class="bill-to">
        <h3>Bill To</h3>
        <p>
          <strong>${data.client_name || ''}</strong><br>
          ${clientAddress}
        </p>
      </div>
      <div class="invoice-info">
        <h2>Invoice</h2>
        <div class="field">
          <div class="label">N°</div>
          <div class="value">${data.invoice_number}</div>
        </div>
        <div class="field">
          <div class="label">Date</div>
          <div class="value">${formatDate(data.date)}</div>
        </div>
      </div>
    </div>

    <!-- Items Table -->
    <table>
      <thead>
        <tr>
          <th>Task Description</th>
          <th style="text-align:center;">Hours</th>
          <th style="text-align:center;">Rate</th>
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
        ${data.swift ? `<div class="bank-field"><div class="bk-label">SWIFT/BIC</div><div class="bk-value">${data.swift}</div></div>` : ''}
        ${data.iban ? `<div class="bank-field"><div class="bk-label">IBAN</div><div class="bk-value">${data.iban}</div></div>` : ''}
      </div>
    </div>` : ''}

    <!-- Notes -->
    ${data.notes ? `
    <div class="notes-section">
      <h4>Notes</h4>
      <p>${data.notes}</p>
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

export async function generateInvoicePDF(data: InvoiceData): Promise<Buffer> {
  const html = buildInvoiceHTML(data);

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'load' });

    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
    });

    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}
