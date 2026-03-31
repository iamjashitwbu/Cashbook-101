import { normalizeInvoiceData, parseJsonObject } from '../src/utils/invoiceData';

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_API_VERSION = '2023-06-01';
const ANTHROPIC_MODEL = 'claude-sonnet-4-20250514';

type ParseInvoiceRequestBody = {
  pdfBase64?: string;
  prompt?: string;
};

export async function POST(request: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    return Response.json(
      {
        error: 'Invoice parsing is not configured on the server. Add ANTHROPIC_API_KEY and redeploy.'
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

  let anthropicResponse: Response;

  try {
    anthropicResponse = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'anthropic-version': ANTHROPIC_API_VERSION,
        'x-api-key': apiKey
      },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        max_tokens: 2048,
        system: body.prompt,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'document',
                source: {
                  type: 'base64',
                  media_type: 'application/pdf',
                  data: body.pdfBase64
                }
              },
              {
                type: 'text',
                text: 'Extract the invoice fields from this PDF and return only the JSON object.'
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
    responseData = await anthropicResponse.json();
  } catch {
    return Response.json(
      { error: 'The invoice parsing service returned an unreadable response.' },
      { status: 502 }
    );
  }

  if (!anthropicResponse.ok) {
    const apiMessage =
      typeof (responseData as { error?: { message?: unknown } })?.error?.message === 'string'
        ? (responseData as { error: { message: string } }).error.message
        : 'The invoice parsing request failed.';

    return Response.json({ error: apiMessage }, { status: anthropicResponse.status });
  }

  const responseText = Array.isArray((responseData as { content?: unknown[] })?.content)
    ? ((responseData as { content: Array<{ type?: string; text?: string }> }).content)
        .filter((block) => block.type === 'text')
        .map((block) => block.text ?? '')
        .join('\n')
        .trim()
    : '';

  if (!responseText) {
    return Response.json({ error: 'Claude did not return any invoice data.' }, { status: 502 });
  }

  try {
    const rawText = responseText;
    const cleaned = rawText.replace(/```json/g, '').replace(/```/g, '').trim();

    let parsed: unknown;

    try {
      parsed = JSON.parse(cleaned);
    } catch {
      console.error('Claude raw invoice response:', rawText);
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
            : 'Claude returned an unexpected invoice format.'
      },
      { status: 502 }
    );
  }
}
