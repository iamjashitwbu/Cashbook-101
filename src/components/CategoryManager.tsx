import { useState } from 'react';
import { Plus, Trash2, Settings } from 'lucide-react';
import { AppData } from '../types';
import { updateCategories } from '../utils/storage';

interface CategoryManagerProps {
  appData: AppData;
  onAppDataChange: (data: AppData) => void;
}

export const CategoryManager = ({ appData, onAppDataChange }: CategoryManagerProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [incomeCategories, setIncomeCategories] = useState(appData.categories.income);
  const [expenseCategories, setExpenseCategories] = useState(appData.categories.expense);
  const [newIncomeCategory, setNewIncomeCategory] = useState('');
  const [newExpenseCategory, setNewExpenseCategory] = useState('');

  const handleAddIncomeCategory = () => {
    if (newIncomeCategory.trim() && !incomeCategories.includes(newIncomeCategory)) {
      setIncomeCategories([...incomeCategories, newIncomeCategory]);
      setNewIncomeCategory('');
    }
  };

  const handleAddExpenseCategory = () => {
    if (newExpenseCategory.trim() && !expenseCategories.includes(newExpenseCategory)) {
      setExpenseCategories([...expenseCategories, newExpenseCategory]);
      setNewExpenseCategory('');
    }
  };

  const handleRemoveIncomeCategory = (cat: string) => {
    setIncomeCategories(incomeCategories.filter((c) => c !== cat));
  };

  const handleRemoveExpenseCategory = (cat: string) => {
    setExpenseCategories(expenseCategories.filter((c) => c !== cat));
  };

  const handleSave = () => {
    const updated = updateCategories(appData, incomeCategories, expenseCategories);
    onAppDataChange(updated);
    setIsOpen(false);
  };

  const handleCancel = () => {
    setIncomeCategories(appData.categories.income);
    setExpenseCategories(appData.categories.expense);
    setIsOpen(false);
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
      >
        <Settings size={20} />
        Manage Categories
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-lg max-w-2xl w-full max-h-96 overflow-y-auto">
            <div className="sticky top-0 bg-gray-50 border-b border-gray-200 px-6 py-4">
              <h2 className="text-xl font-bold text-gray-800">Manage Categories</h2>
            </div>

            <div className="p-6 space-y-6">
              <div>
                <h3 className="font-semibold text-gray-700 mb-3">Income Categories</h3>
                <div className="space-y-2 mb-4">
                  {incomeCategories.map((cat) => (
                    <div
                      key={cat}
                      className="flex items-center justify-between p-2 bg-gray-50 rounded"
                    >
                      <span className="text-gray-700">{cat}</span>
                      <button
                        onClick={() => handleRemoveIncomeCategory(cat)}
                        className="text-red-600 hover:text-red-800"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newIncomeCategory}
                    onChange={(e) => setNewIncomeCategory(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleAddIncomeCategory()}
                    placeholder="New income category"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  />
                  <button
                    onClick={handleAddIncomeCategory}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors flex items-center gap-1"
                  >
                    <Plus size={16} />
                    Add
                  </button>
                </div>
              </div>

              <div className="border-t pt-6">
                <h3 className="font-semibold text-gray-700 mb-3">Expense Categories</h3>
                <div className="space-y-2 mb-4">
                  {expenseCategories.map((cat) => (
                    <div
                      key={cat}
                      className="flex items-center justify-between p-2 bg-gray-50 rounded"
                    >
                      <span className="text-gray-700">{cat}</span>
                      <button
                        onClick={() => handleRemoveExpenseCategory(cat)}
                        className="text-red-600 hover:text-red-800"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newExpenseCategory}
                    onChange={(e) => setNewExpenseCategory(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleAddExpenseCategory()}
                    placeholder="New expense category"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  />
                  <button
                    onClick={handleAddExpenseCategory}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors flex items-center gap-1"
                  >
                    <Plus size={16} />
                    Add
                  </button>
                </div>
              </div>
            </div>

            <div className="bg-gray-50 border-t border-gray-200 px-6 py-4 flex justify-end gap-3">
              <button
                onClick={handleCancel}
                className="px-6 py-2 bg-gray-200 text-gray-700 rounded font-medium hover:bg-gray-300 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="px-6 py-2 bg-blue-600 text-white rounded font-medium hover:bg-blue-700 transition-colors"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
