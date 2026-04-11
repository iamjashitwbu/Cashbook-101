import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

interface RawTextItem {
  str: string;
  transform: number[];
}

export const extractTextFromPDF = async (file: File): Promise<string> => {
  let pdfDocument: Awaited<ReturnType<typeof pdfjsLib.getDocument>['promise']> | undefined;

  try {
    const pdfBytes = new Uint8Array(await file.arrayBuffer());
    const loadingTask = pdfjsLib.getDocument({ data: pdfBytes });
    pdfDocument = await loadingTask.promise;
    const pageTexts: string[] = [];

    for (let pageNumber = 1; pageNumber <= pdfDocument.numPages; pageNumber += 1) {
      const page = await pdfDocument.getPage(pageNumber);
      const textContent = await page.getTextContent();
      const textItems = textContent.items
        .map(getRawTextItem)
        .filter((item): item is RawTextItem => item !== null);
      const lines = buildTextLines(textItems);

      console.log('TOTAL TEXT ITEMS:', textItems.length);
      console.log('TOTAL LINES:', lines.length);
      console.log('SAMPLE LINES:', lines.slice(0, 20));

      const pageText = lines.join('\n');

      if (pageText.trim()) {
        pageTexts.push(pageText);
      }
    }

    const finalText = pageTexts.join('\n');
    console.log('FINAL TEXT:', finalText);
    return finalText;
  } catch (error) {
    throw new Error(
      error instanceof Error ? error.message : 'Unable to read the uploaded PDF.'
    );
  } finally {
    pdfDocument?.destroy();
  }
};

const getRawTextItem = (item: unknown): RawTextItem | null => {
  if (!item || typeof item !== 'object' || !('str' in item) || !('transform' in item)) {
    return null;
  }

  const transform = item.transform;

  if (!Array.isArray(transform)) {
    return null;
  }

  const normalizedTransform = transform.map(Number);
  const x = normalizedTransform[4];
  const y = normalizedTransform[5];

  if (Number.isNaN(x) || Number.isNaN(y)) {
    return null;
  }

  return {
    str: String(item.str),
    transform: normalizedTransform
  };
};

function buildTextLines(textItems: RawTextItem[]) {
  const sorted = [...textItems].sort(
    (a, b) =>
      b.transform[5] - a.transform[5] ||
      a.transform[4] - b.transform[4]
  );

  return sorted.map((item) => item.str);
};

export const convertPDFTextToCSV = (text: string): string => {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => {
      const hasDate = /\b\d{1,4}[/-]\d{1,2}[/-]\d{2,4}\b/.test(line);
      const hasNumber = /\d/.test(line);
      return hasDate && hasNumber;
    })
    .map((line) =>
      line
        .split(/\s{2,}/)
        .map((column) => column.trim())
        .filter(Boolean)
        .join(',')
    )
    .filter(Boolean)
    .join('\n');
};
