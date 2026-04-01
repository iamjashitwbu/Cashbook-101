import { InvoiceData } from '../types';
import { INVOICE_EXTRACTION_SYSTEM_PROMPT } from './invoiceData';

export const parseInvoicePdf = async (file: File): Promise<InvoiceData> => {
  const base64Pdf = await convertFileToBase64(file);

  let response: Response;

  try {
    response = await fetch('/api/parse-invoice', {
      method: 'POST',
      headers: {
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        pdfBase64: base64Pdf,
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

const convertFileToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      const [, base64Content = ''] = result.split(',');

      if (!base64Content) {
        reject(new Error('Unable to read the uploaded PDF.'));
        return;
      }

      resolve(base64Content);
    };

    reader.onerror = () => reject(new Error('Unable to read the uploaded PDF.'));
    reader.readAsDataURL(file);
  });
