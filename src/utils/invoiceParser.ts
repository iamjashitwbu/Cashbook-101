import { InvoiceData } from '../types';
import { INVOICE_EXTRACTION_SYSTEM_PROMPT } from './invoiceData';

export const parseInvoicePdf = async (pdfFile: File): Promise<InvoiceData> => {
  const formData = new FormData();
  formData.append('file', pdfFile);
  formData.append('prompt', INVOICE_EXTRACTION_SYSTEM_PROMPT);

  let response: Response;

  try {
    response = await fetch('/api/parse-invoice', {
      method: 'POST',
      body: formData
    });
  } catch {
    throw new Error(
      'The invoice parser service is unreachable right now. Please make sure the local dev server is running.'
    );
  }

  let responseData: { invoiceData?: InvoiceData; error?: string };

  try {
    responseData = await response.json();
  } catch {
    throw new Error('The invoice parser returned an unreadable response.');
  }

  if (responseData.error) {
    throw new Error(responseData.error);
  }

  if (!response.ok) {
    throw new Error('The invoice parsing request failed.');
  }

  if (!responseData.invoiceData) {
    throw new Error('The invoice parser did not return any invoice data.');
  }

  return responseData.invoiceData;
};
