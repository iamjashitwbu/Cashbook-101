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
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Filter size={20} className="text-gray-600" />
          <h2 className="text-xl font-bold text-gray-800">Filters</h2>
          {hasActiveFilters && (
            <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-0.5 rounded-full">
              Active
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="text-sm text-red-600 hover:text-red-800 font-medium flex items-center gap-1"
            >
              <X size={16} />
              Clear
            </button>
          )}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-sm text-blue-600 hover:text-blue-800 font-medium"
          >
            {isExpanded ? 'Hide' : 'Show'}
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="space-y-4 border-t border-gray-200 pt-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  placeholder="End date"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Category
            </label>
            <select
              value={filters.category}
              onChange={(e) => handleCategoryChange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
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
