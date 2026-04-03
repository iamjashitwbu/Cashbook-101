import { InvoiceData } from '../types';
import { INVOICE_EXTRACTION_SYSTEM_PROMPT } from './invoiceData';

export const parseInvoiceImageBase64 = async (pdfBase64: string): Promise<InvoiceData> => {
  let response: Response;

  try {
    response = await fetch('/api/parse-invoice', {
      method: 'POST',
      headers: {
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        pdfBase64,
        prompt: INVOICE_EXTRACTION_SYSTEM_PROMPT
      })
    });
  } catch {
    throw new Error(
      'The invoice parser service is unreachable right now. If you are running locally, start the app with Vercel so the /api route is available.'
    );
  }

  let responseData: { invoiceData?: InvoiceData; error?: string };

  try {
    responseData = await response.json();
  } catch {
    throw new Error('The invoice parser returned an unreadable response.');
  }

  if (!response.ok) {
    throw new Error(responseData.error || 'The invoice parsing request failed.');
  }

  if (!responseData.invoiceData) {
    throw new Error('The invoice parser did not return any invoice data.');
  }

  return responseData.invoiceData;
};
