import { Transaction, TransactionType } from '../types';

const UNRECOGNIZED_FORMAT_ERROR =
  'Unrecognized CSV format. Supported formats: HDFC, SBI, and ICICI bank statements.';

type SupportedBank = 'HDFC' | 'SBI' | 'ICICI';

type CategoriesByType = {
  income: string[];
  expense: string[];
};

type BankStatementDefinition = {
  bankName: SupportedBank;
  headers: string[];
  parseEntry: (
    row: string[],
    columnMap: Record<string, number>
  ) => BankStatementPreviewEntry | null;
};

export interface BankStatementPreviewEntry {
  date: string;
  description: string;
  amount: number;
  type: TransactionType;
}

export interface ExtractedBankStatementRow {
  date: string;
  description: string;
  debit: string;
  credit: string;
  balance: string;
}

export interface ParsedBankStatement {
  bankName: SupportedBank;
  entries: BankStatementPreviewEntry[];
}

const BANK_STATEMENT_DEFINITIONS: BankStatementDefinition[] = [
  {
    bankName: 'HDFC',
    headers: [
      'Date',
      'Narration',
      'Chq/Ref No.',
      'Value Dt',
      'Withdrawal Amt',
      'Deposit Amt',
      'Closing Balance'
    ],
    parseEntry: (row, columnMap) => {
      const withdrawalAmount = parseAmount(row[columnMap['Withdrawal Amt']]);
      const depositAmount = parseAmount(row[columnMap['Deposit Amt']]);

      if (withdrawalAmount === 0 && depositAmount === 0) {
        return null;
      }

      return {
        date: parseDate(row[columnMap.Date]),
        description: buildDescription(
          row[columnMap.Narration],
          row[columnMap['Chq/Ref No.']]
        ),
        amount: depositAmount > 0 ? depositAmount : withdrawalAmount,
        type: depositAmount > 0 ? 'income' : 'expense'
      };
    }
  },
  {
    bankName: 'SBI',
    headers: [
      'Txn Date',
      'Description',
      'Ref No./Cheque No.',
      'Debit',
      'Credit',
      'Balance'
    ],
    parseEntry: (row, columnMap) => {
      const debitAmount = parseAmount(row[columnMap.Debit]);
      const creditAmount = parseAmount(row[columnMap.Credit]);

      if (debitAmount === 0 && creditAmount === 0) {
        return null;
      }

      return {
        date: parseDate(row[columnMap['Txn Date']]),
        description: buildDescription(
          row[columnMap.Description],
          row[columnMap['Ref No./Cheque No.']]
        ),
        amount: creditAmount > 0 ? creditAmount : debitAmount,
        type: creditAmount > 0 ? 'income' : 'expense'
      };
    }
  },
  {
    bankName: 'ICICI',
    headers: [
      'Transaction Date',
      'Transaction Remarks',
      'Amount (INR)',
      'Dr/Cr'
    ],
    parseEntry: (row, columnMap) => {
      const amount = parseAmount(row[columnMap['Amount (INR)']]);
      const direction = normalizeAlphaValue(row[columnMap['Dr/Cr']]);

      if (amount === 0 || !direction) {
        return null;
      }

      return {
        date: parseDate(row[columnMap['Transaction Date']]),
        description: buildDescription(row[columnMap['Transaction Remarks']]),
        amount,
        type: direction === 'cr' ? 'income' : 'expense'
      };
    }
  }
];

export const parseBankStatementCsv = (fileContents: string): ParsedBankStatement => {
  const rows = parseCsv(fileContents);

  if (rows.length < 2) {
    throw new Error(UNRECOGNIZED_FORMAT_ERROR);
  }

  const [headerRow, ...dataRows] = rows;
  const detectedDefinition = detectBankStatementDefinition(headerRow);

  if (!detectedDefinition) {
    throw new Error(UNRECOGNIZED_FORMAT_ERROR);
  }

  const columnMap = createColumnMap(headerRow);
 const entries = dataRows
  .map((row) => detectedDefinition.parseEntry(row, columnMap))
  .filter((entry) => entry !== null) as BankStatementPreviewEntry[];

  return {
    bankName: detectedDefinition.bankName,
    entries
  };
};

export const convertPreviewEntriesToTransactions = (
  entries: BankStatementPreviewEntry[],
  categories: CategoriesByType
): Omit<Transaction, 'id'>[] => {
  const defaultIncomeCategory = selectDefaultCategory(
    categories.income,
    'Other Income'
  );
  const defaultExpenseCategory = selectDefaultCategory(categories.expense, 'Other');

  return entries.map((entry) => {
    const transaction: Omit<Transaction, 'id'> = {
      date: entry.date,
      description: entry.description,
      amount: entry.amount,
      type: entry.type,
      category: entry.type === 'income' ? defaultIncomeCategory : defaultExpenseCategory,
      source: 'bank'
    };

    if (entry.type === 'expense') {
      transaction.expenseCategory = 'operating';
    }

    return transaction;
  });
};

export const convertExtractedRowsToPreviewEntries = (
  rows: ExtractedBankStatementRow[]
): BankStatementPreviewEntry[] =>
  rows
    .map((row) => {
      try {
        const debitAmount = parseAmount(row.debit);
        const creditAmount = parseAmount(row.credit);

        if (debitAmount === 0 && creditAmount === 0) {
          return null;
        }

        return {
          date: parseDate(row.date),
          description: buildDescription(row.description),
          amount: creditAmount > 0 ? creditAmount : debitAmount,
          type: creditAmount > 0 ? 'income' : 'expense'
        };
      } catch {
        return null;
      }
    })
   .filter((entry) => entry !== null) as BankStatementPreviewEntry[];

export const removeDuplicatePreviewEntries = (
  entries: BankStatementPreviewEntry[],
  existingTransactions: Transaction[]
) => {
  const existingKeys = new Set(
    existingTransactions.map((transaction) => buildTransactionDuplicateKey(transaction))
  );
  const seenKeys = new Set<string>();

  return entries.filter((entry) => {
    const duplicateKey = buildTransactionDuplicateKey(entry);

    if (existingKeys.has(duplicateKey) || seenKeys.has(duplicateKey)) {
      return false;
    }

    seenKeys.add(duplicateKey);
    return true;
  });
};

const detectBankStatementDefinition = (
  headerRow: string[]
): BankStatementDefinition | null => {
  const normalizedHeaders = headerRow.map(normalizeHeader);

  return (
    BANK_STATEMENT_DEFINITIONS.find((definition) =>
      definition.headers.every((header) =>
        normalizedHeaders.includes(normalizeHeader(header))
      )
    ) ?? null
  );
};

const createColumnMap = (headerRow: string[]): Record<string, number> => {
  return headerRow.reduce<Record<string, number>>((map, header, index) => {
    map[header.trim()] = index;
    return map;
  }, {});
};

const parseCsv = (fileContents: string): string[][] => {
  const sanitizedContents = fileContents.replace(/^\uFEFF/, '');
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentValue = '';
  let inQuotes = false;

  for (let index = 0; index < sanitizedContents.length; index += 1) {
    const character = sanitizedContents[index];
    const nextCharacter = sanitizedContents[index + 1];

    if (character === '"') {
      if (inQuotes && nextCharacter === '"') {
        currentValue += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (character === ',' && !inQuotes) {
      currentRow.push(currentValue.trim());
      currentValue = '';
      continue;
    }

    if ((character === '\n' || character === '\r') && !inQuotes) {
      if (character === '\r' && nextCharacter === '\n') {
        index += 1;
      }

      currentRow.push(currentValue.trim());
      currentValue = '';

      if (currentRow.some((cell) => cell.length > 0)) {
        rows.push(currentRow);
      }

      currentRow = [];
      continue;
    }

    currentValue += character;
  }

  currentRow.push(currentValue.trim());

  if (currentRow.some((cell) => cell.length > 0)) {
    rows.push(currentRow);
  }

  return rows;
};

const parseDate = (value: string | undefined): string => {
  const trimmedValue = value?.trim();

  if (!trimmedValue) {
    throw new Error('A transaction row is missing a valid date.');
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

    if (!Number.isNaN(parsedDate.getTime())) {
      return formatDate(parsedDate);
    }
  }

  const fallbackDate = new Date(trimmedValue);

  if (Number.isNaN(fallbackDate.getTime())) {
    throw new Error(`Could not parse transaction date "${trimmedValue}".`);
  }

  return formatDate(fallbackDate);
};

const parseAmount = (value: string | undefined): number => {
  if (!value) {
    return 0;
  }

  const numericValue = value.replace(/,/g, '').replace(/[^\d.-]/g, '');

  if (!numericValue) {
    return 0;
  }

  const parsedAmount = Number.parseFloat(numericValue);
  return Number.isNaN(parsedAmount) ? 0 : Math.abs(parsedAmount);
};

const buildDescription = (primaryValue: string | undefined, secondaryValue?: string) => {
  const primaryText = primaryValue?.trim() || 'Imported bank transaction';
  const secondaryText = secondaryValue?.trim();

  if (!secondaryText || isPlaceholderValue(secondaryText)) {
    return primaryText;
  }

  return `${primaryText} (${secondaryText})`;
};

export const buildTransactionDuplicateKey = (
  entry:
    | BankStatementPreviewEntry
    | Pick<Transaction, 'date' | 'amount' | 'description'>
) => {
  const normalizedDescription = entry.description.trim().toLowerCase().replace(/\s+/g, ' ');
  return `${entry.date}__${entry.amount.toFixed(2)}__${normalizedDescription}`;
};

const isPlaceholderValue = (value: string) => {
  const normalizedValue = value.toLowerCase();
  return normalizedValue === 'nan' || normalizedValue === 'na' || normalizedValue === 'null';
};

const normalizeHeader = (value: string) => value.trim().toLowerCase().replace(/\s+/g, ' ');

const normalizeAlphaValue = (value: string | undefined) =>
  value?.trim().toLowerCase().replace(/[^a-z]/g, '') || '';

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
