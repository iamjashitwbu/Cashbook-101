export type TransactionType = 'income' | 'expense';
export type ExpenseCategory = 'cogs' | 'operating' | 'other';

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
