import type { BankStatementPreviewEntry } from './bankStatementImport';
import { extractTextFromPDF } from './pdfParser';
import { parseBankStatementRows } from '../../lib/parseBankStatementRows';

export const processBankStatementPdf = async (
  pdfFile: File
): Promise<BankStatementPreviewEntry[]> => {
  try {
    const fullText = await extractTextFromPDF(pdfFile);

    if (!fullText || !fullText.trim()) {
      throw new Error('The bank statement parser did not find any text in the PDF.');
    }

    const parsedRows = parseBankStatementRows([fullText]);

    if (!parsedRows || parsedRows.length === 0) {
      throw new Error('The bank statement parser did not return any transaction rows.');
    }

    return parsedRows.map((row) => ({
      date: row.date,
      description: row.description,
      rawDescription: row.rawDescription,
      amount: row.amount,
      type: row.type === 'credit' ? 'income' : 'expense'
    }));
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('The bank statement parsing request failed.');
  }
};
