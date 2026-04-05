import { ExtractedBankStatementRow } from './bankStatementImport';

const BANK_STATEMENT_EXTRACTION_PROMPT = `
You are reading a bank statement.

Extract ALL transactions from the bank statement table.

Return ONLY a JSON array.
Each item must be in this exact format:

[
  {
    "date": "YYYY-MM-DD",
    "description": "transaction description",
    "amount": 1234.56,
    "type": "debit" or "credit"
  }
]

Rules:
- Extract every row from the transaction table
- Do NOT include opening balance or closing balance
- Do NOT include headers
- Debit means money out
- Credit means money in
- Amount must be positive
- Return JSON only, no explanation
`;
export const parseBankStatementPdfImages = async (
  pageImagesBase64: string[]
): Promise<ExtractedBankStatementRow[]> => {
  let response: Response;

  try {
    response = await fetch('/api/parse-bank-statements', {
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
