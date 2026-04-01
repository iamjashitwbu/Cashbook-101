import { ChangeEvent, useMemo, useState } from 'react';
import { AlertCircle, FileText, Loader2, Plus, Upload } from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';
import { AppData, InvoiceData } from '../types';
import { exportToExcel } from '../utils/exportExcel';
import { formatCurrencySymbol } from '../utils/format';
import { mapInvoiceToTransaction } from '../utils/invoiceData';
import { parseInvoiceImageBase64 } from '../utils/invoiceParser';

interface InvoiceParserProps {
  appData: AppData;
  onAddToCashbook: (invoiceData: InvoiceData) => void;
}

pdfjsLib.GlobalWorkerOptions.workerSrc =
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

export const InvoiceParser = ({ appData, onAddToCashbook }: InvoiceParserProps) => {
  const [selectedFileName, setSelectedFileName] = useState('');
  const [invoiceData, setInvoiceData] = useState<InvoiceData | null>(null);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isParsing, setIsParsing] = useState(false);

  const cashbookTransaction = useMemo(
    () =>
      invoiceData
        ? mapInvoiceToTransaction(invoiceData, appData.categories)
        : null,
    [invoiceData, appData.categories]
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
      const pdfBase64 = await convertPdfToJpegBase64(file);
      const parsedInvoice = await parseInvoiceImageBase64(pdfBase64);
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

    exportToExcel({ transactions: [cashbookTransaction] });
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
      <div className="rounded-2xl bg-white p-6 shadow-md">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Invoice Parser</h2>
            <p className="mt-1 text-sm text-gray-600">
              Upload a PDF invoice, extract structured fields with AI, then send the result into your cashbook.
            </p>
          </div>

          <label className="inline-flex cursor-pointer items-center gap-3 rounded-xl border border-blue-200 bg-blue-50 px-5 py-3 font-semibold text-blue-700 transition-colors hover:border-blue-300 hover:bg-blue-100">
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
          <div className="mt-4 rounded-lg bg-gray-50 px-4 py-3 text-sm text-gray-700">
            <span className="font-medium">Selected file:</span> {selectedFileName}
          </div>
        )}

        {error && (
          <div className="mt-4 flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <AlertCircle size={18} className="mt-0.5 shrink-0" />
            <p>{error}</p>
          </div>
        )}

        {successMessage && (
          <div className="mt-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
            {successMessage}
          </div>
        )}

        {invoiceData && !cashbookTransaction && (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            We extracted the invoice, but it is missing a usable invoice date or total amount for cashbook/export actions.
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-2xl bg-white p-6 shadow-md">
          <div className="mb-4 flex items-center gap-2">
            <FileText size={20} className="text-blue-600" />
            <h3 className="text-xl font-semibold text-gray-900">Parsed Results</h3>
          </div>

          {!invoiceData ? (
            <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 px-6 py-14 text-center text-gray-500">
              Upload a PDF invoice to see extracted fields here.
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-gray-200">
              <table className="min-w-full divide-y divide-gray-200">
                <tbody className="divide-y divide-gray-200 bg-white">
                  {detailRows.map(([label, value]) => (
                    <tr key={label}>
                      <td className="w-44 bg-gray-50 px-4 py-3 text-sm font-semibold text-gray-700">
                        {label}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">{value || '-'}</td>
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
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500"
            >
              <Plus size={18} />
              Add to Cashbook
            </button>
            <button
              onClick={handleExport}
              disabled={!invoiceData || !cashbookTransaction}
              className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-5 py-2.5 font-semibold text-white transition-colors hover:bg-green-700 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500"
            >
              <FileText size={18} />
              Export to Excel
            </button>
          </div>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-md">
          <h3 className="mb-4 text-xl font-semibold text-gray-900">Line Items</h3>

          {!invoiceData || invoiceData.line_items.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 px-6 py-14 text-center text-gray-500">
              No line items extracted yet.
            </div>
          ) : (
            <div className="overflow-auto rounded-xl border border-gray-200">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">
                      Description
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-600">
                      Qty
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-600">
                      Unit Price
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-600">
                      Amount
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {invoiceData.line_items.map((item, index) => (
                    <tr key={`${item.description ?? 'item'}-${index}`}>
                      <td className="px-4 py-3 text-sm text-gray-900">{item.description || '-'}</td>
                      <td className="px-4 py-3 text-right text-sm text-gray-700">
                        {item.quantity ?? '-'}
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-gray-700">
                        {formatNullableCurrency(item.unit_price)}
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-medium text-gray-900">
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

const convertPdfToJpegBase64 = async (file: File): Promise<string> => {
  let pdfDocument: Awaited<ReturnType<typeof pdfjsLib.getDocument>['promise']> | undefined;

  try {
    const pdfBytes = new Uint8Array(await file.arrayBuffer());
    const loadingTask = pdfjsLib.getDocument({ data: pdfBytes });
    pdfDocument = await loadingTask.promise;

    const firstPage = await pdfDocument.getPage(1);
    const viewport = firstPage.getViewport({ scale: 2 });
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');

    if (!context) {
      throw new Error('Unable to prepare the uploaded PDF for parsing.');
    }

    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);

    await firstPage.render({
      canvasContext: context,
      viewport
    }).promise;
    firstPage.cleanup();

    const base64Image = canvas.toDataURL('image/jpeg', 0.95).split(',')[1];

    canvas.width = 0;
    canvas.height = 0;

    if (!base64Image) {
      throw new Error('Unable to convert the uploaded PDF into an image.');
    }

    return base64Image;
  } catch (error) {
    throw new Error(
      error instanceof Error ? error.message : 'Unable to read the uploaded PDF.'
    );
  } finally {
    pdfDocument?.destroy();
  }
};
