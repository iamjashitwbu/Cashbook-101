export type TransactionType = 'income' | 'expense';
export type ExpenseCategory = 'cogs' | 'operating' | 'other';
export type InvoiceTransactionType = 'sale' | 'purchase';

export interface Transaction {
  id: string;
  date: string;
  type: TransactionType;
  category: string;
  expenseCategory?: ExpenseCategory;
  amount: number;
  description: string;
}

export interface DateRange {
  start: string;
  end: string;
}

export interface Filters {
  dateRange: DateRange | null;
  category: string;
}

export interface Entity {
  id: string;
  name: string;
  createdAt: string;
}

export interface AppData {
  entities: Entity[];
  currentEntityId: string;
  transactions: { [entityId: string]: Transaction[] };
  categories: {
    income: string[];
    expense: string[];
  };
}

export interface InvoiceLineItem {
  description: string | null;
  quantity: number | null;
  unit_price: number | null;
  amount: number | null;
}

export interface InvoiceData {
  vendor_name: string | null;
  invoice_number: string | null;
  invoice_date: string | null;
  due_date: string | null;
  line_items: InvoiceLineItem[];
  subtotal: number | null;
  gst_amount: number | null;
  total_amount: number | null;
  payment_status: string | null;
  transaction_type: InvoiceTransactionType | null;
}
