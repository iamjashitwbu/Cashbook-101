import type { VercelRequest, VercelResponse } from '@vercel/node';

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'meta-llama/llama-4-scout-17b-16e-instruct';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '20mb',
    },
  },
};

async function extractFromImages(images: string[], apiKey: string, prompt: string) {
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
          role: "system",
          content: "Extract ALL bank transactions from the bank statement images. Return ONLY a JSON array with fields: date, description, amount, type (debit or credit). Extract every row from all pages."
        },
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            ...images.map((img: string) => ({
              type: "image_url",
              image_url: { url: `data:image/jpeg;base64,${img}` }
            }))
          ]
        }
      ],
      temperature: 0,
      max_tokens: 8000
    })
  });
  const data = await response.json();
  const content = data.choices[0].message.content;
  const jsonStart = content.indexOf('[');
  const jsonEnd = content.lastIndexOf(']');
  return JSON.parse(content.substring(jsonStart, jsonEnd + 1));
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'Missing GROQ_API_KEY' });

  try {
    const { pageImagesBase64, prompt } = req.body;
    const batchSize = 2;
    const allRows: any[] = [];

    for (let i = 0; i < pageImagesBase64.length; i += batchSize) {
      const batch = pageImagesBase64.slice(i, i + batchSize);
      const rows = await extractFromImages(batch, apiKey, prompt);
      allRows.push(...rows);
    }

    return res.status(200).json({ rows: allRows });
  } catch (err) {
    return res.status(500).json({ error: (err as Error).message });
  }
}
