import { Entity, InvoiceData, InvoiceLineItem, Transaction, TransactionType } from '../types';

export const INVOICE_EXTRACTION_SYSTEM_PROMPT =
  "Extract all invoice data from this image and return ONLY JSON. Fields: seller_name, seller_gstin, buyer_name, buyer_gstin, invoice_number, invoice_date, due_date, line_items (array of: description, quantity, unit_price, amount), subtotal, gst_amount, total_amount, transaction_type. For transaction_type, return 'sale' if this is an invoice issued by us (we are the seller), return 'purchase' if this is an invoice we received (we are the buyer). Set any missing field to null. Respond ONLY with a valid JSON object. No explanation, no markdown, no code fences. Start your response with { and end with }.";

export const parseJsonObject = (value: string): unknown | null => {
  const cleanedValue = value.replace(/```json|```/gi, '').trim();
  const jsonStart = cleanedValue.indexOf('{');
  const jsonEnd = cleanedValue.lastIndexOf('}');

  if (jsonStart === -1 || jsonEnd === -1 || jsonEnd <= jsonStart) {
    console.error('Raw invoice response:', value);
    return null;
  }

  try {
    return JSON.parse(cleanedValue.slice(jsonStart, jsonEnd + 1));
  } catch (error) {
    console.error('Raw invoice response:', value);
    console.error('Invoice JSON parse error:', error);
    return null;
  }
};

export const normalizeInvoiceData = (rawValue: unknown): InvoiceData => {
  if (!rawValue || typeof rawValue !== 'object') {
    throw new Error('The model returned invalid invoice data.');
  }

  const rawInvoice = rawValue as Record<string, unknown>;
  const sellerName = normalizeNullableString(rawInvoice.seller_name);
  const buyerName = normalizeNullableString(rawInvoice.buyer_name);

  return {
    vendor_name: normalizeNullableString(rawInvoice.vendor_name) ?? sellerName ?? buyerName,
    seller_name: sellerName,
    seller_gstin: normalizeNullableString(rawInvoice.seller_gstin),
    buyer_name: buyerName,
    buyer_gstin: normalizeNullableString(rawInvoice.buyer_gstin),
    invoice_number: normalizeNullableString(rawInvoice.invoice_number),
    invoice_date: normalizeNullableDate(rawInvoice.invoice_date),
    due_date: normalizeNullableDate(rawInvoice.due_date),
    line_items: normalizeLineItems(rawInvoice.line_items),
    subtotal: normalizeNullableNumber(rawInvoice.subtotal),
    gst_amount: normalizeNullableNumber(rawInvoice.gst_amount),
    total_amount: normalizeNullableNumber(rawInvoice.total_amount),
    payment_status: normalizeNullableString(rawInvoice.payment_status),
    transaction_type: normalizeTransactionType(rawInvoice.transaction_type)
  };
};

export const mapInvoiceToTransaction = (
  invoiceData: InvoiceData,
  categories: {
    income: string[];
    expense: string[];
  },
  entity: Entity | undefined
): Omit<Transaction, 'id'> | null => {
  if (!invoiceData.invoice_date || invoiceData.total_amount === null) {
    return null;
  }

  const transactionType = classifyInvoiceTransaction(invoiceData, entity);
  const defaultIncomeCategory = selectDefaultCategory(categories.income, 'Sales Revenue');
  const defaultExpenseCategory = selectDefaultCategory(categories.expense, 'Other');
  const counterpartyName =
    transactionType === 'income'
      ? invoiceData.buyer_name ?? invoiceData.vendor_name
      : invoiceData.seller_name ?? invoiceData.vendor_name;
  const descriptionParts = [counterpartyName, invoiceData.invoice_number].filter(Boolean);
  const transaction: Omit<Transaction, 'id'> = {
    date: invoiceData.invoice_date,
    description:
      descriptionParts.join(' - ') ||
      (transactionType === 'income' ? 'Invoice sale' : 'Invoice purchase'),
    amount: invoiceData.total_amount,
    type: transactionType,
    category: transactionType === 'income' ? defaultIncomeCategory : defaultExpenseCategory,
    source: 'invoice'
  };

  if (transactionType === 'expense') {
    transaction.expenseCategory = 'cogs';
  }

  return transaction;
};

export const classifyInvoiceTransaction = (
  invoiceData: InvoiceData,
  entity: Entity | undefined
): TransactionType => {
  const normalizedBusinessGstin = normalizeComparableValue(entity?.gstin || '');
  const normalizedSellerGstin = normalizeComparableValue(invoiceData.seller_gstin);
  const normalizedBuyerGstin = normalizeComparableValue(invoiceData.buyer_gstin);

  if (normalizedBusinessGstin && normalizedSellerGstin === normalizedBusinessGstin) {
    return 'income';
  }

  if (normalizedBusinessGstin && normalizedBuyerGstin === normalizedBusinessGstin) {
    return 'expense';
  }

  const normalizedBusinessName = normalizeComparableValue(entity?.name || '');
  const normalizedSellerName = normalizeComparableValue(invoiceData.seller_name);
  const normalizedBuyerName = normalizeComparableValue(invoiceData.buyer_name);

  if (normalizedBusinessName && normalizedSellerName.includes(normalizedBusinessName)) {
    return 'income';
  }

  if (normalizedBusinessName && normalizedBuyerName.includes(normalizedBusinessName)) {
    return 'expense';
  }

  if (invoiceData.transaction_type === 'sale') {
    return 'income';
  }

  if (invoiceData.transaction_type === 'purchase') {
    return 'expense';
  }

  return 'expense';
};

const normalizeLineItems = (value: unknown): InvoiceLineItem[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((item) => {
    const rawItem = item && typeof item === 'object' ? (item as Record<string, unknown>) : {};

    return {
      description: normalizeNullableString(rawItem.description),
      quantity: normalizeNullableNumber(rawItem.quantity),
      unit_price: normalizeNullableNumber(rawItem.unit_price),
      amount: normalizeNullableNumber(rawItem.amount)
    };
  });
};

const normalizeNullableString = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return null;
  }

  const normalizedValue = trimmedValue.toLowerCase();
  if (normalizedValue === 'null' || normalizedValue === 'n/a' || normalizedValue === 'na') {
    return null;
  }

  return trimmedValue;
};

const normalizeNullableNumber = (value: unknown): number | null => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value !== 'string') {
    return null;
  }

  const numericValue = value.replace(/,/g, '').replace(/[^\d.-]/g, '');

  if (!numericValue) {
    return null;
  }

  const parsedNumber = Number.parseFloat(numericValue);
  return Number.isNaN(parsedNumber) ? null : parsedNumber;
};

const normalizeNullableDate = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return null;
  }

  const cleanedValue = trimmedValue
    .replace(/(\d{1,2})(st|nd|rd|th)\b/gi, '$1')
    .replace(/,/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const monthMap: Record<string, number> = {
    jan: 1,
    january: 1,
    feb: 2,
    february: 2,
    mar: 3,
    march: 3,
    apr: 4,
    april: 4,
    may: 5,
    jun: 6,
    june: 6,
    jul: 7,
    july: 7,
    aug: 8,
    august: 8,
    sep: 9,
    sept: 9,
    september: 9,
    oct: 10,
    october: 10,
    nov: 11,
    november: 11,
    dec: 12,
    december: 12
  };
  const buildNormalizedDate = (
    yearValue: string,
    monthValue: string | number,
    dayValue: string
  ) => {
    const year = Number.parseInt(yearValue, 10);
    const month =
      typeof monthValue === 'number'
        ? monthValue
        : monthMap[monthValue.trim().toLowerCase()];
    const day = Number.parseInt(dayValue, 10);

    if (
      !Number.isInteger(year) ||
      !Number.isInteger(month) ||
      !Number.isInteger(day) ||
      month < 1 ||
      month > 12 ||
      day < 1 ||
      day > 31
    ) {
      return null;
    }

    const parsedDate = new Date(year, month - 1, day);

    if (
      Number.isNaN(parsedDate.getTime()) ||
      parsedDate.getFullYear() !== year ||
      parsedDate.getMonth() !== month - 1 ||
      parsedDate.getDate() !== day
    ) {
      return null;
    }

    return formatDate(parsedDate);
  };

  if (!/^\d{1,4}[/-]\d{1,2}[/-]\d{1,4}$/.test(cleanedValue)) {
    const parsedDate = new Date(cleanedValue);

    if (!Number.isNaN(parsedDate.getTime())) {
      return formatDate(parsedDate);
    }
  }

  let match = cleanedValue.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);

  if (match) {
    const [, day, month, year] = match;
    return buildNormalizedDate(year, Number.parseInt(month, 10), day);
  }

  match = cleanedValue.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);

  if (match) {
    const [, year, month, day] = match;
    return buildNormalizedDate(year, Number.parseInt(month, 10), day);
  }

  match = cleanedValue.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/);

  if (match) {
    const [, day, month, year] = match;
    return buildNormalizedDate(year, month, day);
  }

  match = cleanedValue.match(/^([A-Za-z]+)\s+(\d{1,2})\s+(\d{4})$/);

  if (match) {
    const [, month, day, year] = match;
    return buildNormalizedDate(year, month, day);
  }

  return null;
};

const normalizeTransactionType = (value: unknown): 'sale' | 'purchase' | null => {
  if (typeof value !== 'string') {
    return null;
  }

  const normalizedValue = value.trim().toLowerCase();

  if (normalizedValue === 'sale' || normalizedValue === 'purchase') {
    return normalizedValue;
  }

  return null;
};

const normalizeComparableValue = (value: string | null) =>
  value?.trim().toLowerCase().replace(/\s+/g, ' ').replace(/[^a-z0-9]/g, '') || '';

const formatDate = (date: Date) => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const selectDefaultCategory = (categories: string[], preferredCategory: string) => {
  if (categories.includes(preferredCategory)) {
    return preferredCategory;
  }

  if (categories.length > 0) {
    return categories[0];
  }

  return preferredCategory;
};
