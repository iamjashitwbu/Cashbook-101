import { useState } from 'react';
import { Trash2, TrendingUp, TrendingDown, Pencil, Check, X } from 'lucide-react';
import { Transaction, TransactionType, AppData } from '../types';
import { formatCurrencySymbol } from '../utils/format';

interface TransactionListProps {
  transactions: Transaction[];
  appData: AppData;
  onDelete: (id: string) => void;
  onEdit: (updated: Transaction) => void;
}

interface EditState {
  description: string;
  amount: string;
  type: TransactionType;
  category: string;
}

export const TransactionList = ({ transactions, appData, onDelete, onEdit }: TransactionListProps) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editState, setEditState] = useState<EditState>({
    description: '',
    amount: '',
    type: 'income',
    category: ''
  });

  const sortedTransactions = [...transactions].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  let runningBalance = 0;
  const transactionsWithBalance = sortedTransactions.map((transaction) => {
    if (transaction.type === 'income') {
      runningBalance += transaction.amount;
    } else {
      runningBalance -= transaction.amount;
    }
    return { ...transaction, balance: runningBalance };
  });

  const startEdit = (transaction: Transaction) => {
    setEditingId(transaction.id);
    setEditState({
      description: transaction.description || '',
      amount: String(transaction.amount),
      type: transaction.type,
      category: transaction.category
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const saveEdit = (transaction: Transaction) => {
    const parsedAmount = parseFloat(editState.amount.replace(/,/g, ''));
    if (isNaN(parsedAmount) || parsedAmount <= 0) return;

    onEdit({
      ...transaction,
      description: editState.description.trim() || 'Transaction',
      amount: parsedAmount,
      type: editState.type,
      category: editState.category
    });
    setEditingId(null);
  };

  const allCategories =
    editState.type === 'income'
      ? appData.categories.income
      : appData.categories.expense;

  if (transactionsWithBalance.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-md p-12 text-center">
        <p className="text-gray-500 text-lg">No transactions yet. Add your first entry above!</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Date</th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Type</th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Category</th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Description</th>
              <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Amount</th>
              <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Balance</th>
              <th className="px-6 py-4 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {transactionsWithBalance.map((transaction) => {
              const isEditing = editingId === transaction.id;

              if (isEditing) {
                return (
                  <tr key={transaction.id} className="bg-blue-50 border-l-4 border-blue-400">
                    {/* Date (non-editable) */}
                    <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-500">
                      {new Date(transaction.date).toLocaleDateString()}
                    </td>

                    {/* Type dropdown */}
                    <td className="px-6 py-3 whitespace-nowrap">
                      <select
                        value={editState.type}
                        onChange={(e) => {
                          const newType = e.target.value as TransactionType;
                          const cats = newType === 'income'
                            ? appData.categories.income
                            : appData.categories.expense;
                          setEditState((prev) => ({
                            ...prev,
                            type: newType,
                            category: cats[0] ?? ''
                          }));
                        }}
                        className="text-sm border border-blue-300 rounded px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
                      >
                        <option value="income">income</option>
                        <option value="expense">expense</option>
                      </select>
                    </td>

                    {/* Category dropdown */}
                    <td className="px-6 py-3 whitespace-nowrap">
                      <select
                        value={editState.category}
                        onChange={(e) => setEditState((prev) => ({ ...prev, category: e.target.value }))}
                        className="text-sm border border-blue-300 rounded px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
                      >
                        {allCategories.map((cat) => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                    </td>

                    {/* Description input */}
                    <td className="px-6 py-3">
                      <input
                        type="text"
                        value={editState.description}
                        onChange={(e) => setEditState((prev) => ({ ...prev, description: e.target.value }))}
                        className="w-full text-sm border border-blue-300 rounded px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
                        placeholder="Description"
                      />
                    </td>

                    {/* Amount input */}
                    <td className="px-6 py-3 whitespace-nowrap">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={editState.amount}
                        onChange={(e) => setEditState((prev) => ({ ...prev, amount: e.target.value }))}
                        className="w-28 text-sm border border-blue-300 rounded px-2 py-1 bg-white text-right focus:outline-none focus:ring-2 focus:ring-blue-400"
                      />
                    </td>

                    {/* Balance (unchanged during edit) */}
                    <td className="px-6 py-3 whitespace-nowrap text-sm text-right text-gray-400">—</td>

                    {/* Save / Cancel */}
                    <td className="px-6 py-3 whitespace-nowrap text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => saveEdit(transaction)}
                          className="text-green-600 hover:text-green-800 transition-colors"
                          title="Save"
                        >
                          <Check size={18} />
                        </button>
                        <button
                          onClick={cancelEdit}
                          className="text-gray-500 hover:text-gray-700 transition-colors"
                          title="Cancel"
                        >
                          <X size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              }

              return (
                <tr key={transaction.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {new Date(transaction.date).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${
                        transaction.type === 'income'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {transaction.type === 'income' ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                      {transaction.type}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{transaction.category}</td>
                  <td className="px-6 py-4 text-sm text-gray-600" title={transaction.rawDescription}>{transaction.description || '-'}</td>
                  <td
                    className={`px-6 py-4 whitespace-nowrap text-sm text-right font-semibold ${
                      transaction.type === 'income' ? 'text-green-600' : 'text-red-600'
                    }`}
                  >
                    {transaction.type === 'income' ? '+' : '-'}
                    {formatCurrencySymbol(transaction.amount)}
                  </td>
                  <td
                    className={`px-6 py-4 whitespace-nowrap text-sm text-right font-bold ${
                      transaction.balance >= 0 ? 'text-gray-900' : 'text-red-600'
                    }`}
                  >
                    {formatCurrencySymbol(transaction.balance)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <div className="flex items-center justify-center gap-3">
                      <button
                        onClick={() => startEdit(transaction)}
                        className="text-blue-500 hover:text-blue-700 transition-colors"
                        title="Edit transaction"
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        onClick={() => onDelete(transaction.id)}
                        className="text-red-600 hover:text-red-800 transition-colors"
                        title="Delete transaction"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
