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
    <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-2xl font-bold text-gray-800 mb-6">Add Transaction</h2>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <button
          type="button"
          onClick={() => {
            setType('income');
            setCategory('');
          }}
          className={`py-3 px-4 rounded-lg font-semibold transition-all ${
            type === 'income'
              ? 'bg-green-500 text-white shadow-lg'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
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
              ? 'bg-red-500 text-white shadow-lg'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          Expense
        </button>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Date
          </label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            required
          />
        </div>

        {type === 'expense' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Expense Type
            </label>
            <select
              value={expenseCategory}
              onChange={(e) => setExpenseCategory(e.target.value as ExpenseCategory)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="cogs">Cost of Goods Sold (COGS)</option>
              <option value="operating">Operating Expense</option>
              <option value="other">Other Expense</option>
            </select>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Category
          </label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Amount
          </label>
          <input
            type="number"
            step="0.01"
            min="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Description
          </label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional notes"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <button
          type="submit"
          className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-semibold hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
        >
          <Plus size={20} />
          Add Transaction
        </button>
      </div>
    </form>
  );
};
