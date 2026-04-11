import formidable, { type File as FormidableFile } from 'formidable';
import { promises as fs } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { ExtractedBankStatementRow } from '../lib/bankStatementTypes';
import { groqExtract } from '../lib/groqExtract.js';
import { parseBankStatementRows } from '../lib/parseBankStatementRows.js';
import { extractPdfText } from '../lib/pdfTextExtract.js';

const TEMP_ROOT = '/tmp';
const GROQ_TEXT_CHUNK_SIZE = 3000;
const PROCESSING_TIMEOUT_MS = 55_000;

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
  const startedAt = Date.now();

  try {
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return res.status(405).json({ rows: [], error: 'Method not allowed.' });
    }

    await fs.mkdir(TEMP_ROOT, { recursive: true });

    const uploadedFile = await parseUploadedPdf(req);
    uploadedPdfPath = uploadedFile.filepath;

    const buffer = await fs.readFile(uploadedPdfPath);

    let pageTexts: string[] = [];

    try {
      const fullText = await withTimeout(
        extractPdfText(buffer),
        remainingTime(startedAt),
        new Error('Processing timed out during PDF extraction.')
      );

      pageTexts = fullText ? [fullText] : [];
    } catch (error) {
      console.error('PDF extraction failed:', error);
      return res.status(200).json({
        rows: [],
        error: 'PDF extraction failed'
      });
    }

    if (pageTexts.length === 0 || pageTexts.every((pageText) => !pageText.trim())) {
      return res.status(200).json({
        rows: [],
        error: 'PDF extraction failed'
      });
    }

    const parsedRows = safeParseBankStatementRows(pageTexts);

    if (parsedRows.length > 0) {
      if (isTimedOut(startedAt)) {
        return res.status(200).json({
          rows: parsedRows,
          error: 'Processing timed out'
        });
      }

      return res.status(200).json({ rows: parsedRows });
    }

    const textChunks = chunkStatementText(pageTexts, GROQ_TEXT_CHUNK_SIZE);
    const allRows: ExtractedBankStatementRow[] = [];

    for (const textChunk of textChunks) {
      if (isTimedOut(startedAt)) {
        return res.status(200).json({
          rows: allRows,
          error: 'Processing timed out'
        });
      }

      try {
        const rows = await withTimeout(
          groqExtract(textChunk),
          remainingTime(startedAt),
          new Error('Processing timed out during fallback extraction.')
        );
        allRows.push(...rows);
      } catch (error) {
        console.error('Groq fallback failed:', error);
        return res.status(200).json({
          rows: allRows,
          error: allRows.length > 0 ? 'Processing timed out' : 'Internal parsing failed'
        });
      }

      if (isTimedOut(startedAt)) {
        return res.status(200).json({
          rows: allRows,
          error: 'Processing timed out'
        });
      }
    }

    return res.status(200).json({ rows: allRows });
  } catch (err) {
    console.error('API ERROR:', err);
    return res.status(200).json({
      rows: [],
      error: 'Internal parsing failed'
    });
  } finally {
    await Promise.all([uploadedPdfPath ? safeRemove(uploadedPdfPath) : Promise.resolve()]);
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

const safeRemove = async (filePath: string) => {
  try {
    await fs.rm(filePath, { force: true, recursive: true });
  } catch {}
};

const chunkStatementText = (pageTexts: string[], maxChunkLength: number) => {
  const chunks: string[] = [];
  let currentChunk = '';

  for (const [index, pageText] of pageTexts.entries()) {
    const trimmedPageText = pageText.trim();

    if (!trimmedPageText) continue;

    const pageChunk = `Page ${index + 1}\n${trimmedPageText}`;

    if (!currentChunk) {
      currentChunk = pageChunk;
      continue;
    }

    const candidateChunk = `${currentChunk}\n\n${pageChunk}`;

    if (candidateChunk.length > maxChunkLength) {
      chunks.push(currentChunk);
      currentChunk = pageChunk;
      continue;
    }

    currentChunk = candidateChunk;
  }

  if (currentChunk) chunks.push(currentChunk);

  return chunks;
};

const safeParseBankStatementRows = (pageTexts: string[]) => {
  try {
    return parseBankStatementRows(pageTexts);
  } catch (error) {
    console.error('Local text parsing failed:', error);
    return [];
  }
};

const isTimedOut = (startedAt: number) =>
  Date.now() - startedAt >= PROCESSING_TIMEOUT_MS;

const remainingTime = (startedAt: number) =>
  Math.max(PROCESSING_TIMEOUT_MS - (Date.now() - startedAt), 1);

const withTimeout = async <T>(
  promise: Promise<T>,
  timeoutMs: number,
  timeoutError: Error
): Promise<T> => {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeoutId = setTimeout(() => reject(timeoutError), timeoutMs);
      })
    ]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
};
