import * as XLSX from 'xlsx';
import { Transaction } from '../types';

interface ExcelExportOptions {
  transactions: Transaction[];
}

export const exportToExcel = ({ transactions }: ExcelExportOptions) => {
  const sortedTransactions = [...transactions].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  let runningBalance = 0;
  const rows = sortedTransactions.map((transaction) => {
    const debit = transaction.type === 'expense' ? transaction.amount : 0;
    const credit = transaction.type === 'income' ? transaction.amount : 0;
    runningBalance += credit - debit;

    return {
      Date: transaction.date,
      Description: transaction.description || transaction.category || '',
      Debit: debit || '',
      Credit: credit || '',
      Balance: runningBalance
    };
  });

  const wb = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(rows, {
    header: ['Date', 'Description', 'Debit', 'Credit', 'Balance']
  });

  worksheet['!cols'] = [
    { wch: 14 },
    { wch: 42 },
    { wch: 14 },
    { wch: 14 },
    { wch: 14 }
  ];

  XLSX.utils.book_append_sheet(wb, worksheet, 'Cashbook');

  const filename = `cashbook-${new Date().toISOString().split('T')[0]}.xlsx`;
  XLSX.writeFile(wb, filename);
};
