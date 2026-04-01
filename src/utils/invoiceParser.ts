import * as pdfjsLib from 'pdfjs-dist';
import { InvoiceData } from '../types';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();

async function convertPdfToJpegBase64(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const page = await pdf.getPage(1);
  const viewport = page.getViewport({ scale: 2.0 });
  const canvas = document.createElement('canvas');
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext('2d')!;
  await page.render({ canvasContext: ctx, viewport }).promise;
  return canvas.toDataURL('image/jpeg', 0.95).split(',')[1];
}

export const parseInvoicePdf = async (file: File): Promise<InvoiceData> => {
  const base64Jpeg = await convertPdfToJpegBase64(file);

  let response: Response;

  try {
    response = await fetch('/api/parse-invoice', {
      method: 'POST',
      headers: {
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        pdfBase64: base64Jpeg
      })
    });
  } catch {
    throw new Error('The invoice parser service is unreachable right now.');
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText);
  }

  const data = await response.json();
  return data as InvoiceData;
};
