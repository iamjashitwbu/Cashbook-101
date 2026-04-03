import type { VercelRequest, VercelResponse } from '@vercel/node';

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'llama3-70b-8192';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.GROQ_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: 'Missing GROQ_API_KEY' });
  }

  try {
    const { pageImagesBase64, prompt } = req.body;

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
            role: 'system',
            content:
              'Extract ALL bank transactions from bank statement images. Return ONLY JSON array with fields: date, description, amount, type (debit or credit).'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0
      })
    });

    const data = await response.json();
    const content = data.choices[0].message.content;

    const jsonStart = content.indexOf('[');
    const jsonEnd = content.lastIndexOf(']');
    const jsonString = content.substring(jsonStart, jsonEnd + 1);

    const rows = JSON.parse(jsonString);

    return res.status(200).json({ rows });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to parse bank statement' });
  }
}
