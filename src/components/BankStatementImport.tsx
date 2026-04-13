import { ChangeEvent, useState } from 'react';
import { AlertCircle, Upload, X } from 'lucide-react';
import type { AppData, Transaction } from '../types';
import {
  convertPreviewEntriesToTransactions,
  parseBankStatementCsv,
  removeDuplicatePreviewEntries
} from '../utils/bankStatementImport';
import type { BankStatementPreviewEntry } from '../utils/bankStatementImport';
import { formatCurrencySymbol } from '../utils/format';
import { processBankStatementPdf } from '../utils/bankStatementPdfParser';

interface BankStatementImportProps {
  appData: AppData;
  onImport: (transactions: Omit<Transaction, 'id'>[]) => void;
  disabled?: boolean;
}

export const BankStatementImport = ({
  appData,
  onImport,
  disabled = false
}: BankStatementImportProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [previewEntries, setPreviewEntries] = useState<BankStatementPreviewEntry[]>([]);
  const [detectedBank, setDetectedBank] = useState<string | null>(null);
  const [selectedFileName, setSelectedFileName] = useState('');
  const [error, setError] = useState('');
  const currentTransactions = appData.transactions[appData.currentEntityId] || [];

  const resetState = () => {
    setPreviewEntries([]);
    setDetectedBank(null);
    setSelectedFileName('');
    setError('');
  };

  const handleClose = () => {
    resetState();
    setIsOpen(false);
  };

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    setSelectedFileName(file.name);
    setError('');

    try {
      const lowerCaseFileName = file.name.toLowerCase();
      const fileType = lowerCaseFileName.endsWith('.pdf') ? 'pdf' : 'csv';
      let nextPreviewEntries: BankStatementPreviewEntry[] = [];
      let nextDetectedBank: string | null = null;

      if (fileType === 'pdf') {
        const extractedEntries = await processBankStatementPdf(file);
        console.log('PDF parser returned entries:', extractedEntries.length, extractedEntries);
        nextPreviewEntries = extractedEntries;
      } else {
        const csvText = await file.text();
        const parsedStatement = parseBankStatementCsv(csvText);
        nextPreviewEntries = parsedStatement.entries;
        nextDetectedBank = parsedStatement.bankName;
      }

      // Only filter out entries with NaN amounts
      nextPreviewEntries = nextPreviewEntries.filter((entry) => !isNaN(entry.amount) && entry.amount > 0);

      const deduplicatedEntries = removeDuplicatePreviewEntries(
        nextPreviewEntries,
        currentTransactions
      );

      setDetectedBank(nextDetectedBank);
      setPreviewEntries(deduplicatedEntries);

      if (nextPreviewEntries.length === 0) {
        setError('No valid transactions were found in this file.');
      } else if (deduplicatedEntries.length === 0) {
        setError('All detected transactions already exist for this entity.');
      } else if (deduplicatedEntries.length < nextPreviewEntries.length) {
        setError('Duplicate transactions were skipped using date, amount, and description.');
      }
    } catch (parseError) {
      console.error('Parse error:', parseError);
      setDetectedBank(null);
      setPreviewEntries([]);
      setError(
        parseError instanceof Error
          ? parseError.message
          : 'Unable to parse this bank statement file.'
      );
    } finally {
      event.target.value = '';
    }
  };

  const handleImport = () => {
    console.log('Importing:', previewEntries.length, 'entries');
    if (previewEntries.length === 0) {
      return;
    }

    // Convert the SAME previewEntries array that the user sees
    const transactions = convertPreviewEntriesToTransactions(previewEntries, appData.categories);

    console.log('Parsed Transactions:', transactions);
    console.log('Unique Transactions:', transactions);

    onImport(transactions);
    handleClose();
  };

  // Derive categories from previewEntries for display
  const hasIncome = previewEntries.some((e) => e.type === 'income');
  const hasExpense = previewEntries.some((e) => e.type === 'expense');
  const incomeCategory = appData.categories.income[0] ?? 'Other Income';
  const expenseCategory = appData.categories.expense[0] ?? 'Other';

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        disabled={disabled}
        className="flex items-center gap-2 rounded-[10px] border border-white/[0.12] bg-transparent px-6 py-3 font-semibold text-white transition-colors hover:bg-white/[0.04] disabled:cursor-not-allowed disabled:text-[#9ca3af]"
      >
        <Upload size={20} />
        Import Statement
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-white/[0.06] bg-[#1a1a24]">
              <div className="flex items-start justify-between border-b border-white/[0.06] px-6 py-5">
                <div>
                  <h2 className="text-2xl font-bold text-white">Import Bank Statement</h2>
                  <p className="mt-1 text-sm text-[#9ca3af]">
                    Upload a bank statement (PDF or CSV) to preview transactions before import.
                  </p>
                </div>
                <button
                  onClick={handleClose}
                  className="rounded-full p-2 text-[#9ca3af] hover:bg-white/[0.04] hover:text-white"
                  aria-label="Close import dialog"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-5 px-6 py-5">
                <label className="block rounded-xl border border-dashed border-white/[0.12] bg-[#0f0f14] p-6 text-center transition-colors hover:border-[#7c6ff7]">
                  <div className="flex flex-col items-center gap-3">
                    <div className="rounded-full bg-[#7c6ff7] p-3 text-white">
                      <Upload size={22} />
                    </div>
                  <div>
                      <p className="font-semibold text-white">Choose a CSV or PDF file</p>
                      <p className="text-sm text-[#9ca3af]">
                        PDF or CSV files
                      </p>
                    </div>
                    <span className="rounded-[10px] bg-[#7c6ff7] px-4 py-2 text-sm font-medium text-white">
                      Browse Files
                    </span>
                  </div>
                  <input
                    type="file"
                    accept=".csv,.pdf,text/csv,application/pdf"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </label>

                {selectedFileName && (
                  <div className="rounded-xl border border-white/[0.06] bg-[#0f0f14] px-4 py-3 text-sm text-white">
                    <span className="font-medium">Selected file:</span> {selectedFileName}
                    {detectedBank ? (
                      <span className="ml-3 rounded-full bg-[#4ade80]/15 px-3 py-1 text-xs font-semibold text-[#4ade80]">
                        {detectedBank} detected
                      </span>
                    ) : null}
                  </div>
                )}

                {error && (
                  <div className="flex items-start gap-3 rounded-xl border border-[#f87171]/30 bg-[#f87171]/10 px-4 py-3 text-sm text-[#f87171]">
                    <AlertCircle size={18} className="mt-0.5 shrink-0" />
                    <p>{error}</p>
                  </div>
                )}

                {previewEntries.length > 0 && (
                  <>
                    <div className="rounded-xl border border-[#7c6ff7]/30 bg-[#7c6ff7]/10 px-4 py-3 text-sm text-white">
                      {hasIncome && (
                        <>Imported credits will use the <span className="font-semibold">{incomeCategory}</span> category. </>
                      )}
                      {hasExpense && (
                        <>Debits will use <span className="font-semibold">{expenseCategory}</span>. </>
                      )}
                      You can recategorize them later.
                    </div>

                    <div>
                      <div className="mb-3 flex items-center justify-between">
                        <h3 className="text-lg font-semibold text-white">Preview</h3>
                        <p className="text-sm text-[#9ca3af]">
                          {previewEntries.length} transaction{previewEntries.length === 1 ? '' : 's'} ready
                        </p>
                      </div>

                      <div className="max-h-[28rem] overflow-auto rounded-xl border border-white/[0.06]">
                        <table className="min-w-full divide-y divide-white/[0.06]">
                          <thead className="sticky top-0 bg-[#1a1a24]">
                            <tr>
                              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#9ca3af]">
                                Date
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#9ca3af]">
                                Description
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#9ca3af]">
                                Type
                              </th>
                              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-[#9ca3af]">
                                Amount
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/[0.06] bg-transparent">
                            {previewEntries.map((entry, index) => (
                              <tr key={`${entry.date}-${entry.amount}-${index}`}>
                                <td className="whitespace-nowrap px-4 py-3 text-sm text-white">
                                  {new Date(entry.date).toLocaleDateString()}
                                </td>
                                <td className="px-4 py-3 text-sm text-[#9ca3af]" title={entry.rawDescription}>
                                  {entry.description || 'Transaction'}
                                </td>
                                <td className="whitespace-nowrap px-4 py-3 text-sm">
                                  <span
                                    className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                                      entry.type === 'income'
                                        ? 'bg-[#4ade80]/15 text-[#4ade80]'
                                        : 'bg-[#f87171]/15 text-[#f87171]'
                                    }`}
                                  >
                                    {entry.type === 'income' ? 'Credit' : 'Debit'}
                                  </span>
                                </td>
                                <td
                                  className={`whitespace-nowrap px-4 py-3 text-right text-sm font-semibold ${
                                    entry.type === 'income' ? 'text-[#4ade80]' : 'text-[#f87171]'
                                  }`}
                                >
                                  {formatCurrencySymbol(entry.amount)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </>
                )}
              </div>

              <div className="flex-shrink-0 flex justify-end gap-3 border-t border-white/[0.06] bg-[#0f0f14] px-6 py-4">
                <button
                  onClick={handleClose}
                  className="rounded-[10px] border border-white/[0.12] bg-transparent px-5 py-2.5 font-medium text-white transition-colors hover:bg-white/[0.04]"
                >
                  Cancel
                </button>
                <button
                  onClick={handleImport}
                  disabled={previewEntries.length === 0}
                  className="rounded-[10px] bg-[#7c6ff7] px-5 py-2.5 font-semibold text-white transition-colors hover:bg-[#6d5ff0] disabled:cursor-not-allowed disabled:bg-white/[0.08] disabled:text-[#9ca3af]"
                >
                  Confirm Import ({previewEntries.length})
                </button>
              </div>
          </div>
        </div>
      )}
    </>
  );
};
