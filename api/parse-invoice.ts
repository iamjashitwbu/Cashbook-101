import type { VercelRequest, VercelResponse } from '@vercel/node';

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'meta-llama/llama-4-scout-17b-16e-instruct';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.GROQ_API_KEY;

  if (!apiKey) {
    return res.status(500).json({
      error: 'Invoice parsing is not configured on the server. Add GROQ_API_KEY and redeploy.'
    });
  }

  try {
    const { pdfBase64 } = req.body;

    if (!pdfBase64) {
      return res.status(400).json({ error: 'No PDF data provided' });
    }

    const response = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
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
                  url: `data:image/jpeg;base64,${pdfBase64}`
                }
              },
              {
                type: 'text',
                text: 'Extract all invoice data from this image and return ONLY a JSON object with no extra text, no markdown, no backticks. Fields: vendor_name, invoice_number, invoice_date, due_date, line_items (array of: description, quantity, unit_price, amount), subtotal, gst_amount, total_amount, payment_status, transaction_type (return "sale" if we are the seller, "purchase" if we are the buyer). Set any missing field to null.'
              }
            ]
          }
        ],
        max_tokens: 1000
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Groq API error:', errorText);
      return res.status(500).json({ error: errorText });
    }

    const data = await response.json();
    const rawText = data.choices?.[0]?.message?.content || '';
    console.log('Groq raw response:', rawText);

    const cleaned = rawText.replace(/```json/g, '').replace(/```/g, '').trim();

    try {
      const parsed = JSON.parse(cleaned);
      return res.status(200).json(parsed);
    } catch (parseError) {
      console.error('JSON parse error. Raw response:', rawText);
      return res.status(500).json({ error: 'The invoice parser returned an unreadable response.' });
    }

  } catch (error) {
    console.error('Handler error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
