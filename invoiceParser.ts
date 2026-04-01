import * as pdfjsLib from 'pdfjs-dist';
import { InvoiceData } from '../types';
import { INVOICE_EXTRACTION_SYSTEM_PROMPT } from './invoiceData';

pdfjsLib.GlobalWorkerOptions.workerSrc =
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

export const parseInvoicePdf = async (file: File): Promise<InvoiceData> => {
  const base64Pdf = await convertPdfToJpegBase64(file);

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

    const imageDataUrl = canvas.toDataURL('image/jpeg', 0.95);
    const [, base64Content = ''] = imageDataUrl.split(',');

    canvas.width = 0;
    canvas.height = 0;

    if (!base64Content) {
      throw new Error('Unable to convert the uploaded PDF into an image.');
    }

    return base64Content;
  } catch (error) {
    throw new Error(
      error instanceof Error ? error.message : 'Unable to read the uploaded PDF.'
    );
  } finally {
    pdfDocument?.destroy();
  }
};
