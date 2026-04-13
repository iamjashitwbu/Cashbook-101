import formidable, { type File as FormidableFile } from 'formidable';
import { promises as fs } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { tmpdir } from 'node:os';
import { extractPdfText } from '../lib/pdfTextExtract.js';

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'meta-llama/llama-4-scout-17b-16e-instruct';
const JSON_ONLY_RESPONSE_INSTRUCTION =
  'Respond ONLY with a valid JSON object. No explanation, no markdown, no code fences. Start your response with { and end with }.';
const INVOICE_TEXT_EXTRACTION_PROMPT =
  "Extract all invoice data from this text. Fields: seller_name, seller_gstin, buyer_name, buyer_gstin, invoice_number, invoice_date, due_date, line_items (array of: description, quantity, unit_price, amount), subtotal, gst_amount, total_amount, payment_status, transaction_type. For transaction_type, return 'sale' if this is an invoice issued by us (we are the seller), return 'purchase' if this is an invoice we received (we are the buyer). Set any missing field to null.";
const TEMP_ROOT = tmpdir();

type ParseInvoiceRequestBody = {
  pdfBase64?: string;
  prompt?: string;
};

type InvoiceLineItem = {
  description: string | null;
  quantity: number | null;
  unit_price: number | null;
  amount: number | null;
};

type InvoiceData = {
  vendor_name: string | null;
  seller_name: string | null;
  seller_gstin: string | null;
  buyer_name: string | null;
  buyer_gstin: string | null;
  invoice_number: string | null;
  invoice_date: string | null;
  due_date: string | null;
  line_items: InvoiceLineItem[];
  subtotal: number | null;
  gst_amount: number | null;
  total_amount: number | null;
  payment_status: string | null;
  transaction_type: 'sale' | 'purchase' | null;
};

type ApiRequest = IncomingMessage & {
  method?: string;
};

type ApiResponse = ServerResponse<IncomingMessage> & {
  status: (statusCode: number) => ApiResponse;
  json: (body: unknown) => void;
  setHeader: (name: string, value: string | string[]) => ApiResponse;
};

export const config = {
  api: {
    bodyParser: false
  }
};

export default async function handler(req: ApiRequest, res: ApiResponse) {
  let uploadedPdfPath: string | null = null;

  try {
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return res.status(405).json({ error: 'Method not allowed.' });
    }

    const apiKey = process.env.GROQ_API_KEY;

    if (!apiKey) {
      return res.status(503).json({ error: 'Missing GROQ_API_KEY' });
    }

    await fs.mkdir(TEMP_ROOT, { recursive: true });

    const uploadedFile = await parseUploadedPdf(req);
    uploadedPdfPath = uploadedFile.filepath;

    const pdfBuffer = await fs.readFile(uploadedPdfPath);
    const invoiceText = await extractInvoicePdfRawText(pdfBuffer);

    if (!invoiceText.trim()) {
      return res.status(422).json({
        error: 'The invoice parser did not find any readable text in the uploaded PDF.'
      });
    }

    const invoiceData = await extractInvoiceDataFromText(invoiceText, apiKey);

    return res.status(200).json({ invoiceData });
  } catch (error) {
    console.error('Invoice API error:', error);
    const errorMessage =
      error instanceof Error
        ? error.message
        : 'The invoice parsing request failed.';
    const isMalformedAiResponse =
      errorMessage ===
      'The invoice parser returned a malformed AI response. Please try again with the same PDF or upload a clearer invoice.';

    return res.status(isMalformedAiResponse ? 502 : 500).json({
      error: errorMessage,
      ...(isMalformedAiResponse ? { code: 'MALFORMED_AI_RESPONSE' } : {})
    });
  } finally {
    await Promise.all([uploadedPdfPath ? safeRemove(uploadedPdfPath) : Promise.resolve()]);
  }
}

export async function POST(request: Request) {
  const apiKey = process.env.GROQ_API_KEY;

  if (!apiKey) {
    return Response.json({ error: 'Missing GROQ_API_KEY' }, { status: 503 });
  }

  let body: ParseInvoiceRequestBody;

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  if (!body.pdfBase64) {
    return Response.json({ error: 'Missing invoice file data.' }, { status: 400 });
  }

  if (!body.prompt) {
    return Response.json({ error: 'Missing invoice extraction prompt.' }, { status: 400 });
  }

  const firstPageImageBase64 = body.pdfBase64.trim();
  const enforcedPrompt = `${body.prompt.trim()}\n\n${JSON_ONLY_RESPONSE_INSTRUCTION}`;

  if (!firstPageImageBase64) {
    return Response.json({ error: 'Missing invoice image data.' }, { status: 400 });
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
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/jpeg;base64,${firstPageImageBase64}`
                }
              },
              {
                type: 'text',
                text: enforcedPrompt
              }
            ]
          }
        ],
        max_tokens: 1000
      })
    });
  } catch {
    return Response.json(
      { error: 'Unable to reach the invoice parsing service right now.' },
      { status: 502 }
    );
  }

  let responseData: unknown;

  try {
    responseData = await groqResponse.json();
  } catch {
    return Response.json(
      { error: 'The invoice parsing service returned an unreadable response.' },
      { status: 502 }
    );
  }

  if (!groqResponse.ok) {
    const apiMessage =
      typeof (responseData as { error?: { message?: unknown } })?.error?.message === 'string'
        ? (responseData as { error: { message: string } }).error.message
        : 'The invoice parsing request failed.';

    return Response.json({ error: apiMessage }, { status: groqResponse.status });
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
    return Response.json({ error: 'Groq did not return any invoice data.' }, { status: 502 });
  }

  const parsedInvoiceJson = safeParseInvoiceJson(responseText);

  if (!parsedInvoiceJson) {
    return Response.json(
      {
        error:
          'The invoice parser returned a malformed AI response. Please try again with the same PDF or upload a clearer invoice.',
        code: 'MALFORMED_AI_RESPONSE'
      },
      { status: 502 }
    );
  }

  try {
    const invoiceData = normalizeInvoiceData(parsedInvoiceJson);
    return Response.json({ invoiceData });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Groq returned an unexpected invoice format.'
      },
      { status: 500 }
    );
  }
}

const parseUploadedPdf = async (req: ApiRequest): Promise<FormidableFile> => {
  const form = formidable({
    uploadDir: TEMP_ROOT,
    keepExtensions: true,
    multiples: false,
    maxFiles: 1,
    allowEmptyFiles: false,
    filter: ({ mimetype, originalFilename }) =>
      mimetype === 'application/pdf' ||
      Boolean(originalFilename?.toLowerCase().endsWith('.pdf'))
  });

  const { files } = await new Promise<{
    files: Record<string, FormidableFile | FormidableFile[]>;
  }>((resolve, reject) => {
    form.parse(req, (error, _fields, parsedFiles) => {
      if (error) {
        reject(error);
        return;
      }

      resolve({ files: parsedFiles });
    });
  });

  const uploadedFile = files.file;
  const pdfFile = Array.isArray(uploadedFile) ? uploadedFile[0] : uploadedFile;

  if (!pdfFile?.filepath) {
    throw new Error('Missing PDF upload. Send the file as multipart/form-data with the "file" field.');
  }

  return pdfFile;
};

const extractInvoicePdfRawText = async (pdfBuffer: Buffer): Promise<string> => {
  const parsedText = await extractPdfText(pdfBuffer);

  if (parsedText.trim()) {
    return parsedText;
  }

  const pdfSource = pdfBuffer.toString('latin1');
  const literalTextMatches = [...pdfSource.matchAll(/\(([^()]*)\)\s*Tj/g)];

  return literalTextMatches
    .map((match) => decodePdfLiteralText(match[1]))
    .filter(Boolean)
    .join('\n');
};

const decodePdfLiteralText = (value: string) =>
  value
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t')
    .replace(/\\\(/g, '(')
    .replace(/\\\)/g, ')')
    .replace(/\\\\/g, '\\')
    .trim();

const extractInvoiceDataFromText = async (
  invoiceText: string,
  apiKey: string
): Promise<InvoiceData> => {
  const enforcedPrompt = `${INVOICE_TEXT_EXTRACTION_PROMPT}\n\n${JSON_ONLY_RESPONSE_INSTRUCTION}\n\nInvoice text:\n${invoiceText}`;

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
            content: enforcedPrompt
          }
        ],
        max_tokens: 2000
      })
    });
  } catch {
    throw new Error('Unable to reach the invoice parsing service right now.');
  }

  let responseData: unknown;

  try {
    responseData = await groqResponse.json();
  } catch {
    throw new Error('The invoice parsing service returned an unreadable response.');
  }

  if (!groqResponse.ok) {
    const apiMessage =
      typeof (responseData as { error?: { message?: unknown } })?.error?.message === 'string'
        ? (responseData as { error: { message: string } }).error.message
        : 'The invoice parsing request failed.';

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
    throw new Error('Groq did not return any invoice data.');
  }

  const parsedInvoiceJson = safeParseInvoiceJson(responseText);

  if (!parsedInvoiceJson) {
    throw new Error(
      'The invoice parser returned a malformed AI response. Please try again with the same PDF or upload a clearer invoice.'
    );
  }

  return normalizeInvoiceData(parsedInvoiceJson);
};

const safeRemove = async (filePath: string) => {
  try {
    await fs.rm(filePath, { force: true });
  } catch { }
};

const safeParseInvoiceJson = (value: string): unknown | null => {
  const cleanedValue = value.replace(/```json|```/gi, '').trim();
  const jsonStart = cleanedValue.indexOf('{');
  const jsonEnd = cleanedValue.lastIndexOf('}');

  if (jsonStart === -1 || jsonEnd === -1 || jsonEnd <= jsonStart) {
    if (process.env.NODE_ENV === 'development') {
      console.error('Groq raw invoice response (redacted):', redactInvoice(value));
    }
    return null;
  }

  try {
    return JSON.parse(cleanedValue.slice(jsonStart, jsonEnd + 1));
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('Groq raw invoice response (redacted):', redactInvoice(value));
      console.error('Groq invoice JSON parse error:', error);
    }
    return null;
  }
};

const redactInvoice = (value: unknown): string => {
  const rawText = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
  const cleanedValue = rawText.replace(/```json|```/gi, '').trim();
  const preview = cleanedValue.length > 300 ? `${cleanedValue.slice(0, 300)}...` : cleanedValue;

  const redactField = (field: unknown): string | null => {
    if (typeof field !== 'string' || !field.trim()) {
      return null;
    }

    const trimmed = field.trim();
    return trimmed.length <= 2 ? '*'.repeat(trimmed.length) : `${trimmed[0]}***${trimmed.slice(-1)}`;
  };

  try {
    const jsonStart = cleanedValue.indexOf('{');
    const jsonEnd = cleanedValue.lastIndexOf('}');

    if (jsonStart === -1 || jsonEnd === -1 || jsonEnd <= jsonStart) {
      return preview;
    }

    const parsed = JSON.parse(cleanedValue.slice(jsonStart, jsonEnd + 1)) as Record<string, unknown>;

    const redactedSummary = {
      vendor_name: redactField(parsed.vendor_name),
      seller_name: redactField(parsed.seller_name),
      seller_gstin: redactField(parsed.seller_gstin),
      buyer_name: redactField(parsed.buyer_name),
      buyer_gstin: redactField(parsed.buyer_gstin),
      invoice_number: redactField(parsed.invoice_number),
      subtotal: parsed.subtotal != null ? 'REDACTED' : null,
      gst_amount: parsed.gst_amount != null ? 'REDACTED' : null,
      total_amount: parsed.total_amount != null ? 'REDACTED' : null,
      payment_status: redactField(parsed.payment_status),
      transaction_type: typeof parsed.transaction_type === 'string' ? parsed.transaction_type : null,
      preview
    };

    return JSON.stringify(redactedSummary);
  } catch {
    return preview;
  }
};

const createEmptyInvoiceData = (): InvoiceData => ({
  vendor_name: null,
  seller_name: null,
  seller_gstin: null,
  buyer_name: null,
  buyer_gstin: null,
  invoice_number: null,
  invoice_date: null,
  due_date: null,
  line_items: [],
  subtotal: null,
  gst_amount: null,
  total_amount: null,
  payment_status: null,
  transaction_type: null
});

const normalizeInvoiceData = (rawValue: unknown): InvoiceData => {
  if (!rawValue || typeof rawValue !== 'object') {
    throw new Error('Groq returned invalid invoice data.');
  }

  const rawInvoice = rawValue as Record<string, unknown>;
  const sellerName = normalizeNullableString(rawInvoice.seller_name);
  const buyerName = normalizeNullableString(rawInvoice.buyer_name);

  return {
    vendor_name: normalizeNullableString(rawInvoice.vendor_name) ?? sellerName ?? buyerName,
    seller_name: sellerName,
    seller_gstin: normalizeNullableString(rawInvoice.seller_gstin),
    buyer_name: buyerName,
    buyer_gstin: normalizeNullableString(rawInvoice.buyer_gstin),
    invoice_number: normalizeNullableString(rawInvoice.invoice_number),
    invoice_date: normalizeNullableDate(rawInvoice.invoice_date),
    due_date: normalizeNullableDate(rawInvoice.due_date),
    line_items: normalizeLineItems(rawInvoice.line_items),
    subtotal: normalizeNullableNumber(rawInvoice.subtotal),
    gst_amount: normalizeNullableNumber(rawInvoice.gst_amount),
    total_amount: normalizeNullableNumber(rawInvoice.total_amount),
    payment_status: normalizeNullableString(rawInvoice.payment_status),
    transaction_type: normalizeTransactionType(rawInvoice.transaction_type)
  };
};

const normalizeLineItems = (value: unknown): InvoiceLineItem[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((item) => {
    const rawItem = item && typeof item === 'object' ? (item as Record<string, unknown>) : {};

    return {
      description: normalizeNullableString(rawItem.description),
      quantity: normalizeNullableNumber(rawItem.quantity),
      unit_price: normalizeNullableNumber(rawItem.unit_price),
      amount: normalizeNullableNumber(rawItem.amount)
    };
  });
};

const normalizeNullableString = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return null;
  }

  const normalizedValue = trimmedValue.toLowerCase();
  if (normalizedValue === 'null' || normalizedValue === 'n/a' || normalizedValue === 'na') {
    return null;
  }

  return trimmedValue;
};

const normalizeNullableNumber = (value: unknown): number | null => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value !== 'string') {
    return null;
  }

  const numericValue = value.replace(/,/g, '').replace(/[^\d.-]/g, '');

  if (!numericValue) {
    return null;
  }

  const parsedNumber = Number.parseFloat(numericValue);
  return Number.isNaN(parsedNumber) ? null : parsedNumber;
};

const normalizeNullableDate = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return null;
  }

  const datePart = trimmedValue.split(' ')[0];

  if (/^\d{4}[-/]\d{2}[-/]\d{2}$/.test(datePart)) {
    const [year, month, day] = datePart.split(/[-/]/);
    return `${year}-${month}-${day}`;
  }

  if (/^\d{2}[-/]\d{2}[-/]\d{4}$/.test(datePart)) {
    const [day, month, year] = datePart.split(/[-/]/);
    return `${year}-${month}-${day}`;
  }

  if (/^\d{2}-[A-Za-z]{3}-\d{4}$/.test(datePart)) {
    const parsedDate = new Date(datePart);
    return Number.isNaN(parsedDate.getTime()) ? null : formatDate(parsedDate);
  }

  const parsedDate = new Date(trimmedValue);
  return Number.isNaN(parsedDate.getTime()) ? null : formatDate(parsedDate);
};

const normalizeTransactionType = (value: unknown): 'sale' | 'purchase' | null => {
  if (typeof value !== 'string') {
    return null;
  }

  const normalizedValue = value.trim().toLowerCase();

  if (normalizedValue === 'sale' || normalizedValue === 'purchase') {
    return normalizedValue;
  }

  return null;
};

const formatDate = (date: Date) => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
};
