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
      <div className="rounded-2xl border border-white/[0.06] bg-[#1a1a24] p-12 text-center">
        <p className="text-lg text-[#9ca3af]">No transactions yet. Add your first entry above!</p>
      </div>
    );
  }

  return (
    <>
      {/* Desktop Table View */}
      <div className="hidden md:block overflow-hidden rounded-2xl border border-white/[0.06] bg-[#1a1a24]">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-white/[0.06] bg-transparent">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-[#9ca3af]">Date</th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-[#9ca3af]">Type</th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-[#9ca3af]">Category</th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-[#9ca3af]">Description</th>
                <th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-wider text-[#9ca3af]">Amount</th>
                <th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-wider text-[#9ca3af]">Balance</th>
                <th className="px-6 py-4 text-center text-xs font-semibold uppercase tracking-wider text-[#9ca3af]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.06]">
              {transactionsWithBalance.map((transaction) => {
                const isEditing = editingId === transaction.id;

                if (isEditing) {
                  return (
                    <tr key={transaction.id} className="border-l-4 border-[#7c6ff7] bg-white/[0.04]">
                      {/* Date (non-editable) */}
                      <td className="px-6 py-3 whitespace-nowrap text-sm text-[#9ca3af]">
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
                          className="rounded border border-white/[0.12] bg-[#0f0f14] px-2 py-1 text-sm text-white outline-none focus:ring-2 focus:ring-[#7c6ff7]/30"
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
                          className="rounded border border-white/[0.12] bg-[#0f0f14] px-2 py-1 text-sm text-white outline-none focus:ring-2 focus:ring-[#7c6ff7]/30"
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
                          className="w-full rounded border border-white/[0.12] bg-[#0f0f14] px-2 py-1 text-sm text-white outline-none placeholder:text-[#9ca3af] focus:ring-2 focus:ring-[#7c6ff7]/30"
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
                          className="w-28 rounded border border-white/[0.12] bg-[#0f0f14] px-2 py-1 text-right text-sm text-white outline-none focus:ring-2 focus:ring-[#7c6ff7]/30"
                        />
                      </td>

                      {/* Balance (unchanged during edit) */}
                      <td className="px-6 py-3 whitespace-nowrap text-right text-sm text-[#9ca3af]">-</td>

                      {/* Save / Cancel */}
                      <td className="px-6 py-3 whitespace-nowrap text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => saveEdit(transaction)}
                            className="text-[#4ade80] transition-colors hover:text-green-300"
                            title="Save"
                          >
                            <Check size={18} />
                          </button>
                          <button
                            onClick={cancelEdit}
                            className="text-[#9ca3af] transition-colors hover:text-white"
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
                  <tr key={transaction.id} className="bg-transparent transition-colors hover:bg-white/[0.04]">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-white">
                      {new Date(transaction.date).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${transaction.type === 'income'
                            ? 'bg-[#4ade80]/15 text-[#4ade80]'
                            : 'bg-[#f87171]/15 text-[#f87171]'
                          }`}
                      >
                        {transaction.type === 'income' ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                        {transaction.type}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-white">{transaction.category}</td>
                    <td className="px-6 py-4 text-sm text-[#9ca3af]" title={transaction.rawDescription}>{transaction.description || '-'}</td>
                    <td
                      className={`px-6 py-4 whitespace-nowrap text-sm text-right font-semibold ${transaction.type === 'income' ? 'text-[#4ade80]' : 'text-[#f87171]'
                        }`}
                    >
                      {transaction.type === 'income' ? '+' : '-'}
                      {formatCurrencySymbol(transaction.amount)}
                    </td>
                    <td
                      className={`px-6 py-4 whitespace-nowrap text-sm text-right font-bold ${transaction.balance >= 0 ? 'text-white' : 'text-[#f87171]'
                        }`}
                    >
                      {formatCurrencySymbol(transaction.balance)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <div className="flex items-center justify-center gap-3">
                        <button
                          onClick={() => startEdit(transaction)}
                          className="text-[#7c6ff7] transition-colors hover:text-[#a78bfa]"
                          title="Edit transaction"
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          onClick={() => onDelete(transaction.id)}
                          className="text-[#f87171] transition-colors hover:text-red-300"
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

      {/* Mobile Card View */}
      <div className="md:hidden space-y-2">
        {transactionsWithBalance.map((transaction) => {
          const isEditing = editingId === transaction.id;

          if (isEditing) {
            return (
              <div
                key={transaction.id}
                className="rounded-[12px] border border-[#7c6ff7] bg-white/[0.04] p-4 space-y-3"
              >
                {/* Date */}
                <div className="text-sm text-[#9ca3af]">
                  {new Date(transaction.date).toLocaleDateString()}
                </div>

                {/* Type dropdown */}
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
                  className="w-full rounded border border-white/[0.12] bg-[#0f0f14] px-2 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-[#7c6ff7]/30"
                >
                  <option value="income">Income</option>
                  <option value="expense">Expense</option>
                </select>

                {/* Category dropdown */}
                <select
                  value={editState.category}
                  onChange={(e) => setEditState((prev) => ({ ...prev, category: e.target.value }))}
                  className="w-full rounded border border-white/[0.12] bg-[#0f0f14] px-2 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-[#7c6ff7]/30"
                >
                  {allCategories.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>

                {/* Description input */}
                <input
                  type="text"
                  value={editState.description}
                  onChange={(e) => setEditState((prev) => ({ ...prev, description: e.target.value }))}
                  className="w-full rounded border border-white/[0.12] bg-[#0f0f14] px-2 py-2 text-sm text-white outline-none placeholder:text-[#9ca3af] focus:ring-2 focus:ring-[#7c6ff7]/30"
                  placeholder="Description"
                />

                {/* Amount input */}
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={editState.amount}
                  onChange={(e) => setEditState((prev) => ({ ...prev, amount: e.target.value }))}
                  className="w-full rounded border border-white/[0.12] bg-[#0f0f14] px-2 py-2 text-right text-sm text-white outline-none focus:ring-2 focus:ring-[#7c6ff7]/30"
                />

                {/* Save / Cancel */}
                <div className="flex items-center justify-center gap-2 pt-2">
                  <button
                    onClick={() => saveEdit(transaction)}
                    className="text-[#4ade80] transition-colors hover:text-green-300"
                    title="Save"
                  >
                    <Check size={20} />
                  </button>
                  <button
                    onClick={cancelEdit}
                    className="text-[#9ca3af] transition-colors hover:text-white"
                    title="Cancel"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>
            );
          }

          return (
            <div
              key={transaction.id}
              className="rounded-[12px] border border-white/[0.06] bg-[#1a1a24] p-4"
            >
              <div className="grid grid-cols-2 gap-4">
                {/* Left Column */}
                <div>
                  <p className="text-[14px] text-[#9ca3af]">
                    {new Date(transaction.date).toLocaleDateString()}
                  </p>
                  <p className="text-[14px] font-bold text-white truncate" title={transaction.rawDescription}>
                    {transaction.description || '-'}
                  </p>
                  <p className="text-[12px] text-[#9ca3af]">{transaction.category}</p>
                </div>

                {/* Right Column */}
                <div className="text-right">
                  <p
                    className={`text-[16px] font-semibold ${transaction.type === 'income' ? 'text-[#4ade80]' : 'text-[#f87171]'
                      }`}
                  >
                    {transaction.type === 'income' ? '+' : '-'}
                    {formatCurrencySymbol(transaction.amount)}
                  </p>
                  <p
                    className={`text-[12px] ${transaction.balance >= 0 ? 'text-white' : 'text-[#f87171]'
                      }`}
                  >
                    {formatCurrencySymbol(transaction.balance)}
                  </p>
                  <div className="flex items-center justify-end gap-2 mt-2">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${transaction.type === 'income'
                          ? 'bg-[#4ade80]/15 text-[#4ade80]'
                          : 'bg-[#f87171]/15 text-[#f87171]'
                        }`}
                    >
                      {transaction.type === 'income' ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                      {transaction.type === 'income' ? 'In' : 'Out'}
                    </span>
                    <button
                      onClick={() => startEdit(transaction)}
                      className="text-[#7c6ff7] transition-colors hover:text-[#a78bfa]"
                      title="Edit transaction"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => onDelete(transaction.id)}
                      className="text-[#f87171] transition-colors hover:text-red-300"
                      title="Delete transaction"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
};
