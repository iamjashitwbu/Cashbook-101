import { Transaction } from '../types';

export const exportToCSV = (transactions: Transaction[]): void => {
  const sortedTransactions = [...transactions].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  let runningBalance = 0;
  const rows = sortedTransactions.map((transaction) => {
    if (transaction.type === 'income') {
      runningBalance += transaction.amount;
    } else {
      runningBalance -= transaction.amount;
    }

    return {
      Date: transaction.date,
      Type: transaction.type,
      Category: transaction.category,
      Description: transaction.description,
      Amount: transaction.amount.toFixed(2),
      Balance: runningBalance.toFixed(2)
    };
  });

  const headers = ['Date', 'Type', 'Category', 'Description', 'Amount', 'Balance'];
  const csvContent = [
    headers.join(','),
    ...rows.map((row) =>
      headers
        .map((header) => {
          const value = row[header as keyof typeof row];
          return `"${value}"`;
        })
        .join(',')
    )
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  link.setAttribute('href', url);
  link.setAttribute('download', `cashbook_${new Date().toISOString().split('T')[0]}.csv`);
  link.style.visibility = 'hidden';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
