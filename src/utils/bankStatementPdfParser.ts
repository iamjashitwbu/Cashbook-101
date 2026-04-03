import { ExtractedBankStatementRow } from './bankStatementImport';

const BANK_STATEMENT_EXTRACTION_PROMPT =
  'Extract all bank statement transactions from these statement page images and return ONLY a JSON array. Each item must be an object with exactly these string fields: date, description, debit, credit, balance. Include every transaction row you can read. Use empty string for missing debit, credit, or balance values. Do not return markdown, explanations, or any extra text.';

export const parseBankStatementPdfImages = async (
  pageImagesBase64: string[]
): Promise<ExtractedBankStatementRow[]> => {
  let response: Response;

  try {
    response = await fetch('/api/parse-bank-statement', {
      method: 'POST',
      headers: {
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        pageImagesBase64,
        prompt: BANK_STATEMENT_EXTRACTION_PROMPT
      })
    });
  } catch {
    throw new Error(
      'The bank statement parser service is unreachable right now. If you are running locally, start the app with Vercel so the /api route is available.'
    );
  }

  let responseData: { rows?: ExtractedBankStatementRow[]; error?: string };

  try {
    responseData = await response.json();
  } catch {
    throw new Error('The bank statement parser returned an unreadable response.');
  }

  if (!response.ok) {
    throw new Error(responseData.error || 'The bank statement parsing request failed.');
  }

  if (!Array.isArray(responseData.rows)) {
    throw new Error('The bank statement parser did not return any transaction rows.');
  }

  return responseData.rows;
};
