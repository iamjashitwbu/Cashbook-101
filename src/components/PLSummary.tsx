import { useRef, useState } from 'react';
import { BarChart3, TrendingUp, TrendingDown, DollarSign, Download } from 'lucide-react';
import { Transaction, Entity } from '../types';
import { formatCurrencySymbol } from '../utils/format';
import html2canvas from 'html2canvas';

interface PLSummaryProps {
  transactions: Transaction[];
  entity: Entity | undefined;
}

interface PLData {
  revenue: number;
  otherIncome: number;
  cogs: number;
  operatingExpenses: number;
  otherExpenses: number;
}

export const PLSummary = ({ transactions, entity }: PLSummaryProps) => {
  const [exportMonth, setExportMonth] = useState(new Date().toISOString().split('T')[0].slice(0, 7));
  const statementRef = useRef<HTMLDivElement>(null);

  const getMonthTransactions = (monthStr: string) => {
    return transactions.filter((t) => t.date.startsWith(monthStr));
  };

  const calculatePLData = (txns: Transaction[]): PLData => {
    return {
      revenue: txns
        .filter((t) => t.type === 'income' && t.category !== 'Interest')
        .reduce((sum, t) => sum + t.amount, 0),
      otherIncome: txns
        .filter((t) => t.type === 'income' && t.category === 'Interest')
        .reduce((sum, t) => sum + t.amount, 0),
      cogs: txns
        .filter((t) => t.type === 'expense' && t.expenseCategory === 'cogs')
        .reduce((sum, t) => sum + t.amount, 0),
      operatingExpenses: txns
        .filter((t) => t.type === 'expense' && t.expenseCategory === 'operating')
        .reduce((sum, t) => sum + t.amount, 0),
      otherExpenses: txns
        .filter((t) => t.type === 'expense' && t.expenseCategory === 'other')
        .reduce((sum, t) => sum + t.amount, 0)
    };
  };

  const monthTransactions = getMonthTransactions(exportMonth);
  const pl = calculatePLData(monthTransactions);

  const grossProfit = pl.revenue - pl.cogs;
  const operatingProfit = grossProfit - pl.operatingExpenses;
  const profitBeforeTax = operatingProfit + pl.otherIncome - pl.otherExpenses;
  const tax = Math.max(0, profitBeforeTax * 0.1);
  const netProfit = profitBeforeTax - tax;

  const allMonthTransactions = transactions.filter(
    (t) => t.type === 'income' || t.type === 'expense'
  );
  const monthSet = new Set(allMonthTransactions.map((t) => t.date.slice(0, 7)));
  const availableMonths = Array.from(monthSet).sort().reverse();

  const handleExportImage = async () => {
    if (!statementRef.current) return;

    try {
      const canvas = await html2canvas(statementRef.current, {
        backgroundColor: '#ffffff',
        scale: 2
      });

      const link = document.createElement('a');
      const monthName = new Date(exportMonth + '-01').toLocaleDateString('en-IN', {
        year: 'numeric',
        month: 'long'
      });
      link.download = `${entity?.name || 'P&L'}_Statement_${monthName}.png`;
      link.href = canvas.toDataURL();
      link.click();
    } catch (error) {
      console.error('Failed to export image:', error);
    }
  };

  if (transactions.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-md p-12 text-center">
        <BarChart3 size={48} className="mx-auto text-gray-400 mb-4" />
        <p className="text-gray-500 text-lg">No data available for P&L summary</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 bg-white p-4 rounded-lg shadow-md">
        <label className="font-medium text-gray-700">Select Month:</label>
        <select
          value={exportMonth}
          onChange={(e) => setExportMonth(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          {availableMonths.map((month) => {
            const monthName = new Date(month + '-01').toLocaleDateString('en-IN', {
              year: 'numeric',
              month: 'long'
            });
            return (
              <option key={month} value={month}>
                {monthName}
              </option>
            );
          })}
        </select>
        <button
          onClick={handleExportImage}
          disabled={monthTransactions.length === 0}
          className="ml-auto flex items-center gap-2 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed font-medium"
        >
          <Download size={18} />
          Export Statement
        </button>
      </div>

      <div
        ref={statementRef}
        className="bg-white p-8 rounded-lg shadow-md border border-gray-300"
        style={{ maxWidth: '900px', margin: '0 auto' }}
      >
        <div className="text-center mb-8 pb-6 border-b-2 border-gray-800">
          <h1 className="text-2xl font-bold text-gray-900">{entity?.name || 'Company'}</h1>
          <p className="text-gray-600 mt-2">
            Profit &amp; Loss Statement for{' '}
            {new Date(exportMonth + '-01').toLocaleDateString('en-IN', {
              year: 'numeric',
              month: 'long'
            })}
          </p>
        </div>

        <table className="w-full text-gray-900 mb-4">
          <tbody className="text-sm">
            <tr className="border-b border-gray-400">
              <td className="py-2 font-semibold">Revenue</td>
              <td className="py-2 text-right font-semibold">{formatCurrencySymbol(pl.revenue)}</td>
            </tr>

            <tr className="border-b border-gray-300">
              <td className="py-2 pl-4 text-gray-700">Cost of Goods Sold</td>
              <td className="py-2 text-right text-gray-700">({formatCurrencySymbol(pl.cogs)})</td>
            </tr>

            <tr className="border-b border-gray-400 bg-gray-50">
              <td className="py-2 font-bold">Gross Profit</td>
              <td className="py-2 text-right font-bold">{formatCurrencySymbol(grossProfit)}</td>
            </tr>

            <tr className="border-b border-gray-300">
              <td colSpan={2} className="py-4 font-semibold text-gray-800">
                Operating Expenses
              </td>
            </tr>

            <tr className="border-b border-gray-300">
              <td className="py-2 pl-4 text-gray-700">Operating Expenses</td>
              <td className="py-2 text-right text-gray-700">
                ({formatCurrencySymbol(pl.operatingExpenses)})
              </td>
            </tr>

            <tr className="border-b border-gray-400 bg-gray-50">
              <td className="py-2 font-bold">Operating Profit (EBIT)</td>
              <td className="py-2 text-right font-bold">{formatCurrencySymbol(operatingProfit)}</td>
            </tr>

            <tr className="border-b border-gray-300">
              <td colSpan={2} className="py-4 font-semibold text-gray-800">
                Other Income / Expenses
              </td>
            </tr>

            <tr className="border-b border-gray-300">
              <td className="py-2 pl-4 text-gray-700">Other Income</td>
              <td className="py-2 text-right text-gray-700">
                {pl.otherIncome > 0 ? formatCurrencySymbol(pl.otherIncome) : '₹0.00'}
              </td>
            </tr>

            <tr className="border-b border-gray-300">
              <td className="py-2 pl-4 text-gray-700">Other Expenses</td>
              <td className="py-2 text-right text-gray-700">
                ({formatCurrencySymbol(pl.otherExpenses)})
              </td>
            </tr>

            <tr className="border-b border-gray-400 bg-gray-50">
              <td className="py-2 font-bold">Profit Before Tax</td>
              <td className="py-2 text-right font-bold">{formatCurrencySymbol(profitBeforeTax)}</td>
            </tr>

            <tr className="border-b border-gray-300">
              <td className="py-2 pl-4 text-gray-700">Tax (10%)</td>
              <td className="py-2 text-right text-gray-700">({formatCurrencySymbol(tax)})</td>
            </tr>

            <tr className="border-t-2 border-gray-800 bg-gray-100">
              <td className="py-3 font-bold text-lg">Net Profit</td>
              <td
                className={`py-3 text-right font-bold text-lg ${
                  netProfit >= 0 ? 'text-green-700' : 'text-red-700'
                }`}
              >
                {formatCurrencySymbol(netProfit)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg shadow-md p-6 text-white">
          <div className="flex items-center justify-between mb-2">
            <span className="text-blue-100 text-sm font-medium">Gross Profit</span>
            <TrendingUp size={20} />
          </div>
          <p className="text-2xl font-bold">{formatCurrencySymbol(grossProfit)}</p>
        </div>

        <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg shadow-md p-6 text-white">
          <div className="flex items-center justify-between mb-2">
            <span className="text-orange-100 text-sm font-medium">Operating Profit</span>
            <DollarSign size={20} />
          </div>
          <p className="text-2xl font-bold">{formatCurrencySymbol(operatingProfit)}</p>
        </div>

        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg shadow-md p-6 text-white">
          <div className="flex items-center justify-between mb-2">
            <span className="text-purple-100 text-sm font-medium">Before Tax</span>
            <TrendingUp size={20} />
          </div>
          <p className="text-2xl font-bold">{formatCurrencySymbol(profitBeforeTax)}</p>
        </div>

        <div
          className={`rounded-lg shadow-md p-6 text-white ${
            netProfit >= 0
              ? 'bg-gradient-to-br from-green-500 to-green-600'
              : 'bg-gradient-to-br from-red-500 to-red-600'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-white/90 text-sm font-medium">Net Profit</span>
            <TrendingDown size={20} />
          </div>
          <p className="text-2xl font-bold">{formatCurrencySymbol(netProfit)}</p>
        </div>
      </div>
    </div>
  );
};
