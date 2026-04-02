import { useState, useEffect } from 'react';
import { Wallet, BarChart3, List, FileText } from 'lucide-react';
import { Transaction, Filters as FiltersType, AppData, InvoiceData } from './types';
import { loadAppData, saveTransactionForEntity, addEntity, createEntity } from './utils/storage';
import { exportToExcel } from './utils/exportExcel';
import { TransactionForm } from './components/TransactionForm';
import { TransactionList } from './components/TransactionList';
import { Filters } from './components/Filters';
import { PLSummary } from './components/PLSummary';
import { EntityManager } from './components/EntityManager';
import { CategoryManager } from './components/CategoryManager';
import { BankStatementImport } from './components/BankStatementImport';
import { InvoiceParser } from './components/InvoiceParser';
import { formatCurrencySymbol } from './utils/format';
import { mapInvoiceToTransaction } from './utils/invoiceData';
import { buildTransactionDuplicateKey } from './utils/bankStatementImport';

type View = 'transactions' | 'summary' | 'invoice-parser';

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
    const existingKeys = new Set(transactions.map((transaction) => buildTransactionDuplicateKey(transaction)));
    const seenKeys = new Set<string>();
    const deduplicatedTransactions = newTransactions.filter((transaction) => {
      const duplicateKey = buildTransactionDuplicateKey(transaction);

      if (existingKeys.has(duplicateKey) || seenKeys.has(duplicateKey)) {
        return false;
      }

      seenKeys.add(duplicateKey);
      return true;
    });
    const skippedDuplicates = newTransactions.length - deduplicatedTransactions.length;
    const importedTransactions: Transaction[] = deduplicatedTransactions.map((transaction) => ({
      ...transaction,
      id: crypto.randomUUID()
    }));

    saveTransactions([...transactions, ...importedTransactions]);

    if (newTransactions.every((transaction) => transaction.source === 'bank')) {
      console.log(
        `Bank import for entity ${appData.currentEntityId}: imported ${importedTransactions.length}, skipped ${skippedDuplicates} duplicates.`
      );
    }
  };

  const addTransaction = (transaction: Omit<Transaction, 'id'>) => {
    addTransactions([transaction]);
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
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <header className="mb-8">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="bg-blue-600 p-3 rounded-lg shadow-lg">
                <Wallet size={32} className="text-white" />
              </div>
              <div>
                <h1 className="text-4xl font-bold text-gray-800">Cashbook</h1>
                <p className="text-gray-600 mt-1">Track your income and expenses</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-600 font-medium">Current Balance</p>
              <p
                className={`text-3xl font-bold ${
                  currentBalance >= 0 ? 'text-green-600' : 'text-red-600'
                }`}
              >
                {formatCurrencySymbol(currentBalance)}
              </p>
            </div>
          </div>
        </header>

        <div className="flex flex-wrap gap-3 mb-6">
          <EntityManager appData={appData} onAppDataChange={setAppData} />
          <CategoryManager appData={appData} onAppDataChange={setAppData} />

          <div className="ml-auto flex flex-wrap gap-3">
            <BankStatementImport
              appData={appData}
              onImport={addTransactions}
              disabled={!appData.currentEntityId}
            />
            <button
              onClick={() => setView('transactions')}
              className={`flex items-center gap-2 px-6 py-3 rounded-lg font-semibold transition-all ${
                view === 'transactions'
                  ? 'bg-blue-600 text-white shadow-lg'
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              <List size={20} />
              Transactions
            </button>
            <button
              onClick={() => setView('summary')}
              className={`flex items-center gap-2 px-6 py-3 rounded-lg font-semibold transition-all ${
                view === 'summary'
                  ? 'bg-blue-600 text-white shadow-lg'
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              <BarChart3 size={20} />
              P&L Summary
            </button>
            <button
              onClick={() => setView('invoice-parser')}
              className={`flex items-center gap-2 px-6 py-3 rounded-lg font-semibold transition-all ${
                view === 'invoice-parser'
                  ? 'bg-blue-600 text-white shadow-lg'
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              <FileText size={20} />
              Invoice Parser
            </button>
            {view !== 'invoice-parser' && (
              <button
                onClick={() => exportToExcel({ transactions: filteredTransactions })}
                disabled={filteredTransactions.length === 0}
                className="flex items-center gap-2 px-6 py-3 rounded-lg font-semibold bg-green-600 text-white hover:bg-green-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                <FileText size={20} />
                Export to Excel
              </button>
            )}
          </div>
        </div>

        {view === 'transactions' ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1 space-y-6">
              <TransactionForm onAdd={addTransaction} appData={appData} />
              <Filters
                filters={filters}
                onFiltersChange={setFilters}
                transactions={transactions}
                appData={appData}
              />
            </div>
            <div className="lg:col-span-2">
              <TransactionList
                transactions={filteredTransactions}
                onDelete={deleteTransaction}
              />
            </div>
          </div>
        ) : view === 'invoice-parser' ? (
          <InvoiceParser
            appData={appData}
            currentEntity={currentEntity}
            onAddToCashbook={addInvoiceToCashbook}
          />
        ) : (
          <PLSummary transactions={filteredTransactions} entity={currentEntity} />
        )}
      </div>
    </div>
  );
}

export default App;
