import { InvoiceData, InvoiceLineItem, Transaction } from '../types';

export const INVOICE_EXTRACTION_SYSTEM_PROMPT =
  'Extract all invoice data from this image and return ONLY a JSON object with no extra text, no markdown, no backticks. Fields: vendor_name, invoice_number, invoice_date, due_date, line_items (array of: description, quantity, unit_price, amount), subtotal, gst_amount, total_amount, payment_status. Set any missing field to null.';

export const parseJsonObject = (value: string) => {
  const cleanedValue = value.replace(/```json|```/gi, '').trim();

  try {
    return JSON.parse(cleanedValue);
  } catch {
    const jsonStart = cleanedValue.indexOf('{');
    const jsonEnd = cleanedValue.lastIndexOf('}');

    if (jsonStart === -1 || jsonEnd === -1 || jsonEnd <= jsonStart) {
      throw new Error('The model returned an unexpected response format.');
    }

    return JSON.parse(cleanedValue.slice(jsonStart, jsonEnd + 1));
  }
};

export const normalizeInvoiceData = (rawValue: unknown): InvoiceData => {
  if (!rawValue || typeof rawValue !== 'object') {
    throw new Error('The model returned invalid invoice data.');
  }

  const rawInvoice = rawValue as Record<string, unknown>;

  return {
    vendor_name: normalizeNullableString(rawInvoice.vendor_name),
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
  }
): Omit<Transaction, 'id'> | null => {
  if (!invoiceData.invoice_date || invoiceData.total_amount === null) {
    return null;
  }

  const transactionType = invoiceData.transaction_type === 'sale' ? 'income' : 'expense';
  const defaultIncomeCategory = selectDefaultCategory(categories.income, 'Other Income');
  const defaultExpenseCategory = selectDefaultCategory(categories.expense, 'Other');
  const descriptionParts = [invoiceData.vendor_name, invoiceData.invoice_number].filter(Boolean);
  const transaction: Omit<Transaction, 'id'> = {
    date: invoiceData.invoice_date,
    description:
      descriptionParts.join(' - ') ||
      (transactionType === 'income' ? 'Invoice sale' : 'Invoice purchase'),
    amount: invoiceData.total_amount,
    type: transactionType,
    category: transactionType === 'income' ? defaultIncomeCategory : defaultExpenseCategory
  };

  if (transactionType === 'expense') {
    transaction.expenseCategory = 'cogs';
  }

  return transaction;
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

  const datePart = trimmedValue.split(' ')[0];

  if (/^\d{4}[-/]\d{2}[-/]\d{2}$/.test(datePart)) {
    const [year, month, day] = datePart.split(/[-/]/);
    return `${year}-${month}-${day}`;
  }

  if (/^\d{2}[-/]\d{2}[-/]\d{4}$/.test(datePart)) {
    const [day, month, year] = datePart.split(/[-/]/);
    return `${year}-${month}-${day}`;
  }

  if (/^\d{2}-[A-Za-z]{3}-\d{4}$/.test(datePart)) {
    const parsedDate = new Date(datePart);
    return Number.isNaN(parsedDate.getTime()) ? null : formatDate(parsedDate);
  }

  const parsedDate = new Date(trimmedValue);
  return Number.isNaN(parsedDate.getTime()) ? null : formatDate(parsedDate);
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
