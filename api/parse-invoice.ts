const GEMINI_API_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

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
  invoice_number: string | null;
  invoice_date: string | null;
  due_date: string | null;
  line_items: InvoiceLineItem[];
  subtotal: number | null;
  gst_amount: number | null;
  total_amount: number | null;
  payment_status: string | null;
};

export async function POST(request: Request) {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return Response.json(
      {
        error: 'Invoice parsing is not configured on the server. Add GEMINI_API_KEY and redeploy.'
      },
      { status: 500 }
    );
  }

  let body: ParseInvoiceRequestBody;

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  if (!body.pdfBase64) {
    return Response.json({ error: 'Missing PDF data.' }, { status: 400 });
  }

  if (!body.prompt) {
    return Response.json({ error: 'Missing invoice extraction prompt.' }, { status: 400 });
  }

  let geminiResponse: Response;

  try {
    geminiResponse = await fetch(`${GEMINI_API_URL}?key=${encodeURIComponent(apiKey)}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                inline_data: {
                  mime_type: 'application/pdf',
                  data: body.pdfBase64
                }
              },
              {
                text: body.prompt
              }
            ]
          }
        ]
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
    responseData = await geminiResponse.json();
  } catch {
    return Response.json(
      { error: 'The invoice parsing service returned an unreadable response.' },
      { status: 502 }
    );
  }

  if (!geminiResponse.ok) {
    const apiMessage =
      typeof (responseData as { error?: { message?: unknown } })?.error?.message === 'string'
        ? (responseData as { error: { message: string } }).error.message
        : 'The invoice parsing request failed.';

    return Response.json({ error: apiMessage }, { status: geminiResponse.status });
  }

  const responseText = Array.isArray((responseData as { candidates?: unknown[] })?.candidates)
    ? ((responseData as {
        candidates: Array<{
          content?: { parts?: Array<{ text?: string }> };
        }>;
      }).candidates)
        .flatMap((candidate) => candidate.content?.parts ?? [])
        .map((part) => part.text ?? '')
        .join('\n')
        .trim()
    : '';

  if (!responseText) {
    return Response.json({ error: 'Gemini did not return any invoice data.' }, { status: 502 });
  }

  try {
    const rawText = responseText;
    const cleaned = rawText.replace(/```json/g, '').replace(/```/g, '').trim();

    let parsed: unknown;

    try {
      parsed = JSON.parse(cleaned);
    } catch {
      console.error('Gemini raw invoice response:', rawText);
      parsed = parseJsonObject(rawText);
    }

    const invoiceData = normalizeInvoiceData(parsed);
    return Response.json({ invoiceData });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Gemini returned an unexpected invoice format.'
      },
      { status: 502 }
    );
  }
}

const parseJsonObject = (value: string) => {
  const cleanedValue = value.replace(/```json|```/gi, '').trim();

  try {
    return JSON.parse(cleanedValue);
  } catch {
    const jsonStart = cleanedValue.indexOf('{');
    const jsonEnd = cleanedValue.lastIndexOf('}');

    if (jsonStart === -1 || jsonEnd === -1 || jsonEnd <= jsonStart) {
      throw new Error('Gemini returned an unexpected response format.');
    }

    return JSON.parse(cleanedValue.slice(jsonStart, jsonEnd + 1));
  }
};

const normalizeInvoiceData = (rawValue: unknown): InvoiceData => {
  if (!rawValue || typeof rawValue !== 'object') {
    throw new Error('Gemini returned invalid invoice data.');
  }

  const rawInvoice = rawValue as Record<string, unknown>;

  return {
    vendor_name: normalizeNullableString(rawInvoice.vendor_name),
    invoice_number: normalizeNullableString(rawInvoice.invoice_number),
    invoice_date: normalizeNullableDate(rawInvoice.invoice_date),
    due_date: normalizeNullableDate(rawInvoice.due_date),
    line_items: normalizeLineItems(rawInvoice.line_items),
    subtotal: normalizeNullableNumber(rawInvoice.subtotal),
    gst_amount: normalizeNullableNumber(rawInvoice.gst_amount),
    total_amount: normalizeNullableNumber(rawInvoice.total_amount),
    payment_status: normalizeNullableString(rawInvoice.payment_status)
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

const formatDate = (date: Date) => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
};
