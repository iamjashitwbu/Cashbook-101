import { useState } from 'react';
import { Filter, X } from 'lucide-react';
import { Filters as FiltersType, Transaction, AppData } from '../types';

interface FiltersProps {
  filters: FiltersType;
  onFiltersChange: (filters: FiltersType) => void;
  transactions: Transaction[];
  appData: AppData;
}

export const Filters = ({ filters, onFiltersChange, transactions, appData }: FiltersProps) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const allCategories = [...appData.categories.income, ...appData.categories.expense].sort();
  const usedCategories = [...new Set(transactions.map((t) => t.category))].sort();

  const handleDateRangeChange = (start: string, end: string) => {
    if (start && end) {
      onFiltersChange({
        ...filters,
        dateRange: { start, end }
      });
    } else {
      onFiltersChange({
        ...filters,
        dateRange: null
      });
    }
  };

  const handleCategoryChange = (category: string) => {
    onFiltersChange({
      ...filters,
      category
    });
  };

  const clearFilters = () => {
    onFiltersChange({
      dateRange: null,
      category: ''
    });
  };

  const hasActiveFilters = filters.dateRange !== null || filters.category !== '';

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-[#1a1a24] p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Filter size={20} className="text-[#9ca3af]" />
          <h2 className="text-2xl font-bold text-white">Filters</h2>
          {hasActiveFilters && (
            <span className="rounded-full bg-[#7c6ff7]/20 px-2.5 py-0.5 text-xs font-medium text-[#7c6ff7]">
              Active
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1 text-sm font-medium text-[#f87171] hover:text-red-300"
            >
              <X size={16} />
              Clear
            </button>
          )}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-sm font-medium text-[#7c6ff7] hover:text-[#a78bfa]"
          >
            {isExpanded ? 'Hide' : 'Show'}
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="space-y-4 border-t border-white/[0.06] pt-4">
          <div>
            <label className="mb-2 block text-sm font-semibold uppercase tracking-wide text-[#9ca3af]">
              Date Range
            </label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <input
                  type="date"
                  value={filters.dateRange?.start || ''}
                  onChange={(e) =>
                    handleDateRangeChange(e.target.value, filters.dateRange?.end || '')
                  }
                  className="w-full rounded-xl border border-white/[0.12] bg-[#0f0f14] px-3 py-2 text-sm text-white outline-none focus:border-[#7c6ff7] focus:ring-2 focus:ring-[#7c6ff7]/30"
                  placeholder="Start date"
                />
              </div>
              <div>
                <input
                  type="date"
                  value={filters.dateRange?.end || ''}
                  onChange={(e) =>
                    handleDateRangeChange(filters.dateRange?.start || '', e.target.value)
                  }
                  className="w-full rounded-xl border border-white/[0.12] bg-[#0f0f14] px-3 py-2 text-sm text-white outline-none focus:border-[#7c6ff7] focus:ring-2 focus:ring-[#7c6ff7]/30"
                  placeholder="End date"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold uppercase tracking-wide text-[#9ca3af]">
              Category
            </label>
            <select
              value={filters.category}
              onChange={(e) => handleCategoryChange(e.target.value)}
              className="w-full rounded-xl border border-white/[0.12] bg-[#0f0f14] px-3 py-2 text-sm text-white outline-none focus:border-[#7c6ff7] focus:ring-2 focus:ring-[#7c6ff7]/30"
            >
              <option value="">All Categories</option>
              <optgroup label="Used Categories">
                {usedCategories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </optgroup>
              <optgroup label="All Categories">
                {allCategories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </optgroup>
            </select>
          </div>
        </div>
      )}
    </div>
  );
};
