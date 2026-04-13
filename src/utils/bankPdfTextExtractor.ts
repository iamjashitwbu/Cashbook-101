import { extractTextFromPDF } from './pdfParser';

export const extractBankPdfText = (file: File): Promise<string> => {
  return extractTextFromPDF(file);
};
