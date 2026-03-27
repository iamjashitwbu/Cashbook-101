import * as XLSX from 'xlsx';
import { Transaction } from '../types';
import { formatCurrencySymbol } from './format';

interface ExcelExportOptions {
  entityName: string;
  transactions: Transaction[];
}

export const exportToExcel = ({ entityName, transactions }: ExcelExportOptions) => {
  const sortedTransactions = [...transactions].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  let runningBalance = 0;
  let incomeBalance = 0;
  let expenseBalance = 0;

  const incomeRows: any[] = [];
  const expenseRows: any[] = [];

  sortedTransactions.forEach((transaction) => {
    if (transaction.type === 'income') {
      incomeBalance += transaction.amount;
      runningBalance += transaction.amount;
      incomeRows.push({
        Date: transaction.date,
        Category: transaction.category,
        Description: transaction.description || '',
        Amount: formatCurrencySymbol(transaction.amount),
        'Balance': formatCurrencySymbol(runningBalance)
      });
    } else {
      expenseBalance += transaction.amount;
      runningBalance -= transaction.amount;
      expenseRows.push({
        Date: transaction.date,
        Category: transaction.category,
        'Expense Type': transaction.expenseCategory || 'Operating',
        Description: transaction.description || '',
        Amount: formatCurrencySymbol(transaction.amount),
        'Balance': formatCurrencySymbol(runningBalance)
      });
    }
  });

  const wb = XLSX.utils.book_new();

  if (incomeRows.length > 0) {
    const incomeWs = XLSX.utils.json_to_sheet([], { header: 1 });
    XLSX.utils.sheet_add_aoa(incomeWs, [[entityName, `Export Date: ${new Date().toLocaleDateString()}`]]);
    XLSX.utils.sheet_add_aoa(incomeWs, [[]], { origin: 'A2' });
    XLSX.utils.sheet_add_aoa(incomeWs, [['INCOME']], { origin: 'A3' });
    XLSX.utils.sheet_add_json(incomeWs, incomeRows, { origin: 'A4' });

    const headers = ['Date', 'Category', 'Description', 'Amount', 'Balance'];
    const headerRange = XLSX.utils.encode_col(0) + '4:' + XLSX.utils.encode_col(headers.length - 1) + '4';
    incomeWs['!cols'] = [
      { wch: 12 },
      { wch: 18 },
      { wch: 25 },
      { wch: 15 },
      { wch: 15 }
    ];

    XLSX.utils.book_append_sheet(wb, incomeWs, 'Income');
  }

  if (expenseRows.length > 0) {
    const expenseWs = XLSX.utils.json_to_sheet([], { header: 1 });
    XLSX.utils.sheet_add_aoa(expenseWs, [[entityName, `Export Date: ${new Date().toLocaleDateString()}`]]);
    XLSX.utils.sheet_add_aoa(expenseWs, [[]], { origin: 'A2' });
    XLSX.utils.sheet_add_aoa(expenseWs, [['EXPENSES']], { origin: 'A3' });
    XLSX.utils.sheet_add_json(expenseWs, expenseRows, { origin: 'A4' });

    const headers = ['Date', 'Category', 'Expense Type', 'Description', 'Amount', 'Balance'];
    expenseWs['!cols'] = [
      { wch: 12 },
      { wch: 18 },
      { wch: 15 },
      { wch: 25 },
      { wch: 15 },
      { wch: 15 }
    ];

    XLSX.utils.book_append_sheet(wb, expenseWs, 'Expenses');
  }

  const summaryWs = XLSX.utils.json_to_sheet([], { header: 1 });
  XLSX.utils.sheet_add_aoa(summaryWs, [[entityName]]);
  XLSX.utils.sheet_add_aoa(summaryWs, [['Summary']], { origin: 'A2' });
  XLSX.utils.sheet_add_aoa(summaryWs, [[]], { origin: 'A3' });
  XLSX.utils.sheet_add_aoa(summaryWs, [['Total Income:', formatCurrencySymbol(incomeBalance)]], {
    origin: 'A4'
  });
  XLSX.utils.sheet_add_aoa(summaryWs, [['Total Expenses:', formatCurrencySymbol(expenseBalance)]], {
    origin: 'A5'
  });
  XLSX.utils.sheet_add_aoa(summaryWs, [['Net:', formatCurrencySymbol(incomeBalance - expenseBalance)]], {
    origin: 'A6'
  });
  summaryWs['!cols'] = [{ wch: 20 }, { wch: 20 }];

  XLSX.utils.book_append_sheet(wb, summaryWs, 'Summary');

  const filename = `${entityName}_${new Date().toISOString().split('T')[0]}.xlsx`;
  XLSX.writeFile(wb, filename);
};
