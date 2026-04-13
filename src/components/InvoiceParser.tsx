import { ChangeEvent, useMemo, useState } from 'react';
import { AlertCircle, FileText, Loader2, Plus, Upload } from 'lucide-react';
import { AppData, Entity, InvoiceData } from '../types';
import { exportToExcel } from '../utils/exportExcel';
import { formatCurrencySymbol } from '../utils/format';
import { mapInvoiceToTransaction } from '../utils/invoiceData';
import { parseInvoicePdf } from '../utils/invoiceParser';

interface InvoiceParserProps {
  appData: AppData;
  currentEntity?: Entity;
  onAddToCashbook: (invoiceData: InvoiceData) => void;
}

export const InvoiceParser = ({
  appData,
  currentEntity,
  onAddToCashbook
}: InvoiceParserProps) => {
  const [selectedFileName, setSelectedFileName] = useState('');
  const [invoiceData, setInvoiceData] = useState<InvoiceData | null>(null);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isParsing, setIsParsing] = useState(false);

  const cashbookTransaction = useMemo(
    () =>
      invoiceData
        ? mapInvoiceToTransaction(invoiceData, appData.categories, currentEntity)
        : null,
    [invoiceData, appData.categories, currentEntity]
  );

  const handleFileUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    setSelectedFileName(file.name);
    setInvoiceData(null);
    setError('');
    setSuccessMessage('');

    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setError('Please upload a PDF invoice file.');
      event.target.value = '';
      return;
    }

    setIsParsing(true);

    try {
      const parsedInvoice = await parseInvoicePdf(file);
      setInvoiceData(parsedInvoice);
    } catch (parseError) {
      setInvoiceData(null);
      setError(
        parseError instanceof Error
          ? parseError.message
          : 'We could not parse that invoice. Please try again with another PDF.'
      );
    } finally {
      setIsParsing(false);
      event.target.value = '';
    }
  };

  const handleAddToCashbook = () => {
    if (!invoiceData || !cashbookTransaction) {
      setError('Invoice date and total amount are required before adding this invoice to the cashbook.');
      return;
    }

    onAddToCashbook(invoiceData);
    setSuccessMessage('Invoice added to the cashbook.');
    setError('');
  };

  const handleExport = () => {
    if (!cashbookTransaction) {
      setError('Invoice date and total amount are required before exporting.');
      return;
    }

    exportToExcel({
      transactions: [
        {
          ...cashbookTransaction,
          id: crypto.randomUUID()
        }
      ]
    });
  };

  const detailRows = invoiceData
    ? [
      ['Vendor Name', invoiceData.vendor_name],
      ['Invoice Number', invoiceData.invoice_number],
      ['Invoice Date', invoiceData.invoice_date],
      ['Due Date', invoiceData.due_date],
      ['Subtotal', formatNullableCurrency(invoiceData.subtotal)],
      ['GST Amount', formatNullableCurrency(invoiceData.gst_amount)],
      ['Total Amount', formatNullableCurrency(invoiceData.total_amount)],
      ['Payment Status', invoiceData.payment_status]
    ]
    : [];

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-white/[0.06] bg-[#1a1a24] p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-white">Invoice Parser</h2>
            <p className="mt-1 text-sm font-medium text-[#9ca3af]">
              Upload a PDF invoice, extract structured fields with AI, then send the result into your cashbook.
            </p>
          </div>

          <label className="inline-flex cursor-pointer items-center gap-3 rounded-xl border border-white/[0.12] bg-[#7c6ff7] px-5 py-3 font-semibold text-white transition-colors hover:bg-[#6d5ff0]">
            {isParsing ? <Loader2 size={18} className="animate-spin" /> : <Upload size={18} />}
            {isParsing ? 'Parsing invoice...' : 'Upload PDF Invoice'}
            <input
              type="file"
              accept=".pdf,application/pdf"
              onChange={handleFileUpload}
              className="hidden"
              disabled={isParsing}
            />
          </label>
        </div>

        {selectedFileName && (
          <div className="mt-4 rounded-lg border border-white/[0.06] bg-[#11131f] px-4 py-3 text-sm text-[#d1d5db]">
            <span className="font-medium text-white">Selected file:</span> {selectedFileName}
          </div>
        )}

        {error && (
          <div className="mt-4 flex items-start gap-3 rounded-lg border border-red-500/30 bg-[#2b1012] px-4 py-3 text-sm text-red-200">
            <AlertCircle size={18} className="mt-0.5 shrink-0 text-red-400" />
            <p>{error}</p>
          </div>
        )}

        {successMessage && (
          <div className="mt-4 rounded-lg border border-green-500/30 bg-[#102113] px-4 py-3 text-sm text-green-200">
            {successMessage}
          </div>
        )}

        {invoiceData && !cashbookTransaction && (
          <div className="mt-4 rounded-lg border border-amber-500/30 bg-[#2d210b] px-4 py-3 text-sm text-amber-200">
            We extracted the invoice, but it is missing a usable invoice date or total amount for cashbook/export actions.
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-2xl border border-white/[0.06] bg-[#1a1a24] p-6">
          <div className="mb-4 flex items-center gap-2">
            <FileText size={20} className="text-[#7c6ff7]" />
            <h3 className="text-xl font-semibold text-white">Parsed Results</h3>
          </div>

          {!invoiceData ? (
            <div className="rounded-xl border border-dashed border-white/[0.12] bg-[#11131f] px-6 py-14 text-center text-[#9ca3af]">
              Upload a PDF invoice to see extracted fields here.
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-white/[0.06] bg-[#11131f]">
              <table className="min-w-full divide-y divide-white/[0.06]">
                <tbody className="divide-y divide-white/[0.06] bg-[#11131f]">
                  {detailRows.map(([label, value]) => (
                    <tr key={label} className="odd:bg-[#11131f] even:bg-[#10111c]">
                      <td className="w-44 bg-[#11131f] px-4 py-3 text-sm font-semibold text-[#9ca3af]">
                        {label}
                      </td>
                      <td className="px-4 py-3 text-sm text-white">{value || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="mt-5 flex flex-wrap gap-3">
            <button
              onClick={handleAddToCashbook}
              disabled={!invoiceData || !cashbookTransaction || !appData.currentEntityId}
              className="inline-flex items-center gap-2 rounded-lg bg-[#7c6ff7] px-5 py-2.5 font-semibold text-white transition-colors hover:bg-[#6d5ff0] disabled:cursor-not-allowed disabled:bg-white/[0.08] disabled:text-[#9ca3af]"
            >
              <Plus size={18} />
              Add to Cashbook
            </button>
            <button
              onClick={handleExport}
              disabled={!invoiceData || !cashbookTransaction}
              className="inline-flex items-center gap-2 rounded-lg bg-[#4ade80] px-5 py-2.5 font-semibold text-black transition-colors hover:bg-[#3ccb6a] disabled:cursor-not-allowed disabled:bg-white/[0.08] disabled:text-[#9ca3af]"
            >
              <FileText size={18} />
              Export to Excel
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-white/[0.06] bg-[#1a1a24] p-6">
          <h3 className="mb-4 text-xl font-semibold text-white">Line Items</h3>

          {!invoiceData || invoiceData.line_items.length === 0 ? (
            <div className="rounded-xl border border-dashed border-white/[0.12] bg-[#11131f] px-6 py-14 text-center text-[#9ca3af]">
              No line items extracted yet.
            </div>
          ) : (
            <div className="overflow-auto rounded-xl border border-white/[0.06] bg-[#11131f]">
              <table className="min-w-full divide-y divide-white/[0.06]">
                <thead className="bg-[#11131f]">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#9ca3af]">
                      Description
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-[#9ca3af]">
                      Qty
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-[#9ca3af]">
                      Unit Price
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-[#9ca3af]">
                      Amount
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.06] bg-[#11131f]">
                  {invoiceData.line_items.map((item, index) => (
                    <tr key={`${item.description ?? 'item'}-${index}`} className="odd:bg-[#11131f] even:bg-[#10111c] hover:bg-white/5">
                      <td className="px-4 py-3 text-sm text-white">{item.description || '-'}</td>
                      <td className="px-4 py-3 text-right text-sm text-[#cbd5e1]">
                        {item.quantity ?? '-'}
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-[#cbd5e1]">
                        {formatNullableCurrency(item.unit_price)}
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-medium text-white">
                        {formatNullableCurrency(item.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const formatNullableCurrency = (value: number | null) =>
  value === null ? '-' : formatCurrencySymbol(value);
