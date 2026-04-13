import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Transaction, TransactionType, ExpenseCategory, AppData } from '../types';

interface TransactionFormProps {
  onAdd: (transaction: Omit<Transaction, 'id'>) => void;
  appData: AppData;
}

export const TransactionForm = ({ onAdd, appData }: TransactionFormProps) => {
  const [type, setType] = useState<TransactionType>('expense');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [category, setCategory] = useState('');
  const [expenseCategory, setExpenseCategory] = useState<ExpenseCategory>('operating');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');

  const categories = type === 'income' ? appData.categories.income : appData.categories.expense;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!category || !amount || parseFloat(amount) <= 0) {
      return;
    }

    const transaction: Omit<Transaction, 'id'> = {
      type,
      date,
      category,
      amount: parseFloat(amount),
      description,
      source: 'manual'
    };

    if (type === 'expense') {
      transaction.expenseCategory = expenseCategory;
    }

    onAdd(transaction);

    setCategory('');
    setAmount('');
    setDescription('');
    setExpenseCategory('operating');
  };

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl border border-white/[0.06] bg-[#1a1a24] p-6">
      <h2 className="mb-6 text-2xl font-bold text-white">Add Transaction</h2>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <button
          type="button"
          onClick={() => {
            setType('income');
            setCategory('');
          }}
          className={`py-3 px-4 rounded-lg font-semibold transition-all ${
            type === 'income'
              ? 'bg-[#4ade80] text-[#0f0f14]'
              : 'border border-white/[0.12] bg-transparent text-[#9ca3af] hover:text-white'
          }`}
        >
          Income
        </button>
        <button
          type="button"
          onClick={() => {
            setType('expense');
            setCategory('');
          }}
          className={`py-3 px-4 rounded-lg font-semibold transition-all ${
            type === 'expense'
              ? 'bg-[#f87171] text-[#0f0f14]'
              : 'border border-white/[0.12] bg-transparent text-[#9ca3af] hover:text-white'
          }`}
        >
          Expense
        </button>
      </div>

      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-semibold uppercase tracking-wide text-[#9ca3af]">
            Date
          </label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full rounded-xl border border-white/[0.12] bg-[#0f0f14] px-4 py-2 text-sm text-white outline-none focus:border-[#7c6ff7] focus:ring-2 focus:ring-[#7c6ff7]/30"
            required
          />
        </div>

        {type === 'expense' && (
          <div>
            <label className="mb-1 block text-sm font-semibold uppercase tracking-wide text-[#9ca3af]">
              Expense Type
            </label>
            <select
              value={expenseCategory}
              onChange={(e) => setExpenseCategory(e.target.value as ExpenseCategory)}
              className="w-full rounded-xl border border-white/[0.12] bg-[#0f0f14] px-4 py-2 text-sm text-white outline-none focus:border-[#7c6ff7] focus:ring-2 focus:ring-[#7c6ff7]/30"
            >
              <option value="cogs">Cost of Goods Sold (COGS)</option>
              <option value="operating">Operating Expense</option>
              <option value="other">Other Expense</option>
            </select>
          </div>
        )}

        <div>
          <label className="mb-1 block text-sm font-semibold uppercase tracking-wide text-[#9ca3af]">
            Category
          </label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full rounded-xl border border-white/[0.12] bg-[#0f0f14] px-4 py-2 text-sm text-white outline-none focus:border-[#7c6ff7] focus:ring-2 focus:ring-[#7c6ff7]/30"
            required
          >
            <option value="">Select a category</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm font-semibold uppercase tracking-wide text-[#9ca3af]">
            Amount
          </label>
          <input
            type="number"
            step="0.01"
            min="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            className="w-full rounded-xl border border-white/[0.12] bg-[#0f0f14] px-4 py-2 text-sm text-white outline-none focus:border-[#7c6ff7] focus:ring-2 focus:ring-[#7c6ff7]/30"
            required
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-semibold uppercase tracking-wide text-[#9ca3af]">
            Description
          </label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional notes"
            className="w-full rounded-xl border border-white/[0.12] bg-[#0f0f14] px-4 py-2 text-sm text-white outline-none placeholder:text-[#9ca3af] focus:border-[#7c6ff7] focus:ring-2 focus:ring-[#7c6ff7]/30"
          />
        </div>

        <button
          type="submit"
          className="flex w-full items-center justify-center gap-2 rounded-[10px] bg-[#7c6ff7] px-4 py-3 font-semibold text-white transition-colors hover:bg-[#6d5ff0]"
        >
          <Plus size={20} />
          Add Transaction
        </button>
      </div>
    </form>
  );
};
