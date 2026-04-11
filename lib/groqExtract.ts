import type { ExtractedBankStatementRow } from './bankStatementTypes';

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'meta-llama/llama-4-scout-17b-16e-instruct';

const BANK_STATEMENT_EXTRACTION_PROMPT =
  'Extract all bank transactions from this text. Return ONLY a JSON array, no markdown, no explanation. Each object must have exactly 4 string fields: date, description, debit, credit. Use empty string for missing values. Example: [{"date":"01-Oct-2025","description":"UPI payment","debit":"100.00","credit":""}]';

export const groqExtract = async (statementText: string): Promise<ExtractedBankStatementRow[]> => {
  const apiKey = process.env.GROQ_API_KEY;

  if (!apiKey) {
    throw new Error(
      'Bank statement parsing is not configured on the server. Add GROQ_API_KEY and redeploy.'
    );
  }

  if (!statementText.trim()) {
    return [];
  }

  let groqResponse: Response;

  try {
    groqResponse = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        temperature: 0,
        messages: [
          {
            role: 'user',
            content: `${BANK_STATEMENT_EXTRACTION_PROMPT}\n\n${statementText}`
          }
        ],
        max_tokens: 4000
      })
    });
  } catch {
    throw new Error('Unable to reach the bank statement parsing service right now.');
  }

  let responseData: unknown;

  try {
    responseData = await groqResponse.json();
  } catch {
    throw new Error('The bank statement parsing service returned an unreadable response.');
  }

  if (!groqResponse.ok) {
    const apiMessage =
      typeof (responseData as { error?: { message?: unknown } })?.error?.message === 'string'
        ? (responseData as { error: { message: string } }).error.message
        : 'The bank statement parsing request failed.';

    throw new Error(apiMessage);
  }

  const responseText = Array.isArray((responseData as { choices?: unknown[] })?.choices)
    ? ((responseData as {
        choices: Array<{
          message?: { content?: string };
        }>;
      }).choices)
        .map((choice) => choice.message?.content ?? '')
        .join('\n')
        .trim()
    : '';

  if (!responseText) {
    throw new Error('Groq did not return any bank statement data.');
  }

  return normalizeExtractedRows(parseJsonArray(responseText));
};

const parseJsonArray = (value: string) => {
  // Strip markdown code blocks
  const cleanedValue = value
    .replace(/```json/gi, '')
    .replace(/```/gi, '')
    .trim();

  // Try direct parse first
  try {
    const parsed = JSON.parse(cleanedValue);
    if (Array.isArray(parsed)) return parsed;
  } catch {}

  // Find the JSON array within the response
  const jsonStart = cleanedValue.indexOf('[');
  const jsonEnd = cleanedValue.lastIndexOf(']');

  if (jsonStart === -1 || jsonEnd === -1 || jsonEnd <= jsonStart) {
    // Log what Groq actually returned to help debug further
    console.error('Groq raw response that failed parsing:', value.substring(0, 500));
    throw new Error('Groq returned an unexpected response format.');
  }

  const jsonSlice = cleanedValue.slice(jsonStart, jsonEnd + 1);

  try {
    const parsed = JSON.parse(jsonSlice);
    if (!Array.isArray(parsed)) {
      throw new Error('Groq returned invalid bank statement data.');
    }
    return parsed;
  } catch (e) {
    console.error('Groq slice parse failed:', jsonSlice.substring(0, 500));
    throw new Error('Groq returned an unexpected response format.');
  }
};
const normalizeExtractedRows = (rawValue: unknown): ExtractedBankStatementRow[] => {
  if (!Array.isArray(rawValue)) {
    throw new Error('Groq returned invalid bank statement data.');
  }

  return rawValue.map((row) => {
    const rawRow = row && typeof row === 'object' ? (row as Record<string, unknown>) : {};

    return {
      date: normalizeStringValue(rawRow.date),
      description: normalizeStringValue(rawRow.description),
      debit: normalizeStringValue(rawRow.debit),
      credit: normalizeStringValue(rawRow.credit),
      balance: ''
    };
  });
};

const normalizeStringValue = (value: unknown) => {
  if (typeof value !== 'string') {
    return '';
  }

  return value.trim();
};
