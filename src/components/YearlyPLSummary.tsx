import { useMemo, useState } from 'react';
import { BarChart3 } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import { Transaction, Entity } from '../types';
import { formatCurrencySymbol } from '../utils/format';

interface YearlyPLSummaryProps {
  transactions: Transaction[];
  entity: Entity | undefined;
}

interface MonthlyChartRow {
  month: string;
  income: number;
  expense: number;
}

interface ExpenseCategoryRow {
  name: string;
  value: number;
}

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const CARD_CLASS = 'rounded-2xl border border-white/[0.06] bg-[#1a1a24] p-6';
const CATEGORY_COLORS = ['#f87171', '#fb923c', '#facc15', '#38bdf8', '#a78bfa', '#f472b6', '#94a3b8'];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div style={{ background: '#1a1a24', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12, padding: '10px 14px' }}>
        <p style={{ color: '#9ca3af', marginBottom: 6, fontSize: '14px' }}>{label}</p>
        {payload.map((entry: any) => (
          <p key={entry.dataKey} style={{ color: entry.color, margin: '2px 0', fontSize: '14px' }}>
            {entry.name} : {formatCurrencySymbol(Number(entry.value))}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export const YearlyPLSummary = ({ transactions, entity }: YearlyPLSummaryProps) => {
  const availableYears = useMemo(() => {
    const years = Array.from(
      new Set(
        transactions
          .map((transaction) => new Date(transaction.date).getFullYear())
          .filter((year) => Number.isFinite(year))
      )
    ).sort((a, b) => b - a);

    return years.length > 0 ? years : [new Date().getFullYear()];
  }, [transactions]);

  const [selectedYear, setSelectedYear] = useState(availableYears[0]);
  const activeYear = availableYears.includes(selectedYear) ? selectedYear : availableYears[0];

  const yearlyTransactions = useMemo(
    () =>
      transactions.filter(
        (transaction) => new Date(transaction.date).getFullYear() === activeYear
      ),
    [transactions, activeYear]
  );

  const annualIncome = yearlyTransactions
    .filter((transaction) => transaction.type === 'income')
    .reduce((sum, transaction) => sum + transaction.amount, 0);
  const annualExpense = yearlyTransactions
    .filter((transaction) => transaction.type === 'expense')
    .reduce((sum, transaction) => sum + transaction.amount, 0);
  const netProfit = annualIncome - annualExpense;

  const monthlyChartData = useMemo<MonthlyChartRow[]>(() => {
    const monthRows = MONTH_LABELS.map((month) => ({
      month,
      income: 0,
      expense: 0
    }));

    yearlyTransactions.forEach((transaction) => {
      const monthIndex = new Date(transaction.date).getMonth();

      if (monthIndex < 0 || monthIndex > 11) {
        return;
      }

      monthRows[monthIndex][transaction.type] += transaction.amount;
    });

    return monthRows;
  }, [yearlyTransactions]);

  const expenseCategoryData = useMemo<ExpenseCategoryRow[]>(() => {
    const totals = new Map<string, number>();

    yearlyTransactions
      .filter((transaction) => transaction.type === 'expense')
      .forEach((transaction) => {
        const category = transaction.category || 'Uncategorized';
        totals.set(category, (totals.get(category) ?? 0) + transaction.amount);
      });

    const rows = Array.from(totals.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    return rows.length > 0 ? rows : [{ name: 'No expenses', value: 1 }];
  }, [yearlyTransactions]);

  if (transactions.length === 0) {
    return (
      <div className={CARD_CLASS}>
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <BarChart3 size={48} className="mb-4 text-[#7c6ff7]" />
          <h2 className="text-2xl font-bold text-white">P&L Summary</h2>
          <p className="mt-2 text-sm text-[#9ca3af]">No transactions available for this entity yet.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 text-white">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-[#9ca3af]">
            {entity?.name || 'Company'}
          </p>
          <h2 className="mt-1 text-2xl font-bold text-white">Annual P&L</h2>
        </div>

        <label className="flex flex-col gap-2 text-sm font-semibold uppercase tracking-wide text-[#9ca3af]">
          Year
          <select
            value={activeYear}
            onChange={(event) => setSelectedYear(Number(event.target.value))}
            className="rounded-xl border border-white/[0.12] bg-[#1a1a24] px-4 py-2 text-sm font-semibold normal-case tracking-normal text-white outline-none focus:border-[#7c6ff7] focus:ring-2 focus:ring-[#7c6ff7]/30"
          >
            {availableYears.map((year) => (
              <option key={year} value={year} className="bg-[#1a1a24] text-white">
                {year}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatCard label="Annual Income" amount={annualIncome} colorClass="text-[#4ade80]" />
        <StatCard label="Annual Expense" amount={annualExpense} colorClass="text-[#f87171]" />
        <StatCard
          label="Net P&L"
          amount={netProfit}
          colorClass={netProfit >= 0 ? 'text-[#4ade80]' : 'text-[#f87171]'}
          accent
        />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(340px,0.85fr)]">
        <section className={CARD_CLASS}>
          <div className="mb-5">
            <p className="text-sm font-semibold uppercase tracking-wide text-[#9ca3af]">
              Monthly movement
            </p>
            <h3 className="mt-1 text-xl font-bold text-white">Income vs Expense</h3>
          </div>

          <div className="h-[360px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyChartData} margin={{ top: 12, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                <XAxis
                  dataKey="month"
                  tick={{ fill: '#9ca3af', fontSize: 12 }}
                  axisLine={{ stroke: 'rgba(255,255,255,0.12)' }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: '#9ca3af', fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(value) => formatCurrencySymbol(Number(value))}
                  width={88}
                />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                <Legend wrapperStyle={{ color: '#9ca3af', paddingTop: 12 }} />
                <Bar dataKey="income" name="Income" fill="#4ade80" radius={[8, 8, 0, 0]} />
                <Bar dataKey="expense" name="Expense" fill="#f87171" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className={CARD_CLASS}>
          <div className="mb-5">
            <p className="text-sm font-semibold uppercase tracking-wide text-[#9ca3af]">
              Expense mix
            </p>
            <h3 className="mt-1 text-xl font-bold text-white">Category Breakdown</h3>
          </div>

          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={expenseCategoryData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius="58%"
                  outerRadius="82%"
                  paddingAngle={2}
                  stroke="none"
                >
                  {expenseCategoryData.map((entry, index) => (
                    <Cell
                      key={entry.name}
                      fill={entry.name === 'No expenses' ? '#334155' : CATEGORY_COLORS[index % CATEGORY_COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: '#1a1a24',
                    border: '1px solid rgba(255,255,255,0.12)',
                    borderRadius: 12,
                    color: '#ffffff'
                  }}
                  formatter={(value, name) => [
                    String(name) === 'No expenses' ? '-' : formatCurrencySymbol(toNumber(value)),
                    String(name)
                  ]}
                  labelStyle={{ color: '#ffffff' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-4 space-y-3">
            {expenseCategoryData.map((entry, index) => (
              <div key={entry.name} className="flex items-center justify-between gap-3 text-sm">
                <div className="flex min-w-0 items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{
                      backgroundColor:
                        entry.name === 'No expenses'
                          ? '#334155'
                          : CATEGORY_COLORS[index % CATEGORY_COLORS.length]
                    }}
                  />
                  <span className="truncate text-[#9ca3af]">{entry.name}</span>
                </div>
                <span className="font-semibold text-white">
                  {entry.name === 'No expenses' ? '-' : formatCurrencySymbol(entry.value)}
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};

const StatCard = ({
  label,
  amount,
  colorClass,
  accent = false
}: {
  label: string;
  amount: number;
  colorClass: string;
  accent?: boolean;
}) => (
  <div
    className={`rounded-2xl border p-6 ${accent
        ? 'border-[#7c6ff7]/40 bg-[#1a1a24]'
        : 'border-white/[0.06] bg-[#1a1a24]'
      }`}
  >
    <p className="text-sm font-semibold uppercase tracking-wide text-[#9ca3af]">{label}</p>
    <p className={`mt-3 text-3xl font-bold ${colorClass}`}>{formatCurrencySymbol(amount)}</p>
  </div>
);

const toNumber = (value: unknown) => {
  if (typeof value === 'number') {
    return value;
  }

  const parsedValue = Number(value);
  return Number.isFinite(parsedValue) ? parsedValue : 0;
};
