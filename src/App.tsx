import { useState, useEffect } from 'react';
import { Wallet, BarChart3, List, FileText, Plus, Upload, Download } from 'lucide-react';
import { Transaction, Filters as FiltersType, AppData, InvoiceData } from './types';
import { loadAppData, saveTransactionForEntity, addEntity, createEntity } from './utils/storage';
import { exportToExcel } from './utils/exportExcel';
import { TransactionForm } from './components/TransactionForm';
import { TransactionList } from './components/TransactionList';
import { Filters } from './components/Filters';
import { YearlyPLSummary } from './components/YearlyPLSummary';
import { EntityManager } from './components/EntityManager';
import { CategoryManager } from './components/CategoryManager';
import { BankStatementImport } from './components/BankStatementImport';
import { InvoiceParser } from './components/InvoiceParser';
import { formatCurrencySymbol } from './utils/format';
import { mapInvoiceToTransaction } from './utils/invoiceData';

type View = 'import' | 'transactions' | 'summary' | 'invoice-parser';

function App() {
  const [appData, setAppData] = useState<AppData>({
    entities: [],
    currentEntityId: '',
    transactions: {},
    categories: { income: [], expense: [] }
  });
  const [filters, setFilters] = useState<FiltersType>({
    dateRange: null,
    category: ''
  });
  const [view, setView] = useState<View>('transactions');
  const [showTransactionModal, setShowTransactionModal] = useState(false);

  useEffect(() => {
    const loaded = loadAppData();
    setAppData(loaded);

    if (loaded.entities.length === 0) {
      const defaultEntity = createEntity('Default Business', '');
      const updated = addEntity(loaded, defaultEntity);
      setAppData(updated);
    }
  }, []);

  const currentEntity = appData.entities.find((e) => e.id === appData.currentEntityId);
  const transactions = appData.transactions[appData.currentEntityId] || [];

  const saveTransactions = (nextTransactions: Transaction[]) => {
    const newAppData = saveTransactionForEntity(appData, appData.currentEntityId, nextTransactions);
    setAppData(newAppData);
  };

  const addTransactions = (newTransactions: Omit<Transaction, 'id'>[]) => {
    const existingKeys = new Set(
      transactions.map((tx) => `${tx.date}-${tx.amount}-${tx.description}`)
    );
    const importedTransactions: Transaction[] = newTransactions
      .filter((transaction) =>
        !existingKeys.has(
          `${transaction.date}-${transaction.amount}-${transaction.description}`
        )
      )
      .map((transaction) => ({
        ...transaction,
        id: crypto.randomUUID()
      }));
    const nextTransactions = [...transactions, ...importedTransactions];
    const skippedDuplicates = newTransactions.length - importedTransactions.length;

    saveTransactions(nextTransactions);

    if (newTransactions.every((transaction) => transaction.source === 'bank')) {
      console.log('Parsed Transactions:', newTransactions);
      console.log('Unique Transactions:', nextTransactions);
      console.log(
        `Bank import for entity ${appData.currentEntityId}: imported ${importedTransactions.length}, skipped ${skippedDuplicates} duplicates.`
      );
    }
  };

  const addTransaction = (transaction: Omit<Transaction, 'id'>) => {
    addTransactions([transaction]);
  };

  const editTransaction = (updated: Transaction) => {
    const nextTransactions = transactions.map((t) => (t.id === updated.id ? updated : t));
    saveTransactions(nextTransactions);
  };

  const deleteTransaction = (id: string) => {
    const updated = transactions.filter((t) => t.id !== id);
    saveTransactions(updated);
  };

  const addInvoiceToCashbook = (invoiceData: InvoiceData) => {
    const invoiceTransaction = mapInvoiceToTransaction(
      invoiceData,
      appData.categories,
      currentEntity
    );

    if (!invoiceTransaction) {
      return;
    }

    addTransaction(invoiceTransaction);
    setView('transactions');
  };

  const filteredTransactions = transactions.filter((transaction) => {
    if (filters.dateRange) {
      const transactionDate = new Date(transaction.date);
      const startDate = new Date(filters.dateRange.start);
      const endDate = new Date(filters.dateRange.end);
      if (transactionDate < startDate || transactionDate > endDate) {
        return false;
      }
    }

    if (filters.category && transaction.category !== filters.category) {
      return false;
    }

    return true;
  });

  const currentBalance = filteredTransactions.reduce((balance, transaction) => {
    return transaction.type === 'income'
      ? balance + transaction.amount
      : balance - transaction.amount;
  }, 0);

  return (
    <div className="min-h-screen bg-[#0f0f14] text-white flex">
      {/* Left Sidebar */}
      <div className="w-[220px] bg-[#1a1a24] border-r border-white/[0.06] flex flex-col min-h-screen fixed left-0 top-0">
        {/* Logo/Brand */}
        <div className="p-6 border-b border-white/[0.06]">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-[#7c6ff7] p-2">
              <Wallet size={24} className="text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">Cashbook</h1>
              <p className="text-xs text-[#9ca3af]">Track finances</p>
            </div>
          </div>
        </div>

        {/* Entity Manager */}
        <div className="p-4 border-b border-white/[0.06]">
          <EntityManager appData={appData} onAppDataChange={setAppData} />
        </div>

        {/* Category Manager */}
        <div className="p-4 border-b border-white/[0.06]">
          <CategoryManager appData={appData} onAppDataChange={setAppData} />
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-2">
          <button
            onClick={() => setView('import')}
            className={`w-full flex items-center gap-3 rounded-[10px] px-4 py-3 font-semibold transition-all text-left ${view === 'import'
                ? 'bg-[#7c6ff7] text-white'
                : 'text-[#9ca3af] hover:bg-white/[0.06] hover:text-white'
              }`}
          >
            <Upload size={20} />
            Import Statement
          </button>

          <button
            onClick={() => setView('transactions')}
            className={`w-full flex items-center gap-3 rounded-[10px] px-4 py-3 font-semibold transition-all text-left ${view === 'transactions'
                ? 'bg-[#7c6ff7] text-white'
                : 'text-[#9ca3af] hover:bg-white/[0.06] hover:text-white'
              }`}
          >
            <List size={20} />
            Transactions
          </button>

          <button
            onClick={() => setView('summary')}
            className={`w-full flex items-center gap-3 rounded-[10px] px-4 py-3 font-semibold transition-all text-left ${view === 'summary'
                ? 'bg-[#7c6ff7] text-white'
                : 'text-[#9ca3af] hover:bg-white/[0.06] hover:text-white'
              }`}
          >
            <BarChart3 size={20} />
            P&L Summary
          </button>

          <button
            onClick={() => setView('invoice-parser')}
            className={`w-full flex items-center gap-3 rounded-[10px] px-4 py-3 font-semibold transition-all text-left ${view === 'invoice-parser'
                ? 'bg-[#7c6ff7] text-white'
                : 'text-[#9ca3af] hover:bg-white/[0.06] hover:text-white'
              }`}
          >
            <FileText size={20} />
            Invoice Parser
          </button>

          {view !== 'invoice-parser' && (
            <button
              onClick={() => exportToExcel({ transactions: filteredTransactions })}
              disabled={filteredTransactions.length === 0}
              className="w-full flex items-center gap-3 rounded-[10px] px-4 py-3 font-semibold transition-all text-left bg-[#4ade80] text-black hover:bg-[#3ccb6a] disabled:cursor-not-allowed disabled:bg-white/[0.08] disabled:text-[#9ca3af]"
            >
              <Download size={20} />
              Export to Excel
            </button>
          )}
        </nav>
      </div>

      {/* Main Content */}
      <div className="flex-1 ml-[220px] min-h-screen">
        <div className="p-6">
          {/* Top Bar with Balance */}
          <div className="flex justify-end mb-6">
            <div className="text-right">
              <p className="text-sm font-semibold uppercase tracking-wide text-[#9ca3af]">Current Balance</p>
              <p
                className={`text-2xl font-bold ${currentBalance >= 0 ? 'text-[#4ade80]' : 'text-[#f87171]'}`}
              >
                {formatCurrencySymbol(currentBalance)}
              </p>
            </div>
          </div>

          {/* Page Content */}
          <div className="space-y-6">
            {view === 'import' ? (
              <div className="max-w-2xl mx-auto">
                <BankStatementImport
                  appData={appData}
                  onImport={addTransactions}
                  disabled={!appData.currentEntityId}
                />
              </div>
            ) : view === 'transactions' ? (
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <h2 className="text-2xl font-bold text-white">Transactions</h2>
                  <button
                    onClick={() => setShowTransactionModal(true)}
                    className="flex items-center gap-2 rounded-[10px] bg-[#7c6ff7] px-6 py-3 font-semibold text-white transition-colors hover:bg-[#6d5ff0]"
                  >
                    <Plus size={20} />
                    Add Transaction
                  </button>
                </div>

                <Filters
                  filters={filters}
                  onFiltersChange={setFilters}
                  transactions={transactions}
                  appData={appData}
                />

                <TransactionList
                  transactions={filteredTransactions}
                  appData={appData}
                  onDelete={deleteTransaction}
                  onEdit={editTransaction}
                />
              </div>
            ) : view === 'invoice-parser' ? (
              <InvoiceParser
                appData={appData}
                currentEntity={currentEntity}
                onAddToCashbook={addInvoiceToCashbook}
              />
            ) : (
              <YearlyPLSummary transactions={transactions} entity={currentEntity} />
            )}
          </div>
        </div>
      </div>

      {/* Transaction Modal */}
      {showTransactionModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[#1a1a24] rounded-2xl border border-white/[0.06] p-6 max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-white">Add Transaction</h3>
              <button
                onClick={() => setShowTransactionModal(false)}
                className="text-[#9ca3af] hover:text-white transition-colors"
              >
                ✕
              </button>
            </div>
            <TransactionForm
              onAdd={(transaction) => {
                addTransaction(transaction);
                setShowTransactionModal(false);
              }}
              appData={appData}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
