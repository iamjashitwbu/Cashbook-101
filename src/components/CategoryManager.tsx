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
        className="flex items-center gap-2 rounded-[10px] border border-white/[0.12] bg-transparent px-4 py-2 text-white transition-colors hover:bg-white/[0.04]"
      >
        <Settings size={20} />
        Manage Categories
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="max-h-96 w-full max-w-2xl overflow-y-auto rounded-2xl border border-white/[0.06] bg-[#1a1a24]">
            <div className="sticky top-0 border-b border-white/[0.06] bg-[#1a1a24] px-6 py-4">
              <h2 className="text-2xl font-bold text-white">Manage Categories</h2>
            </div>

            <div className="p-6 space-y-6">
              <div>
                <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[#9ca3af]">Income Categories</h3>
                <div className="space-y-2 mb-4">
                  {incomeCategories.map((cat) => (
                    <div
                      key={cat}
                      className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-[#0f0f14] p-2"
                    >
                      <span className="text-white">{cat}</span>
                      <button
                        onClick={() => handleRemoveIncomeCategory(cat)}
                        className="text-[#f87171] hover:text-red-300"
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
                    className="flex-1 rounded-xl border border-white/[0.12] bg-[#0f0f14] px-3 py-2 text-sm text-white outline-none placeholder:text-[#9ca3af] focus:ring-2 focus:ring-[#7c6ff7]/30"
                  />
                  <button
                    onClick={handleAddIncomeCategory}
                    className="flex items-center gap-1 rounded-[10px] bg-[#7c6ff7] px-4 py-2 text-white transition-colors hover:bg-[#6d5ff0]"
                  >
                    <Plus size={16} />
                    Add
                  </button>
                </div>
              </div>

              <div className="border-t border-white/[0.06] pt-6">
                <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[#9ca3af]">Expense Categories</h3>
                <div className="space-y-2 mb-4">
                  {expenseCategories.map((cat) => (
                    <div
                      key={cat}
                      className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-[#0f0f14] p-2"
                    >
                      <span className="text-white">{cat}</span>
                      <button
                        onClick={() => handleRemoveExpenseCategory(cat)}
                        className="text-[#f87171] hover:text-red-300"
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
                    className="flex-1 rounded-xl border border-white/[0.12] bg-[#0f0f14] px-3 py-2 text-sm text-white outline-none placeholder:text-[#9ca3af] focus:ring-2 focus:ring-[#7c6ff7]/30"
                  />
                  <button
                    onClick={handleAddExpenseCategory}
                    className="flex items-center gap-1 rounded-[10px] bg-[#7c6ff7] px-4 py-2 text-white transition-colors hover:bg-[#6d5ff0]"
                  >
                    <Plus size={16} />
                    Add
                  </button>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t border-white/[0.06] bg-[#0f0f14] px-6 py-4">
              <button
                onClick={handleCancel}
                className="rounded-[10px] border border-white/[0.12] bg-transparent px-6 py-2 font-medium text-white transition-colors hover:bg-white/[0.04]"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="rounded-[10px] bg-[#7c6ff7] px-6 py-2 font-medium text-white transition-colors hover:bg-[#6d5ff0]"
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
