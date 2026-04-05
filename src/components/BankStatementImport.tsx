import { ChangeEvent, useMemo, useState } from 'react';
import { AlertCircle, Upload, X } from 'lucide-react';
import { AppData, Transaction } from '../types';
import {
  BankStatementPreviewEntry,
  convertPreviewEntriesToTransactions,
  parseBankStatementCsv,
  removeDuplicatePreviewEntries
} from '../utils/bankStatementImport';
import { formatCurrencySymbol } from '../utils/format';
import { convertPDFTextToCSV, extractTextFromPDF, convertPDFToImages } from '../utils/pdfParser';
import { parseBankStatementPdfImages } from '../utils/bankStatementPdfParser';

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

  const importedTransactions = useMemo(
    () => convertPreviewEntriesToTransactions(previewEntries, appData.categories),
    [previewEntries, appData.categories]
  );

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
      let csvText = '';

    if (fileType === 'pdf') {
  const pageImagesBase64 = await convertPDFToImages(file);
  const rows = await parseBankStatementPdfImages(pageImagesBase64);
  const deduplicatedEntries = removeDuplicatePreviewEntries(
    rows.map(row => ({
      date: row.date,
      description: row.description,
      amount: row.amount,
      type: row.type === 'credit' ? 'income' : 'expense'
    })),
    currentTransactions
  );
  setDetectedBank('PDF');
  setPreviewEntries(deduplicatedEntries);
  return;
}
      const parsedStatement = parseBankStatementCsv(csvText);
      const nextPreviewEntries = parsedStatement.entries;
      const nextDetectedBank = parsedStatement.bankName;

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
    if (importedTransactions.length === 0) {
      return;
    }

    onImport(importedTransactions);
    handleClose();
  };

  const incomeCategory =
    importedTransactions.find((transaction) => transaction.type === 'income')?.category ?? 'Other Income';
  const expenseCategory =
    importedTransactions.find((transaction) => transaction.type === 'expense')?.category ?? 'Other';

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        disabled={disabled}
        className="flex items-center gap-2 px-6 py-3 rounded-lg font-semibold bg-white text-gray-700 hover:bg-gray-50 transition-colors disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed"
      >
        <Upload size={20} />
        Import Statement
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 p-4">
          <div className="mx-auto flex min-h-full max-w-5xl items-center justify-center">
           <div className="w-full overflow-hidden rounded-2xl bg-white shadow-2xl">
              <div className="flex items-start justify-between border-b border-gray-200 px-6 py-5">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">Import Bank Statement</h2>
                  <p className="mt-1 text-sm text-gray-600">
                    Upload an HDFC, SBI, or ICICI CSV file, or a PDF statement, to preview transactions before import.
                  </p>
                </div>
                <button
                  onClick={handleClose}
                  className="rounded-full p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                  aria-label="Close import dialog"
                >
                  <X size={20} />
                </button>
              </div>

             <div className="space-y-5 px-6 py-5">
                <label className="block rounded-xl border-2 border-dashed border-blue-200 bg-blue-50/60 p-6 text-center transition-colors hover:border-blue-300 hover:bg-blue-50">
                  <div className="flex flex-col items-center gap-3">
                    <div className="rounded-full bg-blue-600 p-3 text-white">
                      <Upload size={22} />
                    </div>
                  <div>
                      <p className="font-semibold text-gray-900">Choose a CSV or PDF file</p>
                      <p className="text-sm text-gray-600">
                        Supported banks: HDFC, SBI, ICICI
                      </p>
                    </div>
                    <span className="rounded-full bg-white px-4 py-2 text-sm font-medium text-blue-700 shadow-sm">
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
                  <div className="rounded-lg bg-gray-50 px-4 py-3 text-sm text-gray-700">
                    <span className="font-medium">Selected file:</span> {selectedFileName}
                    {detectedBank ? (
                      <span className="ml-3 rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700">
                        {detectedBank} detected
                      </span>
                    ) : null}
                  </div>
                )}

                {error && (
                  <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    <AlertCircle size={18} className="mt-0.5 shrink-0" />
                    <p>{error}</p>
                  </div>
                )}

                {previewEntries.length > 0 && (
                  <>
                    <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                      Imported credits will use the <span className="font-semibold">{incomeCategory}</span>{' '}
                      category, and debits will use{' '}
                      <span className="font-semibold">{expenseCategory}</span>. You can recategorize them later.
                    </div>

                    <div>
                      <div className="mb-3 flex items-center justify-between">
                        <h3 className="text-lg font-semibold text-gray-900">Preview</h3>
                        <p className="text-sm text-gray-600">
                          {previewEntries.length} transaction{previewEntries.length === 1 ? '' : 's'} ready
                        </p>
                      </div>

                    <div className="max-h-[26rem] overflow-auto rounded-xl border border-gray-200">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="sticky top-0 bg-gray-50">
                            <tr>
                              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">
                                Date
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">
                                Description
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">
                                Type
                              </th>
                              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-600">
                                Amount
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100 bg-white">
                            {previewEntries.map((entry, index) => (
                              <tr key={`${entry.date}-${entry.description}-${entry.amount}-${index}`}>
                                <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-900">
                                  {new Date(entry.date).toLocaleDateString()}
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-700">
                                  {entry.description}
                                </td>
                                <td className="whitespace-nowrap px-4 py-3 text-sm">
                                  <span
                                    className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                                      entry.type === 'income'
                                        ? 'bg-green-100 text-green-700'
                                        : 'bg-red-100 text-red-700'
                                    }`}
                                  >
                                    {entry.type === 'income' ? 'Credit' : 'Debit'}
                                  </span>
                                </td>
                                <td
                                  className={`whitespace-nowrap px-4 py-3 text-right text-sm font-semibold ${
                                    entry.type === 'income' ? 'text-green-600' : 'text-red-600'
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

              <div className="flex justify-end gap-3 border-t border-gray-200 bg-gray-50 px-6 py-4">
                <button
                  onClick={handleClose}
                  className="rounded-lg bg-white px-5 py-2.5 font-medium text-gray-700 ring-1 ring-gray-300 transition-colors hover:bg-gray-100"
                >
                  Cancel
                </button>
                <button
                  onClick={handleImport}
                  disabled={importedTransactions.length === 0}
                  className="rounded-lg bg-blue-600 px-5 py-2.5 font-semibold text-white transition-colors hover:bg-blue-700 disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed"
                >
                  Confirm Import
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
